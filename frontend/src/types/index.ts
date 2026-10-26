export interface Device {
  id: string;
  ownerId: string;
  displayName: string;
  platform: 'android';
  appVersion: string;
  lastSeenAt: string;
  createdAt: string;
  revokedAt: string | null;
  batteryLevel?: number;
  isCharging?: boolean;
  networkType?: string;
}

export type SessionStatus = 'pending' | 'active' | 'rejected' | 'ended';

export interface RemoteSession {
  id: string;
  ownerId: string;
  deviceId: string;
  controllerType: 'web' | 'android';
  status: SessionStatus;
  requestedAt: string;
  approvedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface SessionEvent {
  id: string;
  sessionId: string;
  actorId: string;
  eventType: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface PairingCodeResponse {
  pairingCode: string;
  expiresAt: string;
  message: string;
}

export type RemoteControlAction =
  | { type: 'tap'; x: number; y: number }
  | { type: 'swipe'; startX: number; startY: number; endX: number; endY: number; durationMs?: number }
  | { type: 'key'; action: 'back' | 'home' | 'recent_apps' | 'volume_up' | 'volume_down' };
