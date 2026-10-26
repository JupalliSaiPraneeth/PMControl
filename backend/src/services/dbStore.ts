import { randomUUID } from 'crypto';
import { Device, PairingRequest, RemoteSession, SessionEvent } from '../types/index.js';
import { supabaseAdmin } from './supabase.js';

export class DbStore {
  // In-memory fallback stores for test and local development
  private devices = new Map<string, Device>();
  private pairingRequests = new Map<string, PairingRequest>();
  private sessions = new Map<string, RemoteSession>();
  private sessionEvents: SessionEvent[] = [];

  // Reset store for testing
  clear() {
    this.devices.clear();
    this.pairingRequests.clear();
    this.sessions.clear();
    this.sessionEvents = [];
  }

  // --- Devices ---
  async getDevicesByOwner(ownerId: string): Promise<Device[]> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('devices')
        .select('*')
        .eq('owner_id', ownerId)
        .is('revoked_at', null);
      if (error) throw new Error(error.message);
      return (data || []).map(this.mapDbDevice);
    }
    return Array.from(this.devices.values()).filter(
      (d) => d.ownerId === ownerId && d.revokedAt === null
    );
  }

  async getDeviceById(deviceId: string): Promise<Device | null> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('devices')
        .select('*')
        .eq('id', deviceId)
        .single();
      if (error || !data) return null;
      return this.mapDbDevice(data);
    }
    return this.devices.get(deviceId) || null;
  }

  async createDevice(device: Omit<Device, 'id' | 'createdAt' | 'revokedAt' | 'lastSeenAt'>): Promise<Device> {
    const newDevice: Device = {
      id: randomUUID(),
      ...device,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      revokedAt: null,
    };

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('devices')
        .insert({
          id: newDevice.id,
          owner_id: newDevice.ownerId,
          display_name: newDevice.displayName,
          platform: newDevice.platform,
          app_version: newDevice.appVersion,
          last_seen_at: newDevice.lastSeenAt,
          created_at: newDevice.createdAt,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return this.mapDbDevice(data);
    }

    this.devices.set(newDevice.id, newDevice);
    return newDevice;
  }

  async updateDeviceStatus(deviceId: string, status: { batteryLevel?: number; isCharging?: boolean; networkType?: string }): Promise<void> {
    const dev = await this.getDeviceById(deviceId);
    if (!dev) return;
    const updated: Device = {
      ...dev,
      ...status,
      lastSeenAt: new Date().toISOString(),
    };
    this.devices.set(deviceId, updated);
  }

  async revokeDevice(deviceId: string, ownerId: string): Promise<boolean> {
    const dev = await this.getDeviceById(deviceId);
    if (!dev || dev.ownerId !== ownerId) return false;

    if (supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from('devices')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', deviceId)
        .eq('owner_id', ownerId);
      if (error) throw new Error(error.message);
      return true;
    }

    dev.revokedAt = new Date().toISOString();
    this.devices.set(deviceId, dev);
    return true;
  }

  // --- Pairing Requests ---
  async createPairingRequest(ownerId: string, pairingCodeHash: string, ttlSeconds: number): Promise<PairingRequest> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const req: PairingRequest = {
      id: randomUUID(),
      ownerId,
      pairingCodeHash,
      expiresAt,
      consumedAt: null,
      createdAt: new Date().toISOString(),
    };

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('pairing_requests')
        .insert({
          id: req.id,
          owner_id: req.ownerId,
          pairing_code_hash: req.pairingCodeHash,
          expires_at: req.expiresAt,
          created_at: req.createdAt,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return this.mapDbPairing(data);
    }

    this.pairingRequests.set(req.id, req);
    return req;
  }

  async findValidPairingByHash(codeHash: string): Promise<PairingRequest | null> {
    const now = new Date();
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('pairing_requests')
        .select('*')
        .eq('pairing_code_hash', codeHash)
        .is('consumed_at', null)
        .gt('expires_at', now.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return this.mapDbPairing(data);
    }

    for (const req of this.pairingRequests.values()) {
      if (
        req.pairingCodeHash === codeHash &&
        !req.consumedAt &&
        new Date(req.expiresAt) > now
      ) {
        return req;
      }
    }
    return null;
  }

  async markPairingConsumed(pairingId: string): Promise<void> {
    const consumedAt = new Date().toISOString();
    if (supabaseAdmin) {
      await supabaseAdmin
        .from('pairing_requests')
        .update({ consumed_at: consumedAt })
        .eq('id', pairingId);
      return;
    }

    const req = this.pairingRequests.get(pairingId);
    if (req) {
      req.consumedAt = consumedAt;
      this.pairingRequests.set(pairingId, req);
    }
  }

  // --- Sessions ---
  async createSession(session: Omit<RemoteSession, 'id' | 'requestedAt' | 'approvedAt' | 'startedAt' | 'endedAt'>): Promise<RemoteSession> {
    const newSession: RemoteSession = {
      id: randomUUID(),
      ...session,
      requestedAt: new Date().toISOString(),
      approvedAt: null,
      startedAt: null,
      endedAt: null,
    };

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('sessions')
        .insert({
          id: newSession.id,
          owner_id: newSession.ownerId,
          device_id: newSession.deviceId,
          controller_type: newSession.controllerType,
          status: newSession.status,
          requested_at: newSession.requestedAt,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return this.mapDbSession(data);
    }

    this.sessions.set(newSession.id, newSession);
    return newSession;
  }

  async getSessionById(sessionId: string): Promise<RemoteSession | null> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (error || !data) return null;
      return this.mapDbSession(data);
    }
    return this.sessions.get(sessionId) || null;
  }

  async getSessionsByOwner(ownerId: string): Promise<RemoteSession[]> {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('sessions')
        .select('*')
        .eq('owner_id', ownerId)
        .order('requested_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map(this.mapDbSession);
    }
    return Array.from(this.sessions.values())
      .filter((s) => s.ownerId === ownerId)
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }

  async updateSession(sessionId: string, updates: Partial<RemoteSession>): Promise<RemoteSession | null> {
    const session = await this.getSessionById(sessionId);
    if (!session) return null;

    const updated = { ...session, ...updates };

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('sessions')
        .update({
          status: updated.status,
          approved_at: updated.approvedAt,
          started_at: updated.startedAt,
          ended_at: updated.endedAt,
        })
        .eq('id', sessionId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return this.mapDbSession(data);
    }

    this.sessions.set(sessionId, updated);
    return updated;
  }

  // --- Session Events (Audit) ---
  async addSessionEvent(event: Omit<SessionEvent, 'id' | 'createdAt'>): Promise<SessionEvent> {
    const newEvent: SessionEvent = {
      id: randomUUID(),
      ...event,
      createdAt: new Date().toISOString(),
    };

    if (supabaseAdmin) {
      await supabaseAdmin.from('session_events').insert({
        id: newEvent.id,
        session_id: newEvent.sessionId,
        actor_id: newEvent.actorId,
        event_type: newEvent.eventType,
        metadata: newEvent.metadata,
        created_at: newEvent.createdAt,
      });
    }

    this.sessionEvents.push(newEvent);
    return newEvent;
  }

  async getSessionEvents(sessionId: string): Promise<SessionEvent[]> {
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('session_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      return (data || []).map((e) => ({
        id: e.id,
        sessionId: e.session_id,
        actorId: e.actor_id,
        eventType: e.event_type,
        metadata: e.metadata,
        createdAt: e.created_at,
      }));
    }
    return this.sessionEvents.filter((e) => e.sessionId === sessionId);
  }

  // Mappers
  private mapDbDevice(row: any): Device {
    return {
      id: row.id,
      ownerId: row.owner_id,
      displayName: row.display_name,
      platform: row.platform,
      appVersion: row.app_version,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
    };
  }

  private mapDbPairing(row: any): PairingRequest {
    return {
      id: row.id,
      ownerId: row.owner_id,
      pairingCodeHash: row.pairing_code_hash,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at,
      createdAt: row.created_at,
    };
  }

  private mapDbSession(row: any): RemoteSession {
    return {
      id: row.id,
      ownerId: row.owner_id,
      deviceId: row.device_id,
      controllerType: row.controller_type,
      status: row.status,
      requestedAt: row.requested_at,
      approvedAt: row.approved_at,
      startedAt: row.started_at,
      endedAt: row.ended_at,
    };
  }
}

export const db = new DbStore();
