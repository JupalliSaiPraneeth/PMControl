import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { deviceRouter } from './routes/deviceRoutes.js';
import { sessionRouter } from './routes/sessionRoutes.js';
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

  // API v1 routes
  app.use('/api/v1/devices', deviceRouter);
  app.use('/api/v1/sessions', sessionRouter);

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
