import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../services/supabase.js';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header.',
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  // In test or local dev mode without live Supabase, support deterministic test tokens
  if (token.startsWith('mock-token-')) {
    const userId = token.replace('mock-token-', '');
    req.user = { id: userId, email: `${userId}@omnicontrol.local` };
    next();
    return;
  }

  // If Supabase is configured, verify token with Supabase Auth
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) {
        res.status(401).json({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired session token.',
          },
        });
        return;
      }

      req.user = {
        id: data.user.id,
        email: data.user.email,
      };
      next();
      return;
    } catch (err: any) {
      res.status(401).json({
        error: {
          code: 'AUTH_VERIFICATION_FAILED',
          message: 'Failed to verify authentication token.',
        },
      });
      return;
    }
  }

  // Fallback for local demo mode if supabase is not initialized
  if (process.env.NODE_ENV !== 'production') {
    req.user = { id: 'demo-user-id', email: 'demo@omnicontrol.local' };
    next();
    return;
  }

  res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication service unavailable.',
    },
  });
}
