import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createExpressApp } from '../src/server.js';
import { db } from '../src/services/dbStore.js';
import { pairingService } from '../src/services/pairingService.js';

const app = createExpressApp();
const TEST_AUTH_TOKEN = 'Bearer mock-token-user-123';
const OTHER_AUTH_TOKEN = 'Bearer mock-token-user-456';

describe('OmniControl Backend API & Security Tests', () => {
  beforeEach(() => {
    db.clear();
  });

  describe('Health check', () => {
    it('returns 200 with service health info', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('omnicontrol-backend');
    });
  });

  describe('Authentication & Device Pairing Flow', () => {
    it('rejects pairing code generation without authentication', async () => {
      const res = await request(app).post('/api/v1/devices/pairing').send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('generates a 6-digit cryptographically secure pairing code for authenticated user', async () => {
      const res = await request(app)
        .post('/api/v1/devices/pairing')
        .set('Authorization', TEST_AUTH_TOKEN)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.data.pairingCode).toMatch(/^\d{6}$/);
      expect(res.body.data.expiresAt).toBeDefined();
    });

    it('allows an Android device to complete pairing with the code', async () => {
      // 1. User requests code
      const pairInit = await request(app)
        .post('/api/v1/devices/pairing')
        .set('Authorization', TEST_AUTH_TOKEN)
        .send({});

      const code = pairInit.body.data.pairingCode;

      // 2. Android device submits pairing code
      const pairComplete = await request(app)
        .post('/api/v1/devices/pairing/complete')
        .send({
          pairingCode: code,
          deviceDisplayName: 'Pixel 8 Pro (Personal)',
          appVersion: '1.0.0',
        });

      expect(pairComplete.status).toBe(200);
      expect(pairComplete.body.data.device.displayName).toBe('Pixel 8 Pro (Personal)');
      expect(pairComplete.body.data.device.ownerId).toBe('user-123');

      // 3. User lists devices and sees the newly paired device
      const devList = await request(app)
        .get('/api/v1/devices')
        .set('Authorization', TEST_AUTH_TOKEN);

      expect(devList.status).toBe(200);
      expect(devList.body.data.length).toBe(1);
      expect(devList.body.data[0].id).toBe(pairComplete.body.data.device.id);
    });

    it('prevents reuse of an already consumed pairing code (single-use constraint)', async () => {
      const pairInit = await request(app)
        .post('/api/v1/devices/pairing')
        .set('Authorization', TEST_AUTH_TOKEN)
        .send({});

      const code = pairInit.body.data.pairingCode;

      // First use - succeeds
      const firstUse = await request(app)
        .post('/api/v1/devices/pairing/complete')
        .send({
          pairingCode: code,
          deviceDisplayName: 'Device 1',
        });
      expect(firstUse.status).toBe(200);

      // Second use with identical code - fails
      const secondUse = await request(app)
        .post('/api/v1/devices/pairing/complete')
        .send({
          pairingCode: code,
          deviceDisplayName: 'Device 2 - Rogue Attempt',
        });
      expect(secondUse.status).toBe(400);
      expect(secondUse.body.error.code).toBe('PAIRING_FAILED');
    });

    it('rejects pairing completion with invalid or malformed codes', async () => {
      const res = await request(app)
        .post('/api/v1/devices/pairing/complete')
        .send({
          pairingCode: 'ABC', // Not 6 digits
          deviceDisplayName: 'Device',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Device Revocation & Access Control', () => {
    it('allows an owner to revoke their paired device, hiding it from active devices', async () => {
      // Pair device
      const pairInit = await request(app)
        .post('/api/v1/devices/pairing')
        .set('Authorization', TEST_AUTH_TOKEN)
        .send({});
      const pairComplete = await request(app)
        .post('/api/v1/devices/pairing/complete')
        .send({
          pairingCode: pairInit.body.data.pairingCode,
          deviceDisplayName: 'My Galaxy S24',
        });
      const deviceId = pairComplete.body.data.device.id;

      // Revoke device
      const revokeRes = await request(app)
        .delete(`/api/v1/devices/${deviceId}`)
        .set('Authorization', TEST_AUTH_TOKEN);
      expect(revokeRes.status).toBe(200);

      // Verify device no longer returned in active list
      const listRes = await request(app)
        .get('/api/v1/devices')
        .set('Authorization', TEST_AUTH_TOKEN);
      expect(listRes.body.data.length).toBe(0);
    });

    it('prevents an unauthorized user from revoking someone elses device', async () => {
      // Pair device under user-123
      const pairInit = await request(app)
        .post('/api/v1/devices/pairing')
        .set('Authorization', TEST_AUTH_TOKEN)
        .send({});
      const pairComplete = await request(app)
        .post('/api/v1/devices/pairing/complete')
        .send({
          pairingCode: pairInit.body.data.pairingCode,
          deviceDisplayName: 'Victim Phone',
        });
      const deviceId = pairComplete.body.data.device.id;

      // Another user (user-456) tries to revoke it
      const unauthorizedRevoke = await request(app)
        .delete(`/api/v1/devices/${deviceId}`)
        .set('Authorization', OTHER_AUTH_TOKEN);

      expect(unauthorizedRevoke.status).toBe(404);
    });
  });

  describe('Remote Session Lifecycle & Authorization', () => {
    it('creates a session, allows Android consent approval, and terminates safely', async () => {
      // 1. Enroll device
      const pairInit = await request(app)
        .post('/api/v1/devices/pairing')
        .set('Authorization', TEST_AUTH_TOKEN)
        .send({});
      const pairComplete = await request(app)
        .post('/api/v1/devices/pairing/complete')
        .send({
          pairingCode: pairInit.body.data.pairingCode,
          deviceDisplayName: 'Android Test Device',
        });
      const deviceId = pairComplete.body.data.device.id;

      // 2. Request remote session from controller dashboard
      const sessionReq = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', TEST_AUTH_TOKEN)
        .send({ deviceId, controllerType: 'web' });

      expect(sessionReq.status).toBe(201);
      const sessionId = sessionReq.body.data.id;
      expect(sessionReq.body.data.status).toBe('pending');

      // 3. Android device displays prompt and user approves
      const approveRes = await request(app)
        .post(`/api/v1/sessions/${sessionId}/approve`)
        .set('x-device-id', deviceId)
        .send({ approved: true });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('active');
      expect(approveRes.body.data.startedAt).toBeDefined();

      // 4. Either participant ends the session
      const endRes = await request(app)
        .post(`/api/v1/sessions/${sessionId}/end`)
        .set('Authorization', TEST_AUTH_TOKEN);

      expect(endRes.status).toBe(200);
      expect(endRes.body.data.status).toBe('ended');

      // 5. Verify audit events were recorded without storing media/passwords
      const auditRes = await request(app)
        .get(`/api/v1/sessions/${sessionId}/events`)
        .set('Authorization', TEST_AUTH_TOKEN);

      expect(auditRes.status).toBe(200);
      const events = auditRes.body.data.map((e: any) => e.eventType);
      expect(events).toContain('session.requested');
      expect(events).toContain('session.approved');
      expect(events).toContain('session.ended');
    });

    it('rejects remote session creation on devices not owned by the user', async () => {
      // Pair device under user-123
      const pairInit = await request(app)
        .post('/api/v1/devices/pairing')
        .set('Authorization', TEST_AUTH_TOKEN)
        .send({});
      const pairComplete = await request(app)
        .post('/api/v1/devices/pairing/complete')
        .send({
          pairingCode: pairInit.body.data.pairingCode,
          deviceDisplayName: 'User 123 Phone',
        });
      const deviceId = pairComplete.body.data.device.id;

      // User 456 tries to request a session on User 123's device
      const unauthorizedSession = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', OTHER_AUTH_TOKEN)
        .send({ deviceId, controllerType: 'web' });

      expect(unauthorizedSession.status).toBe(400);
      expect(unauthorizedSession.body.error.message).toContain('Unauthorized');
    });
  });
});
