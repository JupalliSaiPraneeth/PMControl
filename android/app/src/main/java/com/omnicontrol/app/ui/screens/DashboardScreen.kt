package com.omnicontrol.app.ui.screens

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.omnicontrol.app.pairing.PairingRepository
import com.omnicontrol.app.service.OmniAccessibilityService
import com.omnicontrol.app.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun DashboardScreen(
    repository: PairingRepository,
    onRequestScreenCapture: () -> Unit,
    onUnpair: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var deviceId by remember { mutableStateOf("Loading...") }
    val isAccessibilityEnabled = OmniAccessibilityService.isServiceRunning()

    LaunchedEffect(Unit) {
        deviceId = repository.getDeviceId() ?: "Unknown"
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(SlateBackground)
            .padding(24.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Device Dashboard", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Text("Enrolled in OmniControl", fontSize = 12.sp, color = TextSecondary)
                }
                Surface(
                    color = EmeraldSuccess.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(20.dp),
                    border = ButtonDefaults.outlinedButtonBorder
                ) {
                    Text(
                        text = "● Paired",
                        color = EmeraldSuccess,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }

            // Info Card
            Surface(
                color = SlateSurface,
                shape = RoundedCornerShape(16.dp),
                border = ButtonDefaults.outlinedButtonBorder,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Device Details", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = SkyPrimary)
                    Text("Device ID: ${deviceId.take(12)}...", fontSize = 12.sp, color = TextSecondary)
                    Text("Platform: Android 14 / 15", fontSize = 12.sp, color = TextSecondary)
                    Text("Remote Interaction: ${if (isAccessibilityEnabled) "Accessibility Enabled" else "Viewing Only (Accessibility Disabled)"}", fontSize = 12.sp, color = TextSecondary)
                }
            }

            // Accessibility Action
            if (!isAccessibilityEnabled) {
                Surface(
                    color = SlateSurface,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Remote Gestures", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                            Text("Enable Accessibility service to permit authorized remote touches.", fontSize = 11.sp, color = TextSecondary)
                        }
                        TextButton(onClick = {
                            context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                        }) {
                            Text("Enable", color = SkyPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Start Screen Sharing Session Button
            Button(
                onClick = onRequestScreenCapture,
                colors = ButtonDefaults.buttonColors(containerColor = SkyPrimary),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                Text("Start Support Session", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }

            // Unpair Button
            OutlinedButton(
                onClick = {
                    coroutineScope.launch {
                        repository.clearEnrollment()
                        onUnpair()
                    }
                },
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = RoseError),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Text("Unpair Device", fontSize = 13.sp)
            }
        }
    }
}
