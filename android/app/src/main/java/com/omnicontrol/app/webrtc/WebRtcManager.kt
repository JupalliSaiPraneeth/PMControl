package com.omnicontrol.app.webrtc

import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.os.BatteryManager
import android.util.DisplayMetrics
import android.view.WindowManager
import com.omnicontrol.app.service.OmniAccessibilityService
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import org.webrtc.*

class WebRtcManager(private val context: Context) {

    private val rootEglBase: EglBase = EglBase.create()
    private var socket: Socket? = null
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var videoCapturer: VideoCapturer? = null
    private var videoTrack: VideoTrack? = null
    private var audioTrack: AudioTrack? = null
    private var currentSessionId: String? = null
    private var currentDeviceId: String? = null

    fun initialize(signalingUrl: String, sessionId: String, deviceId: String) {
        this.currentSessionId = sessionId
        this.currentDeviceId = deviceId

        // Initialize PeerConnectionFactory globals
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(false)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)

        val factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(rootEglBase.eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(rootEglBase.eglBaseContext))
            .createPeerConnectionFactory()
        peerConnectionFactory = factory

        // Initialize Socket.IO connection
        val opts = IO.Options().apply {
            transports = arrayOf("websocket", "polling")
        }
        val s = IO.socket(signalingUrl, opts)
        socket = s

        s.on(Socket.EVENT_CONNECT) {
            val joinPayload = JSONObject().apply {
                put("sessionId", sessionId)
                put("role", "device")
                put("deviceId", deviceId)
            }
            s.emit("session:join", joinPayload)
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

        // Capture at 720p or display resolution at 30 fps
        val width = 720
        val height = (720f * (metrics.heightPixels.toFloat() / metrics.widthPixels.toFloat())).toInt()
        capturer.startCapture(width, height, 30)

        val vTrack = factory.createVideoTrack("ARDAMSv0", videoSource)
        videoTrack = vTrack

        // 2. Setup Microphone Audio Track
        val audioSource = factory.createAudioSource(MediaConstraints())
        val aTrack = factory.createAudioTrack("ARDAMSa0", audioSource)
        audioTrack = aTrack

        // 3. Create PeerConnection
        val iceServers = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
        )
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
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
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {}
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

        // Create SDP Offer
        val mediaConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
        }

        pc?.createOffer(object : SimpleSdpObserver() {
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

    fun sendDeviceStatus() {
        val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val batteryPct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 80

        val payload = JSONObject().apply {
            put("batteryLevel", batteryPct)
            put("networkType", "Wi-Fi")
            put("isCharging", false)
        }
        socket?.emit("device:status", payload)
    }

    fun stop() {
        try {
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
            e.printStackTrace()
        }
    }

    open class SimpleSdpObserver : SdpObserver {
        override fun onCreateSuccess(desc: SessionDescription?) {}
        override fun onSetSuccess() {}
        override fun onCreateFailure(err: String?) {}
        override fun onSetFailure(err: String?) {}
    }
}
