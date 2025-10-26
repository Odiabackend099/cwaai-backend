/**
 * Rate Limiting Middleware
 * Prevents abuse of public demo call endpoint
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore: RateLimitStore = {};

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(rateLimitStore).forEach(key => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  });
}, 10 * 60 * 1000);

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
}

/**
 * Rate limiting middleware factory
 */
export function rateLimiter(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Get client IP address
    const clientIp =
      req.headers['x-forwarded-for']?.toString().split(',')[0] ||
      req.headers['x-real-ip']?.toString() ||
      req.socket.remoteAddress ||
      'unknown';

    const key = `rate_limit:${clientIp}`;
    const now = Date.now();

    // Initialize or get existing rate limit data
    if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
      rateLimitStore[key] = {
        count: 0,
        resetTime: now + options.windowMs,
      };
    }

    // Increment request count
    rateLimitStore[key].count++;

    // Check if limit exceeded
    if (rateLimitStore[key].count > options.maxRequests) {
      const resetIn = Math.ceil((rateLimitStore[key].resetTime - now) / 1000);

      console.log(`[Rate Limit] IP ${clientIp} exceeded limit (${rateLimitStore[key].count}/${options.maxRequests})`);

      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: options.message || `Rate limit exceeded. Please try again in ${resetIn} seconds.`,
        retryAfter: resetIn,
      });
      return;
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - rateLimitStore[key].count));
    res.setHeader('X-RateLimit-Reset', new Date(rateLimitStore[key].resetTime).toISOString());

    console.log(`[Rate Limit] IP ${clientIp}: ${rateLimitStore[key].count}/${options.maxRequests} requests`);

    next();
  };
}

/**
 * Demo call rate limiter - 3 calls per hour per IP
 */
export const demoCallRateLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  message: 'Demo call limit reached. You can request up to 3 demo calls per hour. Please try again later or contact us directly.',
});
