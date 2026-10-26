import { Router, Request, Response } from 'express';
import { iceService } from '../services/iceService.js';
import { requireAuth } from '../middleware/auth.js';

export const webrtcRouter = Router();

/**
 * GET /api/v1/webrtc/ice-servers
 * Returns STUN and TURN server configurations with short-lived credentials.
 * Requires authenticated session access.
 */
webrtcRouter.get('/ice-servers', requireAuth, (req: Request, res: Response) => {
  const userId = req.user?.id || 'anonymous';
  const iceServers = iceService.getIceServers(userId);

  res.json({
    iceServers,
    timestamp: new Date().toISOString(),
    ttlSeconds: 3600,
  });
});
