/**
 * Express Server - Voice API Gateway
 * White-labeled Vapi proxy for CallWaitingAI
 */

import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import { corsMiddleware } from './middleware/cors.middleware';
import { requestLogger, errorLogger } from './middleware/logger.middleware';

// Import routes
import callRoutes from './routes/call.routes';
import assistantRoutes from './routes/assistant.routes';
import webhookRoutes from './routes/webhook.routes';
import logsRoutes from './routes/logs.routes';
import leadsRoutes from './routes/leads.routes';
import chatRoutes from './routes/chat.routes';
import demoCallRoutes from './routes/demo-call.routes';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow external resources for webhooks
}));

// CORS
app.use(corsMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging (Morgan)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Custom request/response logger
app.use(requestLogger);

// Health check endpoint (public - no auth required)
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// API routes
app.use('/api/voice/v1', callRoutes);
app.use('/api/voice/v1', assistantRoutes);
app.use('/api/voice/v1', webhookRoutes);
app.use('/api/voice/v1', logsRoutes);
app.use('/api/voice/v1/leads', leadsRoutes);
app.use('/api/voice/v1/chat', chatRoutes);
app.use('/api/voice/v1/demo-call', demoCallRoutes); // Public endpoint - no auth

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'CallWaitingAI Voice API Gateway',
    version: '1.0.0',
    documentation: 'https://docs.callwaitingai.dev/api',
    endpoints: {
      health: '/health',
      call: 'POST /api/voice/v1/call',
      getCalls: 'GET /api/voice/v1/calls',
      getCall: 'GET /api/voice/v1/call/:callId',
      assistant: 'GET/POST/PATCH/DELETE /api/voice/v1/assistant',
      logs: 'GET /api/voice/v1/logs',
      webhook: 'POST /api/voice/v1/webhook/vapi'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorLogger);

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server] Unhandled error:', err);

  const statusCode = (err as any).statusCode || 500;

  res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  CallWaitingAI Voice API Gateway');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Port: ${PORT}`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log('');
  console.log('  Available endpoints:');
  console.log(`    GET  /health`);
  console.log(`    POST /api/voice/v1/call`);
  console.log(`    GET  /api/voice/v1/calls`);
  console.log(`    GET  /api/voice/v1/call/:callId`);
  console.log(`    POST /api/voice/v1/assistant`);
  console.log(`    GET  /api/voice/v1/assistant/:id`);
  console.log(`    POST /api/voice/v1/webhook/vapi`);
  console.log('');
  console.log('  Press Ctrl+C to stop');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default app;
