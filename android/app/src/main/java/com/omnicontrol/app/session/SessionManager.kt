package com.omnicontrol.app.session

import android.content.Context
import android.content.Intent
import com.omnicontrol.app.pairing.PairingRepository
import com.omnicontrol.app.webrtc.WebRtcManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class ActiveSessionState(
    val isActive: Boolean = false,
    val sessionId: String? = null,
    val deviceId: String? = null,
    val isSharingScreen: Boolean = false,
    val isSharingAudio: Boolean = false,
    val sessionDurationSeconds: Long = 0,
    val statusMessage: String = "Ready for Support Session"
)

object SessionManager {

    private val _sessionState = MutableStateFlow(ActiveSessionState())
    val sessionState: StateFlow<ActiveSessionState> = _sessionState.asStateFlow()

    private var webRtcManager: WebRtcManager? = null

    fun isSessionActive(): Boolean = _sessionState.value.isActive

    fun onScreenCaptureReady(context: Context, resultCode: Int, resultData: Intent) {
        val current = _sessionState.value
        val rtc = WebRtcManager(context)
        webRtcManager = rtc

        CoroutineScope(Dispatchers.IO).launch {
            val repository = PairingRepository(context)
            val serverUrl = repository.getServerUrl()
            val deviceId = repository.getDeviceId() ?: current.deviceId ?: "device-android"
            val sessionId = current.sessionId ?: "active-session"

            withContext(Dispatchers.Main) {
                rtc.initialize(serverUrl, sessionId, deviceId)
                rtc.startScreenCapture(resultCode, resultData)

                _sessionState.value = current.copy(
                    isActive = true,
                    deviceId = deviceId,
                    isSharingScreen = true,
                    isSharingAudio = true,
                    statusMessage = "Live Screen Sharing and Audio Active"
                )
            }
        }
    }

    fun prepareSession(sessionId: String, deviceId: String) {
        _sessionState.value = _sessionState.value.copy(
            sessionId = sessionId,
            deviceId = deviceId,
            statusMessage = "Awaiting Screen Sharing Approval"
        )
    }

    fun endActiveSession(reason: String = "User ended session") {
        webRtcManager?.stop()
        webRtcManager = null

        _sessionState.value = ActiveSessionState(
            isActive = false,
            isSharingScreen = false,
            isSharingAudio = false,
            statusMessage = "Session Ended: $reason"
        )
    }
}
