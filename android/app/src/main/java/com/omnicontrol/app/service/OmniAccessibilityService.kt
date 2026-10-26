package com.omnicontrol.app.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Build
import android.util.DisplayMetrics
import android.view.accessibility.AccessibilityEvent
import com.omnicontrol.app.session.SessionManager

class OmniAccessibilityService : AccessibilityService() {

    companion object {
        private var instance: OmniAccessibilityService? = null

        fun isServiceRunning(): Boolean = instance != null

        fun executeTap(normalizedX: Float, normalizedY: Float): Boolean {
            val service = instance ?: return false
            if (!SessionManager.isSessionActive()) return false

            val metrics = service.resources.displayMetrics
            val pixelX = (normalizedX * metrics.widthPixels).coerceIn(0f, metrics.widthPixels.toFloat())
            val pixelY = (normalizedY * metrics.heightPixels).coerceIn(0f, metrics.heightPixels.toFloat())

            val path = Path().apply {
                moveTo(pixelX, pixelY)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val gesture = GestureDescription.Builder()
                    .addStroke(GestureDescription.StrokeDescription(path, 0, 50))
                    .build()
                return service.dispatchGesture(gesture, null, null)
            }
            return false
        }

        fun executeSwipe(
            startNormX: Float,
            startNormY: Float,
            endNormX: Float,
            endNormY: Float,
            durationMs: Long
        ): Boolean {
            val service = instance ?: return false
            if (!SessionManager.isSessionActive()) return false

            val metrics = service.resources.displayMetrics
            val startX = (startNormX * metrics.widthPixels).coerceIn(0f, metrics.widthPixels.toFloat())
            val startY = (startNormY * metrics.heightPixels).coerceIn(0f, metrics.heightPixels.toFloat())
            val endX = (endNormX * metrics.widthPixels).coerceIn(0f, metrics.widthPixels.toFloat())
            val endY = (endNormY * metrics.heightPixels).coerceIn(0f, metrics.heightPixels.toFloat())

            val path = Path().apply {
                moveTo(startX, startY)
                lineTo(endX, endY)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val gesture = GestureDescription.Builder()
                    .addStroke(GestureDescription.StrokeDescription(path, 0, durationMs.coerceIn(50, 2000)))
                    .build()
                return service.dispatchGesture(gesture, null, null)
            }
            return false
        }

        fun executeKey(action: String): Boolean {
            val service = instance ?: return false
            if (!SessionManager.isSessionActive()) return false

            return when (action) {
                "back" -> service.performGlobalAction(GLOBAL_ACTION_BACK)
                "home" -> service.performGlobalAction(GLOBAL_ACTION_HOME)
                "recent_apps" -> service.performGlobalAction(GLOBAL_ACTION_RECENTS)
                else -> false
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We do not inspect accessibility events, avoiding logging of private content
    }

    override fun onInterrupt() {
        instance = null
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }
}
