package com.omnicontrol.app.webrtc

import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.BatteryManager
import android.os.Build
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import com.omnicontrol.app.service.OmniAccessibilityService
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.*

class WebRtcManager(private val context: Context) {

    companion object {
        private const val TAG = "WebRtcManager"
    }

    private val rootEglBase: EglBase = EglBase.create()
    private var socket: Socket? = null
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var videoCapturer: VideoCapturer? = null
    private var videoTrack: VideoTrack? = null
    private var audioTrack: AudioTrack? = null
    private var currentSessionId: String? = null
    private var currentDeviceId: String? = null
    private var dynamicIceServers: MutableList<PeerConnection.IceServer> = mutableListOf()
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var isMicMuted: Boolean = false

    fun initialize(signalingUrl: String, sessionId: String, deviceId: String) {
        this.currentSessionId = sessionId
        this.currentDeviceId = deviceId

        // Default fallback STUN servers
        dynamicIceServers.clear()
        dynamicIceServers.add(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
        )
        dynamicIceServers.add(
            PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer()
        )

        // 1. Initialize PeerConnectionFactory globals
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(false)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)

        val factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(rootEglBase.eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(rootEglBase.eglBaseContext))
            .createPeerConnectionFactory()
        peerConnectionFactory = factory

        // 2. Initialize Socket.IO connection
        val opts = IO.Options().apply {
            transports = arrayOf("websocket", "polling")
            reconnection = true
            reconnectionAttempts = 10
            reconnectionDelay = 1000
            reconnectionDelayMax = 5000
        }
        val s = IO.socket(signalingUrl, opts)
        socket = s

        s.on(Socket.EVENT_CONNECT) {
            Log.d(TAG, "Connected to signaling server")
            val joinPayload = JSONObject().apply {
                put("sessionId", sessionId)
                put("role", "device")
                put("deviceId", deviceId)
            }
            s.emit("session:join", joinPayload, io.socket.client.Ack { args ->
                if (args != null && args.isNotEmpty()) {
                    val resp = args[0] as? JSONObject
                    resp?.optJSONArray("iceServers")?.let { iceArr ->
                        parseIceServers(iceArr)
                    }
                }
            })
            sendDeviceStatus()
        }

        // WebRTC Signaling Handlers
        s.on("webrtc:offer") { args ->
            val payload = args[0] as JSONObject
            val sdpObj = payload.getJSONObject("sdp")
            val sdp = SessionDescription(
                SessionDescription.Type.OFFER,
                sdpObj.getString("sdp")
            )
            peerConnection?.setRemoteDescription(object : SimpleSdpObserver() {
                override fun onSetSuccess() {
                    peerConnection?.createAnswer(object : SimpleSdpObserver() {
                        override fun onCreateSuccess(answer: SessionDescription?) {
                            answer?.let {
                                peerConnection?.setLocalDescription(SimpleSdpObserver(), it)
                                val ansPayload = JSONObject().apply {
                                    val ansObj = JSONObject().apply {
                                        put("type", "answer")
                                        put("sdp", it.description)
                                    }
                                    put("sdp", ansObj)
                                }
                                s.emit("webrtc:answer", ansPayload)
                            }
                        }
                    }, MediaConstraints())
                }
            }, sdp)
        }

        s.on("webrtc:answer") { args ->
            val payload = args[0] as JSONObject
            val sdpObj = payload.getJSONObject("sdp")
            val sdp = SessionDescription(
                SessionDescription.Type.ANSWER,
                sdpObj.getString("sdp")
            )
            peerConnection?.setRemoteDescription(SimpleSdpObserver(), sdp)
        }

        s.on("webrtc:ice-candidate") { args ->
            val payload = args[0] as JSONObject
            val candObj = payload.getJSONObject("candidate")
            val candidate = IceCandidate(
                candObj.getString("sdpMid"),
                candObj.getInt("sdpMLineIndex"),
                candObj.getString("candidate")
            )
            peerConnection?.addIceCandidate(candidate)
        }

        // Cross-network ICE restart listener
        s.on("webrtc:ice-restart") {
            Log.d(TAG, "Controller requested ICE restart. Performing negotiation...")
            triggerIceRestart()
        }

        // Authorized Remote Control Execution Handler
        s.on("control:execute") { args ->
            val action = args[0] as JSONObject
            when (action.getString("type")) {
                "tap" -> {
                    val x = action.getDouble("x").toFloat()
                    val y = action.getDouble("y").toFloat()
                    OmniAccessibilityService.executeTap(x, y)
                }
                "swipe" -> {
                    val startX = action.getDouble("startX").toFloat()
                    val startY = action.getDouble("startY").toFloat()
                    val endX = action.getDouble("endX").toFloat()
                    val endY = action.getDouble("endY").toFloat()
                    val duration = action.optLong("durationMs", 300)
                    OmniAccessibilityService.executeSwipe(startX, startY, endX, endY, duration)
                }
                "key" -> {
                    val keyAction = action.getString("action")
                    OmniAccessibilityService.executeKey(keyAction)
                }
            }
        }

        s.connect()

        // 3. Register Network Change Monitor for automatic Wi-Fi / Cellular recovery
        registerNetworkCallback()
    }

    private fun parseIceServers(jsonArray: JSONArray) {
        val parsed = mutableListOf<PeerConnection.IceServer>()
        for (i in 0 until jsonArray.length()) {
            val serverObj = jsonArray.getJSONObject(i)
            val urls = serverObj.opt("urls")
            val username = serverObj.optString("username", "")
            val credential = serverObj.optString("credential", "")

            val urlList = mutableListOf<String>()
            when (urls) {
                is JSONArray -> {
                    for (j in 0 until urls.length()) {
                        urlList.add(urls.getString(j))
                    }
                }
                is String -> urlList.add(urls)
            }

            for (url in urlList) {
                val builder = PeerConnection.IceServer.builder(url)
                if (username.isNotEmpty()) builder.setUsername(username)
                if (credential.isNotEmpty()) builder.setPassword(credential)
                parsed.add(builder.createIceServer())
            }
        }

        if (parsed.isNotEmpty()) {
            dynamicIceServers = parsed
            Log.d(TAG, "Loaded ${dynamicIceServers.size} ICE servers (STUN & TURN relay).")
        }
    }

    fun startScreenCapture(resultCode: Int, resultData: Intent) {
        val factory = peerConnectionFactory ?: return

        // 1. Setup Video Capturer using ScreenCapturerAndroid
        val capturer = ScreenCapturerAndroid(resultData, object : MediaProjection.Callback() {
            override fun onStop() {
                super.onStop()
                stop()
            }
        })
        videoCapturer = capturer

        val surfaceTextureHelper = SurfaceTextureHelper.create("ScreenCaptureThread", rootEglBase.eglBaseContext)
        val videoSource = factory.createVideoSource(true)
        capturer.initialize(surfaceTextureHelper, context, videoSource.capturerObserver)

        // Determine screen dimensions
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)

        // Capture at 720p at 30 fps
        val width = 720
        val height = (720f * (metrics.heightPixels.toFloat() / metrics.widthPixels.toFloat())).toInt()
        capturer.startCapture(width, height, 30)

        val vTrack = factory.createVideoTrack("ARDAMSv0", videoSource)
        videoTrack = vTrack

        // 2. Setup Microphone Audio Track with Opus configuration
        val audioConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("googEchoCancellation", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("googAutoGainControl", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("googHighpassFilter", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("googNoiseSuppression", "true"))
        }
        val audioSource = factory.createAudioSource(audioConstraints)
        val aTrack = factory.createAudioTrack("ARDAMSa0", audioSource)
        audioTrack = aTrack

        // 3. Create PeerConnection with STUN + TURN configurations
        val rtcConfig = PeerConnection.RTCConfiguration(dynamicIceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
            iceTransportsType = PeerConnection.IceTransportsType.ALL
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
        }

        val pc = factory.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate?.let {
                    val payload = JSONObject().apply {
                        val candObj = JSONObject().apply {
                            put("sdpMid", it.sdpMid)
                            put("sdpMLineIndex", it.sdpMLineIndex)
                            put("candidate", it.sdp)
                        }
                        put("candidate", candObj)
                    }
                    socket?.emit("webrtc:ice-candidate", payload)
                }
            }
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {
                Log.d(TAG, "SignalingState: $state")
            }
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                Log.d(TAG, "IceConnectionState: $state")
                if (state == PeerConnection.IceConnectionState.DISCONNECTED || state == PeerConnection.IceConnectionState.FAILED) {
                    Log.w(TAG, "ICE disconnected/failed. Requesting ICE restart recovery...")
                    triggerIceRestart()
                }
            }
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {}
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onAddStream(stream: MediaStream?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(channel: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {}
        })
        peerConnection = pc

        // Add Tracks
        pc?.addTrack(vTrack, listOf("ARDAMS"))
        pc?.addTrack(aTrack, listOf("ARDAMS"))

        // Create initial SDP Offer
        createAndSendOffer(iceRestart = false)

        // Notify signaling that voice transmission is active
        notifyVoiceState("active")
    }

    fun triggerIceRestart() {
        createAndSendOffer(iceRestart = true)
    }

    private fun createAndSendOffer(iceRestart: Boolean) {
        val pc = peerConnection ?: return
        val mediaConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
            if (iceRestart) {
                mandatory.add(MediaConstraints.KeyValuePair("IceRestart", "true"))
            }
        }

        pc.createOffer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(desc: SessionDescription?) {
                desc?.let {
                    pc.setLocalDescription(SimpleSdpObserver(), it)
                    val offerPayload = JSONObject().apply {
                        val sdpObj = JSONObject().apply {
                            put("type", "offer")
                            put("sdp", it.description)
                        }
                        put("sdp", sdpObj)
                    }
                    socket?.emit("webrtc:offer", offerPayload)
                }
            }
        }, mediaConstraints)
    }

    fun setMicrophoneMuted(muted: Boolean) {
        this.isMicMuted = muted
        audioTrack?.setEnabled(!muted)
        notifyVoiceState(if (muted) "muted" else "active")
        Log.d(TAG, "Microphone muted state set to: $muted")
    }

    fun stopVoiceTransmission() {
        audioTrack?.setEnabled(false)
        notifyVoiceState("stopped")
        Log.d(TAG, "Microphone transmission stopped by device owner.")
    }

    private fun notifyVoiceState(state: String) {
        val payload = JSONObject().apply {
            put("state", state)
        }
        socket?.emit("voice:state-change", payload)
    }

    private fun registerNetworkCallback() {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        val builder = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)

        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                Log.d(TAG, "Network became available. Updating status & checking ICE route...")
                sendDeviceStatus()
                triggerIceRestart()
            }

            override fun onLost(network: Network) {
                Log.w(TAG, "Network lost. Waiting for alternative connection...")
            }
        }
        networkCallback = callback
        cm.registerNetworkCallback(builder.build(), callback)
    }

    fun sendDeviceStatus() {
        val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val batteryPct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 80

        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val activeNetwork = cm?.activeNetwork
        val caps = cm?.getNetworkCapabilities(activeNetwork)
        val networkType = when {
            caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true -> "Wi-Fi"
            caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true -> "Mobile Data"
            else -> "Unknown"
        }

        val payload = JSONObject().apply {
            put("batteryLevel", batteryPct)
            put("networkType", networkType)
            put("isCharging", false)
        }
        socket?.emit("device:status", payload)
    }

    fun stop() {
        try {
            stopVoiceTransmission()

            networkCallback?.let {
                val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                cm?.unregisterNetworkCallback(it)
                networkCallback = null
            }

            videoCapturer?.stopCapture()
            videoCapturer?.dispose()
            videoCapturer = null

            videoTrack?.dispose()
            audioTrack?.dispose()

            peerConnection?.close()
            peerConnection?.dispose()
            peerConnection = null

            socket?.disconnect()
            socket?.close()
            socket = null
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping WebRtcManager", e)
        }
    }

    open class SimpleSdpObserver : SdpObserver {
        override fun onCreateSuccess(desc: SessionDescription?) {}
        override fun onSetSuccess() {}
        override fun onCreateFailure(err: String?) {}
        override fun onSetFailure(err: String?) {}
    }
}
