/**
 * Authentication Middleware
 * Validates Supabase JWT tokens and attaches user to request
 */

import { Request, Response, NextFunction } from 'express';
import { supabaseService } from '../services/supabase.service';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

/**
 * Middleware to authenticate user via Supabase JWT
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header'
      });
      return;
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token with Supabase
    const user = await supabaseService.verifyUserToken(token);

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
      return;
    }

    // Attach user to request
    req.user = user;

    console.log(`[Auth] User authenticated: ${user.id}`);
    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Optional authentication - doesn't fail if token is missing
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const user = await supabaseService.verifyUserToken(token);

      if (user) {
        req.user = user;
        console.log(`[Auth] User authenticated: ${user.id}`);
      }
    }

    next();
  } catch (error) {
    console.error('[Auth] Optional authentication error:', error);
    next(); // Continue even if authentication fails
  }
}
