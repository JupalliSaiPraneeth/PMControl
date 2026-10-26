import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Activity,
  ArrowLeft,
  Circle,
  Square,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../services/api.js';
import { signaling } from '../services/socket.js';
import { useAuth } from '../context/AuthContext.js';
import { Device, RemoteSession } from '../types/index.js';

export const RemoteSessionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const deviceIdParam = searchParams.get('deviceId');

  const [session, setSession] = useState<RemoteSession | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Video and audio references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Gesture drag tracking
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Terminate session cleanly
  const handleTerminateSession = useCallback(async (reason: string = 'User terminated') => {
    try {
      if (session) {
        await api.endSession(session.id);
        signaling.endSession(reason);
      }
    } catch (e) {
      console.warn('Error ending session API:', e);
    } finally {
      // Clean up WebRTC tracks and connection
      localAudioTrackRef.current?.stop();
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      signaling.disconnect();
      navigate('/history');
    }
  }, [session, navigate]);

  // Initialize Session and WebRTC
  useEffect(() => {
    let isCancelled = false;

    async function initSession() {
      try {
        if (!deviceIdParam) {
          setErrorMsg('No device specified. Please select an enrolled device to start a session.');
          return;
        }

        // 1. Request or fetch active session
        const newSession = await api.requestSession(deviceIdParam);
        if (isCancelled) return;
        setSession(newSession);

        // Fetch device details
        const devices = await api.getDevices();
        const curDevice = devices.find((d) => d.id === deviceIdParam) || null;
        setDevice(curDevice);

        // 2. Connect to Socket.IO signaling
        signaling.connect();
        const joined = await signaling.joinSession(newSession.id, user?.id || 'controller');
        if (!joined) {
          throw new Error('Failed to join authorized signaling room.');
        }

        // 3. Initialize RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
          ],
        });
        peerConnectionRef.current = pc;

        // Remote media track handlers
        pc.ontrack = (event) => {
          console.log('[WebRTC] Received remote track:', event.track.kind);
          if (event.track.kind === 'video' && videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
          }
          if (event.track.kind === 'audio' && audioRef.current) {
            audioRef.current.srcObject = event.streams[0];
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            signaling.sendIceCandidate(event.candidate);
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('[WebRTC] Connection state:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setConnectionState('connected');
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setConnectionState('disconnected');
          }
        };

        // Signaling message listeners
        signaling.onOffer(async ({ sdp }) => {
          if (!peerConnectionRef.current) return;
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          signaling.sendAnswer(answer);
        });

        signaling.onAnswer(async ({ sdp }) => {
          if (!peerConnectionRef.current) return;
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        });

        signaling.onIceCandidate(async ({ candidate }) => {
          if (!peerConnectionRef.current) return;
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('[WebRTC] Error adding ICE candidate', e);
          }
        });

        signaling.onSessionTerminated(() => {
          alert('Session has been terminated by the Android device.');
          handleTerminateSession('Device terminated session');
        });

      } catch (err: any) {
        if (!isCancelled) {
          setErrorMsg(err.message || 'Failed to initialize remote session');
        }
      }
    }

    initSession();

    return () => {
      isCancelled = true;
      localAudioTrackRef.current?.stop();
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
    };
  }, [deviceIdParam, user, handleTerminateSession]);

  // Remote Touch & Swipe Interaction on the phone viewport
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    dragStartRef.current = { x, y, time: Date.now() };
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!viewportRef.current || !dragStartRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const endX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const endY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const start = dragStartRef.current;
    const distance = Math.hypot(endX - start.x, endY - start.y);
    const duration = Math.min(2000, Date.now() - start.time);

    if (distance < 0.03) {
      // Tap gesture
      await signaling.sendControlAction({
        type: 'tap',
        x: Number(endX.toFixed(3)),
        y: Number(endY.toFixed(3)),
      });
    } else {
      // Swipe gesture
      await signaling.sendControlAction({
        type: 'swipe',
        startX: Number(start.x.toFixed(3)),
        startY: Number(start.y.toFixed(3)),
        endX: Number(endX.toFixed(3)),
        endY: Number(endY.toFixed(3)),
        durationMs: Math.max(100, duration),
      });
    }

    dragStartRef.current = null;
  };

  // Dispatch Android system navigation keys
  const handleKeyAction = async (action: 'back' | 'home' | 'recent_apps' | 'volume_up' | 'volume_down') => {
    await signaling.sendControlAction({ type: 'key', action });
  };

  // Toggle Two-Way Mic from Dashboard
  const handleToggleMic = async () => {
    try {
      if (!isMicMuted && localAudioTrackRef.current) {
        localAudioTrackRef.current.enabled = false;
        setIsMicMuted(true);
      } else if (localAudioTrackRef.current) {
        localAudioTrackRef.current.enabled = true;
        setIsMicMuted(false);
      } else {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = stream.getAudioTracks()[0];
        localAudioTrackRef.current = audioTrack;
        if (peerConnectionRef.current) {
          peerConnectionRef.current.addTrack(audioTrack, stream);
        }
        setIsMicMuted(false);
      }
    } catch (e: any) {
      alert('Could not access microphone: ' + e.message);
    }
  };

  // Toggle Speaker Playback
  const handleToggleSpeaker = () => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setIsSpeakerMuted(audioRef.current.muted);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      viewportRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  if (errorMsg) {
    return (
      <div className="max-w-2xl mx-auto my-12 glass-panel p-8 rounded-2xl border border-rose-800/60 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-100">Session Initialization Notice</h2>
        <p className="text-sm text-slate-300">{errorMsg}</p>
        <button
          onClick={() => navigate('/devices')}
          className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-semibold transition"
        >
          Return to Devices
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-5rem)] space-y-4">
      {/* Top Session Bar */}
      <div className="glass-panel rounded-2xl px-5 py-3 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">{device?.displayName || 'Android Device'}</h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  connectionState === 'connected'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${connectionState === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {connectionState === 'connected' ? 'Screen Stream Live' : 'Waiting for Consent'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Session ID: {session?.id.substring(0, 8)}... • WebRTC E2EE
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Audio Controls */}
          <button
            onClick={handleToggleMic}
            className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition ${
              isMicMuted
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle Controller Microphone (Two-Way Audio)"
          >
            {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="hidden sm:inline">{isMicMuted ? 'Mic Off' : 'Mic On'}</span>
          </button>

          <button
            onClick={handleToggleSpeaker}
            className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition ${
              isSpeakerMuted
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
            title="Mute Device Audio"
          >
            {isSpeakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* End Session Button */}
          <button
            onClick={() => handleTerminateSession('Controller ended session')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/25 transition"
          >
            <PhoneOff className="w-4 h-4" />
            End Session
          </button>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative">
        {/* Device Frame */}
        <div
          ref={viewportRef}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          className="relative h-full max-h-[820px] aspect-[9/19.5] bg-black rounded-[2.5rem] p-3 border-4 border-slate-800 shadow-2xl phone-viewport flex flex-col select-none touch-none overflow-hidden cursor-crosshair group"
        >
          {/* Top Notch / Speaker Ear */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-900 rounded-full z-20 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-slate-950 border border-slate-800 mr-2" />
            <div className="w-8 h-1 bg-slate-800 rounded-full" />
          </div>

          {/* Video Stream Element */}
          <div className="relative flex-1 bg-slate-950 rounded-[2rem] overflow-hidden flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* Waiting Overlay if stream not yet active */}
            {connectionState !== 'connected' && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-sky-500/20 border-2 border-sky-500/40 animate-ping absolute inset-0" />
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-sky-500 flex items-center justify-center relative">
                    <Activity className="w-8 h-8 text-sky-400" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-100">Awaiting Android Consent</h4>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Please approve the remote screen sharing prompt on your Android device to begin live stream.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Hidden Audio Element for remote sound */}
          <audio ref={audioRef} autoPlay />

          {/* Android On-Screen Soft Navigation Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="h-11 mt-1 bg-slate-900/90 rounded-b-[2rem] flex items-center justify-around px-8 text-slate-400 border-t border-slate-800/80 z-20"
          >
            <button
              onClick={() => handleKeyAction('back')}
              className="p-2 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleKeyAction('home')}
              className="p-2 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Home"
            >
              <Circle className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleKeyAction('recent_apps')}
              className="p-2 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Recent Apps"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
