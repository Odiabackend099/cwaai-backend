/**
 * Request/Response Logger Middleware
 * Logs all API requests to Supabase for debugging and analytics
 */

import { Request, Response, NextFunction } from 'express';
import { supabaseService } from '../services/supabase.service';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Log request/response to Supabase
 */
export function requestLogger(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const originalSend = res.send;

  // Capture response body
  let responseBody: any;

  res.send = function (body: any): Response {
    responseBody = body;
    return originalSend.call(this, body);
  };

  // Log after response is sent
  res.on('finish', async () => {
    const duration = Date.now() - startTime;

    try {
      // Parse request and response bodies
      let requestBody = req.body;
      let parsedResponseBody = responseBody;

      // Try to parse string responses
      if (typeof responseBody === 'string') {
        try {
          parsedResponseBody = JSON.parse(responseBody);
        } catch {
          // Keep as string if not valid JSON
        }
      }

      // Sanitize sensitive data
      const sanitizedRequest = sanitizeData(requestBody);
      const sanitizedResponse = sanitizeData(parsedResponseBody);

      // Get client IP
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
                       (req.headers['x-real-ip'] as string) ||
                       req.socket.remoteAddress ||
                       'unknown';

      // Log to Supabase (fire and forget - don't block response)
      void supabaseService.logRequest({
        user_id: req.user?.id,
        endpoint: req.path,
        method: req.method,
        status_code: res.statusCode,
        request_body: sanitizedRequest,
        response_body: sanitizedResponse,
        error_message: res.statusCode >= 400 ? sanitizedResponse?.message || sanitizedResponse?.error : undefined,
        ip_address: ipAddress
      });

      // Console log for development
      console.log(`[API] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    } catch (error) {
      console.error('[Logger] Failed to log request:', error);
    }
  });

  next();
}

/**
 * Sanitize sensitive data from logs
 */
function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveKeys = [
    'password',
    'token',
    'apiKey',
    'api_key',
    'secret',
    'authorization',
    'auth',
    'credit_card',
    'creditCard',
    'ssn',
    'privateKey',
    'private_key'
  ];

  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  for (const key in sanitized) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Error logger middleware
 */
export function errorLogger(err: Error, req: Request, _res: Response, next: NextFunction): void {
  console.error('[Error]', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Log to Supabase
  void supabaseService.logRequest({
    endpoint: req.path,
    method: req.method,
    status_code: 500,
    request_body: sanitizeData(req.body),
    error_message: err.message,
    ip_address: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown'
  });

  next(err);
}
