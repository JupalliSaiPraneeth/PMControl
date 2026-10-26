package com.omnicontrol.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.omnicontrol.app.ui.theme.*

@Composable
fun WelcomeScreen(
    isPaired: Boolean,
    onNavigateToPairing: () -> Unit,
    onNavigateToDashboard: () -> Unit
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
            verticalArrangement = Arrangement.spacedBy(20.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            // Icon
            Surface(
                color = SlateSurface,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.size(80.dp),
                border = BorderStroke(1.dp, SlateBorder)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = "📡",
                        fontSize = 36.sp
                    )
                }
            }

            // Title & Subtitle
            Text(
                text = "OmniControl",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )
            Text(
                text = "Secure Android Remote-Support Platform\nDirect Consent & Peer-to-Peer WebRTC",
                fontSize = 14.sp,
                color = TextSecondary,
                textAlign = TextAlign.Center,
                lineHeight = 20.sp
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Action Buttons
            if (isPaired) {
                Button(
                    onClick = onNavigateToDashboard,
                    colors = ButtonDefaults.buttonColors(containerColor = SkyPrimary),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    Text("Go to Device Dashboard", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                }
            } else {
                Button(
                    onClick = onNavigateToPairing,
                    colors = ButtonDefaults.buttonColors(containerColor = SkyPrimary),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    Text("Pair with Controller", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                }
            }

            // Privacy Card
            Surface(
                color = SlateSurface,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                border = BorderStroke(1.dp, SlateBorder)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "🔒 Privacy & Security Guarantee",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = SkyPrimary
                    )
                    Text(
                        text = "Screen sharing and microphone access require explicit, per-session device consent. Covert monitoring is prevented by system foreground service notifications.",
                        fontSize = 11.sp,
                        color = TextSecondary,
                        lineHeight = 16.sp
                    )
                }
            }
        }
    }
}
