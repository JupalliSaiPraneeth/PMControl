package com.omnicontrol.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val SkyPrimary = Color(0xFF0EA5E9)
val SkyPrimaryVariant = Color(0xFF0284C7)
val SlateBackground = Color(0xFF020617)
val SlateSurface = Color(0xFF0F172A)
val SlateBorder = Color(0xFF1E293B)
val TextPrimary = Color(0xFFF8FAFC)
val TextSecondary = Color(0xFF94A3B8)
val EmeraldSuccess = Color(0xFF10B981)
val RoseError = Color(0xFFF43F5E)
val AmberWarning = Color(0xFFF59E0B)

private val DarkColorScheme = darkColorScheme(
    primary = SkyPrimary,
    onPrimary = Color.White,
    primaryContainer = SkyPrimaryVariant,
    background = SlateBackground,
    surface = SlateSurface,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    error = RoseError,
)

@Composable
fun OmniControlTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
