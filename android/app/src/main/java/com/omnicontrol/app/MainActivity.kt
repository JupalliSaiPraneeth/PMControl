package com.omnicontrol.app

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.core.content.ContextCompat
import com.omnicontrol.app.pairing.PairingRepository
import com.omnicontrol.app.service.ScreenCaptureService
import com.omnicontrol.app.session.SessionManager
import com.omnicontrol.app.ui.screens.*
import com.omnicontrol.app.ui.theme.OmniControlTheme

class MainActivity : ComponentActivity() {

    private lateinit var pairingRepository: PairingRepository

    // MediaProjection screen capture consent launcher
    private val screenCaptureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val serviceIntent = Intent(this, ScreenCaptureService::class.java).apply {
                action = ScreenCaptureService.ACTION_START
                putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, result.resultCode)
                putExtra(ScreenCaptureService.EXTRA_RESULT_DATA, result.data)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } else {
            SessionManager.endActiveSession("User declined screen sharing permission")
        }
    }

    // Permission launcher for audio and notifications
    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Log or handle permission grants
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pairingRepository = PairingRepository(this)

        requestRequiredPermissions()

        setContent {
            OmniControlTheme {
                val sessionState by SessionManager.sessionState.collectAsState()
                var currentScreen by remember { mutableStateOf("welcome") }
                var isPaired by remember { mutableStateOf(false) }

                LaunchedEffect(Unit) {
                    val deviceId = pairingRepository.getDeviceId()
                    isPaired = !deviceId.isNullOrEmpty()
                    if (isPaired) {
                        currentScreen = "dashboard"
                    }
                }

                if (sessionState.isActive) {
                    ActiveSessionScreen(
                        sessionState = sessionState,
                        onEndSession = {
                            val stopIntent = Intent(this@MainActivity, ScreenCaptureService::class.java).apply {
                                action = ScreenCaptureService.ACTION_STOP
                            }
                            startService(stopIntent)
                            SessionManager.endActiveSession("Stopped by user in app")
                            currentScreen = "dashboard"
                        }
                    )
                } else {
                    when (currentScreen) {
                        "welcome" -> WelcomeScreen(
                            isPaired = isPaired,
                            onNavigateToPairing = { currentScreen = "pairing" },
                            onNavigateToDashboard = { currentScreen = "dashboard" }
                        )
                        "pairing" -> PairingScreen(
                            repository = pairingRepository,
                            onPairingSuccess = {
                                isPaired = true
                                currentScreen = "dashboard"
                            },
                            onBack = { currentScreen = "welcome" }
                        )
                        "dashboard" -> DashboardScreen(
                            repository = pairingRepository,
                            onRequestScreenCapture = {
                                requestScreenCaptureConsent()
                            },
                            onUnpair = {
                                isPaired = false
                                currentScreen = "welcome"
                            }
                        )
                    }
                }
            }
        }
    }

    private fun requestRequiredPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (permissionsToRequest.isNotEmpty()) {
            permissionsLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    private fun requestScreenCaptureConsent() {
        val mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        screenCaptureLauncher.launch(mediaProjectionManager.createScreenCaptureIntent())
    }
}
