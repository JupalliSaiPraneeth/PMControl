package com.omnicontrol.app.ui.screens

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
                border = ButtonDefaults.outlinedButtonBorder,
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
                border = ButtonDefaults.outlinedButtonBorder
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Active Streams", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = SkyPrimary)
                    Text("• Screen Capture: Active (MediaProjection)", fontSize = 12.sp, color = TextSecondary)
                    Text("• Audio Transmission: Active (Microphone)", fontSize = 12.sp, color = TextSecondary)
                    Text("• E2E Security: WebRTC DTLS/SRTP", fontSize = 12.sp, color = TextSecondary)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

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
