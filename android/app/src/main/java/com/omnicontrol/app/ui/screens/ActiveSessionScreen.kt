package com.omnicontrol.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.omnicontrol.app.session.ActiveSessionState
import com.omnicontrol.app.ui.theme.*

@Composable
fun ActiveSessionScreen(
    sessionState: ActiveSessionState,
    onEndSession: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(SlateBackground)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            // Live Pulsing Indicator
            Surface(
                color = EmeraldSuccess.copy(alpha = 0.15f),
                shape = RoundedCornerShape(32.dp),
                border = BorderStroke(1.dp, EmeraldSuccess.copy(alpha = 0.3f)),
                modifier = Modifier.size(100.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text("🔴", fontSize = 42.sp)
                }
            }

            Text(
                text = "Remote Session Live",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )

            Text(
                text = "Screen sharing and microphone transmission are authorized and active. Your controller is viewing and interacting with the device.",
                fontSize = 13.sp,
                color = TextSecondary,
                textAlign = TextAlign.Center,
                lineHeight = 18.sp
            )

            Surface(
                color = SlateSurface,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth(),
                border = BorderStroke(1.dp, SlateBorder)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Active Streams", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = SkyPrimary)
                    Text("• Screen Capture: Active (MediaProjection)", fontSize = 12.sp, color = TextSecondary)
                    Text(
                        text = if (!sessionState.isSharingAudio) {
                            "• Audio Transmission: Stopped by User"
                        } else if (sessionState.isMicMuted) {
                            "• Audio Transmission: Muted"
                        } else {
                            "• Audio Transmission: Transmitting Live Voice"
                        },
                        fontSize = 12.sp,
                        color = if (sessionState.isSharingAudio && !sessionState.isMicMuted) EmeraldSuccess else RoseError
                    )
                    Text("• E2E Security: WebRTC DTLS/SRTP (STUN/TURN Relay)", fontSize = 12.sp, color = TextSecondary)
                }
            }

            // Quick Device Voice Controls
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = { com.omnicontrol.app.session.SessionManager.toggleMicrophone() },
                    modifier = Modifier.weight(1f).height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, if (sessionState.isMicMuted) RoseError else SlateBorder)
                ) {
                    Text(
                        text = if (sessionState.isMicMuted) "Unmute Mic" else "Mute Mic",
                        fontSize = 13.sp,
                        color = if (sessionState.isMicMuted) RoseError else TextPrimary
                    )
                }

                if (sessionState.isSharingAudio) {
                    OutlinedButton(
                        onClick = { com.omnicontrol.app.session.SessionManager.stopVoiceTransmission() },
                        modifier = Modifier.weight(1f).height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, AmberWarning)
                    ) {
                        Text("Stop Audio", fontSize = 13.sp, color = AmberWarning)
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Big Immediate End Session Button
            Button(
                onClick = onEndSession,
                colors = ButtonDefaults.buttonColors(containerColor = RoseError),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(54.dp)
            ) {
                Text("End Session Immediately", fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
