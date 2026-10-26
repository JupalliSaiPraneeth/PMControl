import { z } from 'zod';

export interface UserProfile {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface PairingRequest {
  id: string;
  ownerId: string;
  pairingCodeHash: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
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
  metadata: Record<string, unknown>;
  createdAt: string;
}

// Request validation schemas using Zod
export const CreatePairingRequestSchema = z.object({
  deviceNickname: z.string().min(1).max(50).optional(),
});

export const CompletePairingSchema = z.object({
  pairingCode: z.string().regex(/^\d{6}$/, 'Pairing code must be a 6-digit numeric string'),
  deviceDisplayName: z.string().min(1).max(100),
  appVersion: z.string().min(1).max(20).default('1.0.0'),
});

export const RequestSessionSchema = z.object({
  deviceId: z.string().uuid(),
  controllerType: z.enum(['web', 'android']).default('web'),
});

export const ApproveSessionSchema = z.object({
  approved: z.boolean(),
});

// Remote interaction event schemas
export const RemoteTapSchema = z.object({
  type: z.literal('tap'),
  x: z.number().min(0).max(1), // Normalized coordinate (0.0 to 1.0)
  y: z.number().min(0).max(1),
});

export const RemoteSwipeSchema = z.object({
  type: z.literal('swipe'),
  startX: z.number().min(0).max(1),
  startY: z.number().min(0).max(1),
  endX: z.number().min(0).max(1),
  endY: z.number().min(0).max(1),
  durationMs: z.number().min(50).max(2000).default(300),
});

export const RemoteKeySchema = z.object({
  type: z.literal('key'),
  action: z.enum(['back', 'home', 'recent_apps', 'volume_up', 'volume_down']),
});

export const RemoteControlActionSchema = z.discriminatedUnion('type', [
  RemoteTapSchema,
  RemoteSwipeSchema,
  RemoteKeySchema,
]);

export type RemoteControlAction = z.infer<typeof RemoteControlActionSchema>;
