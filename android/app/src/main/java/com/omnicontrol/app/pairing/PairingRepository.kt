package com.omnicontrol.app.pairing

import android.content.Context
import android.os.Build
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

val Context.dataStore by preferencesDataStore(name = "omnicontrol_prefs")

class PairingRepository(private val context: Context) {

    private val client = OkHttpClient()

    companion object {
        val KEY_DEVICE_ID = stringPreferencesKey("device_id")
        val KEY_DEVICE_NAME = stringPreferencesKey("device_name")
        val KEY_SERVER_URL = stringPreferencesKey("server_url")
        const val DEFAULT_SERVER_URL = "http://10.0.2.2:4000" // Emulator localhost alias
    }

    suspend fun getDeviceId(): String? {
        val prefs = context.dataStore.data.first()
        return prefs[KEY_DEVICE_ID]
    }

    suspend fun getServerUrl(): String {
        val prefs = context.dataStore.data.first()
        return prefs[KEY_SERVER_URL] ?: DEFAULT_SERVER_URL
    }

    suspend fun setServerUrl(url: String) {
        context.dataStore.edit { prefs ->
            prefs[KEY_SERVER_URL] = url
        }
    }

    suspend fun enrollDeviceWithCode(
        serverUrl: String,
        code: String,
        deviceDisplayName: String = "${Build.MANUFACTURER} ${Build.MODEL}"
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            val jsonBody = JSONObject().apply {
                put("pairingCode", code)
                put("deviceDisplayName", deviceDisplayName)
                put("appVersion", "1.0.0")
            }

            val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("$serverUrl/api/v1/devices/pairing/complete")
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()
            val responseString = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                val errorMsg = try {
                    JSONObject(responseString).getJSONObject("error").getString("message")
                } catch (e: Exception) {
                    "Pairing failed with status: ${response.code}"
                }
                return@withContext Result.failure(Exception(errorMsg))
            }

            val root = JSONObject(responseString)
            val deviceId = root.getJSONObject("data").getJSONObject("device").getString("id")

            // Store credentials securely in DataStore
            context.dataStore.edit { prefs ->
                prefs[KEY_DEVICE_ID] = deviceId
                prefs[KEY_DEVICE_NAME] = deviceDisplayName
                prefs[KEY_SERVER_URL] = serverUrl
            }

            Result.success(deviceId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun clearEnrollment() {
        context.dataStore.edit { prefs ->
            prefs.remove(KEY_DEVICE_ID)
            prefs.remove(KEY_DEVICE_NAME)
        }
    }
}
