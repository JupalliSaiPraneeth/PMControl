import { db } from './dbStore.js';
import { RemoteSession } from '../types/index.js';

export class SessionService {
  async requestSession(
    ownerId: string,
    deviceId: string,
    controllerType: 'web' | 'android' = 'web'
  ): Promise<{ success: boolean; session?: RemoteSession; error?: string }> {
    const device = await db.getDeviceById(deviceId);
    if (!device) {
      return { success: false, error: 'Device not found.' };
    }
    if (device.ownerId !== ownerId) {
      return { success: false, error: 'Unauthorized: You do not own this device.' };
    }
    if (device.revokedAt) {
      return { success: false, error: 'Device pairing has been revoked.' };
    }

    const session = await db.createSession({
      ownerId,
      deviceId,
      controllerType,
      status: 'pending',
    });

    await db.addSessionEvent({
      sessionId: session.id,
      actorId: ownerId,
      eventType: 'session.requested',
      metadata: { controllerType, deviceId },
    });

    return { success: true, session };
  }

  async approveSession(
    sessionId: string,
    deviceId: string,
    approved: boolean
  ): Promise<{ success: boolean; session?: RemoteSession; error?: string }> {
    const session = await db.getSessionById(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found.' };
    }
    if (session.deviceId !== deviceId) {
      return { success: false, error: 'Device ID mismatch for this session.' };
    }
    if (session.status !== 'pending') {
      return { success: false, error: `Session is not pending (current status: ${session.status}).` };
    }

    const now = new Date().toISOString();
    const updated = await db.updateSession(sessionId, {
      status: approved ? 'active' : 'rejected',
      approvedAt: approved ? now : null,
      startedAt: approved ? now : null,
      endedAt: approved ? null : now,
    });

    await db.addSessionEvent({
      sessionId,
      actorId: deviceId,
      eventType: approved ? 'session.approved' : 'session.rejected',
      metadata: { approved },
    });

    return { success: true, session: updated || undefined };
  }

  async endSession(
    sessionId: string,
    actorId: string,
    reason: string = 'User terminated session'
  ): Promise<{ success: boolean; session?: RemoteSession; error?: string }> {
    const session = await db.getSessionById(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found.' };
    }

    // If already ended, return gracefully (safe to invoke multiple times)
    if (session.status === 'ended') {
      return { success: true, session };
    }

    const now = new Date().toISOString();
    const updated = await db.updateSession(sessionId, {
      status: 'ended',
      endedAt: now,
    });

    await db.addSessionEvent({
      sessionId,
      actorId,
      eventType: 'session.ended',
      metadata: { reason },
    });

    return { success: true, session: updated || undefined };
  }

  async getSession(sessionId: string): Promise<RemoteSession | null> {
    return db.getSessionById(sessionId);
  }

  async getUserSessions(ownerId: string): Promise<RemoteSession[]> {
    return db.getSessionsByOwner(ownerId);
  }
}

export const sessionService = new SessionService();
