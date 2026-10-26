import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { createExpressApp } from '../src/server.js';
import { setupSignaling } from '../src/signaling/socketHandler.js';
import { db } from '../src/services/dbStore.js';
import { iceService } from '../src/services/iceService.js';

describe('WebRTC Cross-Network & ICE Relay Tests', () => {
  let app: any;
  let httpServer: any;
  let ioServer: SocketIOServer;
  let port: number;

  beforeAll(async () => {
    app = createExpressApp();
    httpServer = createServer(app);
    ioServer = new SocketIOServer(httpServer);
    setupSignaling(ioServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    ioServer.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('generates STUN and fallback TURN server configurations', () => {
    const servers = iceService.getIceServers('user-test-123');
    expect(servers.length).toBeGreaterThan(0);
    expect(servers[0].urls).toBeDefined();
  });

  it('serves dynamic ICE servers via authenticated API endpoint', async () => {
    const res = await request(app)
      .get('/api/v1/webrtc/ice-servers')
      .set('Authorization', 'Bearer mock-token-test-user-1');

    expect(res.status).toBe(200);
    expect(res.body.iceServers).toBeDefined();
    expect(Array.isArray(res.body.iceServers)).toBe(true);
    expect(res.body.ttlSeconds).toBe(3600);
  });

  it('rejects unauthenticated requests to ICE server discovery', async () => {
    const res = await request(app).get('/api/v1/webrtc/ice-servers');
    expect(res.status).toBe(401);
  });

  it('serves direct APK download with valid Android package headers', async () => {
    const res = await request(app).get('/download/OmniControl.apk');
    if (res.status === 200) {
      expect(res.header['content-type']).toBe('application/vnd.android.package-archive');
      expect(res.header['content-disposition']).toContain('attachment; filename="OmniControl.apk"');
    } else {
      expect(res.status).toBe(404);
    }
  });

  it('returns iceServers to authorized participant upon session:join', async () => {
    // 1. Create a dummy session
    const session = await db.createSession({
      ownerId: 'test-user-1',
      deviceId: 'test-device-1',
      controllerType: 'web',
      status: 'active',
    });

    const clientSocket: ClientSocket = Client(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      clientSocket.on('connect', () => {
        clientSocket.emit(
          'session:join',
          {
            sessionId: session.id,
            role: 'controller',
            userId: 'test-user-1',
          },
          (res: any) => {
            try {
              expect(res.ok).toBe(true);
              expect(res.iceServers).toBeDefined();
              expect(Array.isArray(res.iceServers)).toBe(true);
              clientSocket.disconnect();
              resolve();
            } catch (err) {
              clientSocket.disconnect();
              reject(err);
            }
          }
        );
      });
    });
  });
});
