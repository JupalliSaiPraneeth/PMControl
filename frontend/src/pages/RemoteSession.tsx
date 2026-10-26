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
  Radio,
  RefreshCw,
  Info,
} from 'lucide-react';
import { api } from '../services/api.js';
import { signaling } from '../services/socket.js';
import { useAuth } from '../context/AuthContext.js';
import { Device, RemoteSession } from '../types/index.js';

export type ConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'AUTHENTICATING'
  | 'AWAITING_DEVICE_APPROVAL'
  | 'ESTABLISHING_WEBRTC'
  | 'CONNECTED'
  | 'VOICE_TRANSMISSION_ACTIVE'
  | 'RECONNECTING'
  | 'VOICE_STOPPED';

interface ConnectionDiagnostics {
  candidateType: 'direct-p2p' | 'turn-relay' | 'discovering';
  protocol: 'udp' | 'tcp' | 'tls' | 'unknown';
  rttMs: number;
  packetLossPercent: number;
  audioBitrateKbps: number;
  iceState: RTCIceConnectionState;
}

export const RemoteSessionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const deviceIdParam = searchParams.get('deviceId');

  const [session, setSession] = useState<RemoteSession | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('CONNECTING');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [speakerVolume, setSpeakerVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics>({
    candidateType: 'discovering',
    protocol: 'unknown',
    rttMs: 0,
    packetLossPercent: 0,
    audioBitrateKbps: 0,
    iceState: 'new',
  });

  // Video and audio references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const statsIntervalRef = useRef<any>(null);

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
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      localAudioTrackRef.current?.stop();
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      signaling.disconnect();
      setConnectionState('DISCONNECTED');
      navigate('/history');
    }
  }, [session, navigate]);

  // Handle controlled ICE restart
  const handleTriggerIceRestart = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      setConnectionState('RECONNECTING');
      console.log('[WebRTC] Initiating ICE Restart for cross-network recovery...');
      signaling.sendIceRestart();
      if ('restartIce' in pc) {
        (pc as any).restartIce();
      }
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      signaling.sendOffer(offer);
    } catch (err) {
      console.warn('[WebRTC] ICE restart error:', err);
    }
  }, []);

  // Poll WebRTC real-time connection stats (RTT, candidate type, packet loss)
  const pollWebRtcStats = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      const stats = await pc.getStats();
      let rtt = 0;
      let candidateType: 'direct-p2p' | 'turn-relay' | 'discovering' = 'discovering';
      let protocol: 'udp' | 'tcp' | 'tls' | 'unknown' = 'unknown';
      let packetLoss = 0;
      let bitrate = 0;

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          rtt = Math.round((report.currentRoundTripTime || 0) * 1000);
          const remoteCandidate = stats.get(report.remoteCandidateId);
          if (remoteCandidate) {
            protocol = remoteCandidate.protocol?.toLowerCase() || 'udp';
            if (remoteCandidate.candidateType === 'relay') {
              candidateType = 'turn-relay';
            } else {
              candidateType = 'direct-p2p';
            }
          }
        }
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          const packetsLost = report.packetsLost || 0;
          const packetsReceived = report.packetsReceived || 1;
          packetLoss = Math.min(100, Math.round((packetsLost / (packetsLost + packetsReceived)) * 100));
          bitrate = Math.round(((report.bytesReceived || 0) * 8) / 1000 / Math.max(1, (report.timestamp - (report.lastPacketReceivedTimestamp || report.timestamp)) || 1));
        }
      });

      setDiagnostics((prev) => ({
        ...prev,
        candidateType: candidateType !== 'discovering' ? candidateType : prev.candidateType,
        protocol: protocol !== 'unknown' ? protocol : prev.protocol,
        rttMs: rtt || prev.rttMs,
        packetLossPercent: packetLoss,
        audioBitrateKbps: bitrate || prev.audioBitrateKbps,
        iceState: pc.iceConnectionState,
      }));
    } catch (e) {
      // Ignore transient stats errors
    }
  }, []);

  // Initialize Session and WebRTC
  useEffect(() => {
    let isCancelled = false;

    async function initSession() {
      try {
        if (!deviceIdParam) {
          setErrorMsg('No device specified. Please select an enrolled device to start a session.');
          return;
        }

        setConnectionState('AUTHENTICATING');

        // 1. Request or fetch active session
        const newSession = await api.requestSession(deviceIdParam);
        if (isCancelled) return;
        setSession(newSession);

        // Fetch device details
        const devices = await api.getDevices();
        const curDevice = devices.find((d) => d.id === deviceIdParam) || null;
        setDevice(curDevice);

        setConnectionState('AWAITING_DEVICE_APPROVAL');

        // 2. Fetch dynamic STUN & TURN servers
        let iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
        try {
          const iceRes = await api.getIceServers();
          if (iceRes?.iceServers && iceRes.iceServers.length > 0) {
            iceServers = iceRes.iceServers;
          }
        } catch (e) {
          console.warn('[WebRTC] Falling back to default STUN list:', e);
        }

        // 3. Connect to Socket.IO signaling
        signaling.connect();
        const joinRes = await signaling.joinSession(newSession.id, user?.id || 'controller');
        if (!joinRes.ok) {
          throw new Error(joinRes.error || 'Failed to join authorized signaling room.');
        }

        // Use servers returned from signaling handshake if provided
        if (joinRes.iceServers && joinRes.iceServers.length > 0) {
          iceServers = joinRes.iceServers;
        }

        setConnectionState('ESTABLISHING_WEBRTC');

        // 4. Initialize RTCPeerConnection with STUN & TURN relay support
        const pc = new RTCPeerConnection({
          iceServers,
          iceTransportPolicy: 'all',
          bundlePolicy: 'max-bundle',
        });
        peerConnectionRef.current = pc;

        // Remote media track handlers
        pc.ontrack = (event) => {
          console.log('[WebRTC] Received remote media track:', event.track.kind);
          if (event.track.kind === 'video' && videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
          }
          if (event.track.kind === 'audio' && audioRef.current) {
            audioRef.current.srcObject = event.streams[0];
            setConnectionState('VOICE_TRANSMISSION_ACTIVE');
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            signaling.sendIceCandidate(event.candidate);
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log('[WebRTC] ICE Connection State:', pc.iceConnectionState);
          setDiagnostics((d) => ({ ...d, iceState: pc.iceConnectionState }));

          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            reconnectAttemptsRef.current = 0;
            setConnectionState((prev) =>
              prev === 'VOICE_STOPPED' ? 'VOICE_STOPPED' : 'CONNECTED'
            );
          } else if (pc.iceConnectionState === 'disconnected') {
            setConnectionState('RECONNECTING');
            // Try bounded reconnection
            if (reconnectAttemptsRef.current < 5) {
              reconnectAttemptsRef.current += 1;
              const delay = Math.min(5000, 1000 * Math.pow(1.5, reconnectAttemptsRef.current));
              setTimeout(() => handleTriggerIceRestart(), delay);
            }
          } else if (pc.iceConnectionState === 'failed') {
            setConnectionState('RECONNECTING');
            handleTriggerIceRestart();
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('[WebRTC] Peer Connection State:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setConnectionState((prev) =>
              prev === 'VOICE_STOPPED' ? 'VOICE_STOPPED' : 'CONNECTED'
            );
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setConnectionState('RECONNECTING');
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
            console.warn('[WebRTC] Error adding ICE candidate:', e);
          }
        });

        signaling.onIceRestart(() => {
          console.log('[WebRTC] Remote peer requested ICE restart.');
          handleTriggerIceRestart();
        });

        signaling.onVoiceStateUpdate(({ state }) => {
          console.log('[WebRTC] Voice state updated by device:', state);
          if (state === 'active') {
            setConnectionState('VOICE_TRANSMISSION_ACTIVE');
          } else if (state === 'stopped') {
            setConnectionState('VOICE_STOPPED');
          }
        });

        signaling.onSessionTerminated(() => {
          alert('Session has been terminated by the Android device.');
          handleTerminateSession('Device terminated session');
        });

        // Start stats reporting loop
        statsIntervalRef.current = setInterval(pollWebRtcStats, 1500);

      } catch (err: any) {
        if (!isCancelled) {
          setErrorMsg(err.message || 'Failed to initialize remote session');
          setConnectionState('DISCONNECTED');
        }
      }
    }

    initSession();

    return () => {
      isCancelled = true;
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      localAudioTrackRef.current?.stop();
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
    };
  }, [deviceIdParam, user, handleTerminateSession, handleTriggerIceRestart, pollWebRtcStats]);

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

  // Adjust Volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSpeakerVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val === 0) {
        setIsSpeakerMuted(true);
      } else if (isSpeakerMuted) {
        setIsSpeakerMuted(false);
        audioRef.current.muted = false;
      }
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

  // Format connection badge details
  const renderConnectionBadge = () => {
    switch (connectionState) {
      case 'VOICE_TRANSMISSION_ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Live Voice Active
          </span>
        );
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            WebRTC Connected
          </span>
        );
      case 'RECONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
            Reconnecting Network...
          </span>
        );
      case 'VOICE_STOPPED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-700 text-slate-300 border border-slate-600">
            Voice Stopped by Device
          </span>
        );
      case 'AWAITING_DEVICE_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30">
            Awaiting Android Consent
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            {connectionState}
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-5rem)] space-y-4">
      {/* Top Session Bar */}
      <div className="glass-panel rounded-2xl px-5 py-3 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">{device?.displayName || 'Android Device'}</h2>
              {renderConnectionBadge()}
              {diagnostics.candidateType === 'turn-relay' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  TURN Relay
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Session: {session?.id.substring(0, 8)}... • {diagnostics.candidateType.toUpperCase()} ({diagnostics.protocol.toUpperCase()}) • RTT: {diagnostics.rttMs}ms
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Diagnostics Toggle */}
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={`p-2.5 rounded-xl border text-xs font-medium transition ${
              showDiagnostics
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle Network & Audio Diagnostics"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Controller Mic Toggle */}
          <button
            onClick={handleToggleMic}
            className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition ${
              isMicMuted
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle Controller Microphone (Two-Way Voice)"
          >
            {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="hidden sm:inline">{isMicMuted ? 'Muted' : 'Talk'}</span>
          </button>

          {/* Speaker Controls & Volume Slider */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl px-2 py-1 gap-2">
            <button
              onClick={handleToggleSpeaker}
              className="p-1.5 text-slate-300 hover:text-white transition"
              title="Toggle Live Audio Playback"
            >
              {isSpeakerMuted || speakerVolume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isSpeakerMuted ? 0 : speakerVolume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              title="Speaker Volume"
            />
          </div>

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

      {/* Diagnostics Panel (Collapsible) */}
      {showDiagnostics && (
        <div className="glass-panel rounded-2xl p-4 border border-sky-500/30 bg-slate-900/95 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs animate-in fade-in">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Transport</span>
            <span className="font-mono text-slate-200 font-semibold">{diagnostics.candidateType}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Protocol</span>
            <span className="font-mono text-slate-200 font-semibold">{diagnostics.protocol.toUpperCase()}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Round Trip Time</span>
            <span className="font-mono text-emerald-400 font-semibold">{diagnostics.rttMs} ms</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Audio Bitrate</span>
            <span className="font-mono text-sky-400 font-semibold">{diagnostics.audioBitrateKbps} kbps (Opus)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Packet Loss</span>
            <span className={`font-mono font-semibold ${diagnostics.packetLossPercent > 5 ? 'text-amber-400' : 'text-slate-200'}`}>
              {diagnostics.packetLossPercent}%
            </span>
          </div>
          <div className="flex items-center justify-end">
            <button
              onClick={handleTriggerIceRestart}
              className="flex items-center gap-1 px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-lg text-xs font-medium transition"
              title="Force ICE Restart to switch to best available network path"
            >
              <RefreshCw className="w-3 h-3" />
              ICE Restart
            </button>
          </div>
        </div>
      )}

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
            {connectionState !== 'CONNECTED' && connectionState !== 'VOICE_TRANSMISSION_ACTIVE' && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-sky-500/20 border-2 border-sky-500/40 animate-ping absolute inset-0" />
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-sky-500 flex items-center justify-center relative">
                    <Activity className="w-8 h-8 text-sky-400" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-100">
                    {connectionState === 'RECONNECTING'
                      ? 'Reconnecting Media Stream...'
                      : connectionState === 'AWAITING_DEVICE_APPROVAL'
                      ? 'Awaiting Device Consent'
                      : 'Connecting WebRTC Peer Connection'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs">
                    {connectionState === 'RECONNECTING'
                      ? 'Detecting network change and negotiating new STUN/TURN route...'
                      : 'Please approve the remote session prompt on your Android device.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Audio Element for live microphone reception */}
          <audio ref={audioRef} autoPlay playsInline />

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
