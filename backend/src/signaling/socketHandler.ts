import { Server as SocketIOServer, Socket } from 'socket.io';
import { db } from '../services/dbStore.js';
import { sessionService } from '../services/sessionService.js';
import { RemoteControlActionSchema } from '../types/index.js';

interface SocketAuthData {
  sessionId: string;
  role: 'controller' | 'device';
  userId?: string;
  deviceId?: string;
}

export function setupSignaling(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    // 1. Join Session Room with Authorization Check
    socket.on('session:join', async (data: SocketAuthData, callback?: (res: { ok: boolean; error?: string }) => void) => {
      try {
        const { sessionId, role, userId, deviceId } = data;
        const session = await db.getSessionById(sessionId);

        if (!session) {
          callback?.({ ok: false, error: 'Session does not exist.' });
          return;
        }

        // Validate permissions
        if (role === 'controller') {
          if (userId && session.ownerId !== userId) {
            callback?.({ ok: false, error: 'Unauthorized: User does not own this session.' });
            return;
          }
        } else if (role === 'device') {
          if (deviceId && session.deviceId !== deviceId) {
            callback?.({ ok: false, error: 'Unauthorized: Device mismatch for this session.' });
            return;
          }
        }

        const room = `session:${sessionId}`;
        socket.join(room);
        socket.data = { sessionId, role, userId, deviceId };

        // Notify room that participant has joined
        socket.to(room).emit('session:participant_joined', { role, timestamp: new Date().toISOString() });

        callback?.({ ok: true });
      } catch (err: any) {
        callback?.({ ok: false, error: err.message });
      }
    });

    // 2. WebRTC SDP Offer
    socket.on('webrtc:offer', (payload: { sdp: any }) => {
      const { sessionId } = socket.data as SocketAuthData;
      if (!sessionId) return;
      socket.to(`session:${sessionId}`).emit('webrtc:offer', payload);
    });

    // 3. WebRTC SDP Answer
    socket.on('webrtc:answer', (payload: { sdp: any }) => {
      const { sessionId } = socket.data as SocketAuthData;
      if (!sessionId) return;
      socket.to(`session:${sessionId}`).emit('webrtc:answer', payload);
    });

    // 4. WebRTC ICE Candidate
    socket.on('webrtc:ice-candidate', (payload: { candidate: any }) => {
      const { sessionId } = socket.data as SocketAuthData;
      if (!sessionId) return;
      socket.to(`session:${sessionId}`).emit('webrtc:ice-candidate', payload);
    });

    // 5. Authorized Remote Interaction Action (Controller -> Device)
    socket.on('control:action', async (actionData: unknown, callback?: (res: { ok: boolean; error?: string }) => void) => {
      const { sessionId, role } = (socket.data || {}) as SocketAuthData;
      if (!sessionId || role !== 'controller') {
        callback?.({ ok: false, error: 'Only authorized controllers can dispatch remote actions.' });
        return;
      }

      // Check session status is active
      const session = await db.getSessionById(sessionId);
      if (!session || session.status !== 'active') {
        callback?.({ ok: false, error: 'Session is not currently active.' });
        return;
      }

      // Strict validation of the gesture/action
      const parseResult = RemoteControlActionSchema.safeParse(actionData);
      if (!parseResult.success) {
        callback?.({ ok: false, error: 'Invalid remote control action format.' });
        return;
      }

      // Dispatch to device in the room
      socket.to(`session:${sessionId}`).emit('control:execute', parseResult.data);
      callback?.({ ok: true });
    });

    // 6. Device Status Updates (Device -> Controller)
    socket.on('device:status', async (statusData: { batteryLevel?: number; isCharging?: boolean; networkType?: string }) => {
      const { sessionId, deviceId, role } = (socket.data || {}) as SocketAuthData;
      if (!sessionId || role !== 'device' || !deviceId) return;

      await db.updateDeviceStatus(deviceId, statusData);
      socket.to(`session:${sessionId}`).emit('device:status_update', statusData);
    });

    // 7. Explicit Session Termination
    socket.on('session:end', async (reason?: string) => {
      const { sessionId, userId, deviceId, role } = (socket.data || {}) as SocketAuthData;
      if (!sessionId) return;

      const actor = role === 'controller' ? (userId || 'controller') : (deviceId || 'device');
      await sessionService.endSession(sessionId, actor, reason || 'Terminated via signaling');

      io.to(`session:${sessionId}`).emit('session:terminated', {
        reason: reason || 'Session ended by participant',
        endedBy: role,
      });
    });

    // 8. Handle Disconnection
    socket.on('disconnect', () => {
      const { sessionId, role } = (socket.data || {}) as SocketAuthData;
      if (sessionId) {
        socket.to(`session:${sessionId}`).emit('session:participant_left', { role });
      }
    });
  });
}
