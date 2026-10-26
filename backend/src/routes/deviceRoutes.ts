import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pairingService } from '../services/pairingService.js';
import { db } from '../services/dbStore.js';
import { CompletePairingSchema, CreatePairingRequestSchema } from '../types/index.js';

export const deviceRouter = Router();

// GET /api/v1/devices - Get all enrolled, active devices for current user
deviceRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const devices = await db.getDevicesByOwner(ownerId);
    res.json({ data: devices });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// POST /api/v1/devices/pairing - Authenticated user initiates device pairing code
deviceRouter.post('/pairing', requireAuth, async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const validation = CreatePairingRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: validation.error.errors } });
      return;
    }

    const { code, expiresAt } = await pairingService.createPairingCode(ownerId);
    res.status(201).json({
      data: {
        pairingCode: code,
        expiresAt,
        message: 'Enter this 6-digit code on your Android device within 5 minutes.',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// POST /api/v1/devices/pairing/complete - Android app completes enrollment with pairing code
deviceRouter.post('/pairing/complete', async (req: Request, res: Response) => {
  try {
    const validation = CompletePairingSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: validation.error.errors } });
      return;
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await pairingService.completePairing(
      validation.data.pairingCode,
      {
        displayName: validation.data.deviceDisplayName,
        appVersion: validation.data.appVersion,
      },
      clientIp
    );

    if (!result.success) {
      res.status(400).json({ error: { code: 'PAIRING_FAILED', message: result.error } });
      return;
    }

    res.status(200).json({
      data: {
        device: result.device,
        message: 'Device successfully paired and enrolled.',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// GET /api/v1/devices/:deviceId - Get metadata for specific device
deviceRouter.get('/:deviceId', requireAuth, async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const device = await db.getDeviceById(req.params.deviceId);

    if (!device || device.ownerId !== ownerId || device.revokedAt) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Device not found or revoked.' } });
      return;
    }

    res.json({ data: device });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// DELETE /api/v1/devices/:deviceId - Revoke device access
deviceRouter.delete('/:deviceId', requireAuth, async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const revoked = await db.revokeDevice(req.params.deviceId, ownerId);

    if (!revoked) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Device not found or not owned by you.' } });
      return;
    }

    res.json({ data: { message: 'Device pairing revoked successfully.' } });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});
