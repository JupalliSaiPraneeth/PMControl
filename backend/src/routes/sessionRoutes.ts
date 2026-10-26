import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sessionService } from '../services/sessionService.js';
import { db } from '../services/dbStore.js';
import { ApproveSessionSchema, RequestSessionSchema } from '../types/index.js';

export const sessionRouter = Router();

// POST /api/v1/sessions - Request a new remote session
sessionRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const validation = RequestSessionSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: validation.error.errors } });
      return;
    }

    const result = await sessionService.requestSession(
      ownerId,
      validation.data.deviceId,
      validation.data.controllerType
    );

    if (!result.success) {
      res.status(400).json({ error: { code: 'SESSION_REQUEST_FAILED', message: result.error } });
      return;
    }

    res.status(201).json({ data: result.session });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// GET /api/v1/sessions - List user sessions
sessionRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const sessions = await sessionService.getUserSessions(ownerId);
    res.json({ data: sessions });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// GET /api/v1/sessions/:sessionId - Get session metadata
sessionRouter.get('/:sessionId', requireAuth, async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const session = await sessionService.getSession(req.params.sessionId);

    if (!session || session.ownerId !== ownerId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found.' } });
      return;
    }

    res.json({ data: session });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// POST /api/v1/sessions/:sessionId/approve - Android device approves or rejects session
sessionRouter.post('/:sessionId/approve', async (req: Request, res: Response) => {
  try {
    const validation = ApproveSessionSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: validation.error.errors } });
      return;
    }

    const deviceIdHeader = req.headers['x-device-id'] as string;
    if (!deviceIdHeader) {
      res.status(400).json({ error: { code: 'MISSING_DEVICE_ID', message: 'x-device-id header required.' } });
      return;
    }

    const result = await sessionService.approveSession(
      req.params.sessionId,
      deviceIdHeader,
      validation.data.approved
    );

    if (!result.success) {
      res.status(400).json({ error: { code: 'APPROVAL_FAILED', message: result.error } });
      return;
    }

    res.json({ data: result.session });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// POST /api/v1/sessions/:sessionId/end - Immediately end an active or pending session
sessionRouter.post('/:sessionId/end', requireAuth, async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const session = await sessionService.getSession(req.params.sessionId);

    if (!session || session.ownerId !== ownerId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found or unauthorized.' } });
      return;
    }

    const result = await sessionService.endSession(req.params.sessionId, ownerId, 'Controller ended session');
    res.json({ data: result.session });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// GET /api/v1/sessions/:sessionId/events - Get audit events for session
sessionRouter.get('/:sessionId/events', requireAuth, async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const session = await sessionService.getSession(req.params.sessionId);

    if (!session || session.ownerId !== ownerId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found or unauthorized.' } });
      return;
    }

    const events = await db.getSessionEvents(req.params.sessionId);
    res.json({ data: events });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});
