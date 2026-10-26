package com.omnicontrol.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.omnicontrol.app.pairing.PairingRepository
import com.omnicontrol.app.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun PairingScreen(
    repository: PairingRepository,
    onPairingSuccess: () -> Unit,
    onBack: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var serverUrl by remember { mutableStateOf("http://10.0.2.2:4000") }
    var pairingCode by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        serverUrl = repository.getServerUrl()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(SlateBackground)
            .padding(24.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Enter Pairing Code",
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )
            Text(
                text = "Type the 6-digit cryptographic pairing code displayed on your controller dashboard.",
                fontSize = 13.sp,
                color = TextSecondary,
                textAlign = TextAlign.Center
            )

            // 6-Digit Code Input
            OutlinedTextField(
                value = pairingCode,
                onValueChange = { if (it.length <= 6 && it.all { char -> char.isDigit() }) pairingCode = it },
                label = { Text("6-Digit Code") },
                placeholder = { Text("123456") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )

            // Server URL Input
            OutlinedTextField(
                value = serverUrl,
                onValueChange = { serverUrl = it },
                label = { Text("Server URL") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )

            errorMessage?.let {
                Text(
                    text = it,
                    color = RoseError,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = {
                    if (pairingCode.length != 6) {
                        errorMessage = "Pairing code must be exactly 6 digits."
                        return@Button
                    }
                    isLoading = true
                    errorMessage = null
                    coroutineScope.launch {
                        val result = repository.enrollDeviceWithCode(serverUrl.trim(), pairingCode.trim())
                        isLoading = false
                        result.onSuccess {
                            onPairingSuccess()
                        }.onFailure {
                            errorMessage = it.message ?: "Pairing failed. Check code and server connection."
                        }
                    }
                },
                enabled = !isLoading && pairingCode.length == 6,
                colors = ButtonDefaults.buttonColors(containerColor = SkyPrimary),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(50.dp)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(color = TextPrimary, modifier = Modifier.size(20.dp))
                } else {
                    Text("Complete Pairing", fontWeight = FontWeight.SemiBold)
                }
            }

            TextButton(onClick = onBack) {
                Text("Cancel", color = TextSecondary)
            }
        }
    }
}
