import { Device, PairingCodeResponse, RemoteSession, SessionEvent } from '../types/index.js';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `API Error: ${res.status}`);
    }

    return data.data;
  }

  // Device endpoints
  getDevices(): Promise<Device[]> {
    return this.request<Device[]>('/api/v1/devices');
  }

  generatePairingCode(): Promise<PairingCodeResponse> {
    return this.request<PairingCodeResponse>('/api/v1/devices/pairing', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  revokeDevice(deviceId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/v1/devices/${deviceId}`, {
      method: 'DELETE',
    });
  }

  // Session endpoints
  requestSession(deviceId: string): Promise<RemoteSession> {
    return this.request<RemoteSession>('/api/v1/sessions', {
      method: 'POST',
      body: JSON.stringify({ deviceId, controllerType: 'web' }),
    });
  }

  getSessions(): Promise<RemoteSession[]> {
    return this.request<RemoteSession[]>('/api/v1/sessions');
  }

  getSession(sessionId: string): Promise<RemoteSession> {
    return this.request<RemoteSession>(`/api/v1/sessions/${sessionId}`);
  }

  endSession(sessionId: string): Promise<RemoteSession> {
    return this.request<RemoteSession>(`/api/v1/sessions/${sessionId}/end`, {
      method: 'POST',
    });
  }

  getSessionEvents(sessionId: string): Promise<SessionEvent[]> {
    return this.request<SessionEvent[]>(`/api/v1/sessions/${sessionId}/events`);
  }

  getIceServers(): Promise<{ iceServers: RTCIceServer[]; ttlSeconds: number }> {
    return this.request<{ iceServers: RTCIceServer[]; ttlSeconds: number }>('/api/v1/webrtc/ice-servers');
  }
}

export const api = new ApiClient();
