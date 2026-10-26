import { io, Socket } from 'socket.io-client';
import { RemoteControlAction } from '../types/index.js';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:4000';

class SignalingService {
  private socket: Socket | null = null;

  connect(): Socket {
    if (!this.socket) {
      this.socket = io(SIGNALING_URL, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });

      this.socket.on('connect', () => {
        console.log('[Signaling] Connected to server, id:', this.socket?.id);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[Signaling] Disconnected:', reason);
      });
    }
    return this.socket;
  }

  joinSession(sessionId: string, userId: string): Promise<{ ok: boolean; iceServers?: RTCIceServer[]; error?: string }> {
    const s = this.connect();
    return new Promise((resolve) => {
      s.emit(
        'session:join',
        { sessionId, role: 'controller', userId },
        (response: { ok: boolean; iceServers?: RTCIceServer[]; error?: string }) => {
          if (response?.ok) {
            resolve({ ok: true, iceServers: response.iceServers });
          } else {
            console.error('[Signaling] Join failed:', response?.error);
            resolve({ ok: false, error: response?.error });
          }
        }
      );
    });
  }

  sendOffer(sdp: RTCSessionDescriptionInit) {
    this.socket?.emit('webrtc:offer', { sdp });
  }

  sendAnswer(sdp: RTCSessionDescriptionInit) {
    this.socket?.emit('webrtc:answer', { sdp });
  }

  sendIceCandidate(candidate: RTCIceCandidate) {
    this.socket?.emit('webrtc:ice-candidate', { candidate });
  }

  sendIceRestart() {
    this.socket?.emit('webrtc:ice-restart', { timestamp: Date.now() });
  }

  sendControlAction(action: RemoteControlAction): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve(false);
      this.socket.emit('control:action', action, (res: { ok: boolean; error?: string }) => {
        resolve(res?.ok || false);
      });
    });
  }

  endSession(reason?: string) {
    this.socket?.emit('session:end', reason);
  }

  onOffer(handler: (payload: { sdp: RTCSessionDescriptionInit }) => void) {
    this.socket?.on('webrtc:offer', handler);
  }

  onAnswer(handler: (payload: { sdp: RTCSessionDescriptionInit }) => void) {
    this.socket?.on('webrtc:answer', handler);
  }

  onIceCandidate(handler: (payload: { candidate: RTCIceCandidateInit }) => void) {
    this.socket?.on('webrtc:ice-candidate', handler);
  }

  onIceRestart(handler: (payload: { initiatedBy: string; timestamp: string }) => void) {
    this.socket?.on('webrtc:ice-restart', handler);
  }

  onVoiceStateUpdate(handler: (payload: { state: 'active' | 'muted' | 'stopped'; updatedBy: string; timestamp: string }) => void) {
    this.socket?.on('voice:state-update', handler);
  }

  onDeviceStatus(handler: (status: { batteryLevel?: number; isCharging?: boolean; networkType?: string }) => void) {
    this.socket?.on('device:status_update', handler);
  }

  onSessionTerminated(handler: (data: { reason: string; endedBy: string }) => void) {
    this.socket?.on('session:terminated', handler);
  }

  ping(): Promise<number> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve(-1);
      const start = Date.now();
      this.socket.emit('webrtc:ping', start);
      this.socket.once('webrtc:pong', () => {
        resolve(Date.now() - start);
      });
      setTimeout(() => resolve(-1), 3000);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const signaling = new SignalingService();
