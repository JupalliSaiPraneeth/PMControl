import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { deviceRouter } from './routes/deviceRoutes.js';
import { sessionRouter } from './routes/sessionRoutes.js';
import { webrtcRouter } from './routes/webrtcRoutes.js';
import { config } from './config/env.js';

export function createExpressApp() {
  const app = express();

  // HTTP Security Headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow mobile apps (no origin), localhost, and LAN connections in development
        if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.startsWith('http://172.16.') || origin === config.DASHBOARD_ORIGIN) {
          callback(null, true);
        } else {
          callback(null, true); // Permissive in development
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id'],
    })
  );

  // Request parsing
  app.use(express.json({ limit: '1mb' }));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'omnicontrol-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // Direct APK download endpoint with Android MIME type to prevent parsing corruption
  app.get(['/download/OmniControl.apk', '/OmniControl.apk'], (_req: Request, res: Response) => {
    const candidatePaths = [
      path.resolve(process.cwd(), '../frontend/public/OmniControl.apk'),
      path.resolve(process.cwd(), 'public/OmniControl.apk'),
      path.resolve(process.cwd(), '../OmniControl.apk'),
    ];

    const apkPath = candidatePaths.find((p) => fs.existsSync(p));
    if (!apkPath) {
      res.status(404).json({ error: 'OmniControl.apk not found. Please build or download from GitHub Releases.' });
      return;
    }

    const stat = fs.statSync(apkPath);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="OmniControl.apk"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    const stream = fs.createReadStream(apkPath);
    stream.pipe(res);
  });

  // API v1 routes
  app.use('/api/v1/devices', deviceRouter);
  app.use('/api/v1/sessions', sessionRouter);
  app.use('/api/v1/webrtc', webrtcRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'The requested resource was not found on this server.',
      },
    });
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = Math.random().toString(36).substring(2, 10);
    // Log error internally with correlation ID, but return sanitized response to client
    console.error(`[Error][${correlationId}]`, err);

    res.status(err.status || 500).json({
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message && config.NODE_ENV !== 'production' ? err.message : 'An unexpected error occurred.',
        correlationId,
      },
    });
  });

  return app;
}
