/**
 * CORS Middleware
 * Allowlist for authorized domains
 */

import cors from 'cors';

// Allowed origins
const allowedOrigins = [
  'https://callwaitingai.dev',
  'https://www.callwaitingai.dev',
  'https://ordervoiceai.odia.dev',
  'http://localhost:8080', // Development
  'http://localhost:5173', // Vite dev server
  'http://localhost:3000'  // Local testing
];

// Add development origins in non-production environments
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push(
    'http://127.0.0.1:8080',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  );
}

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};

export const corsMiddleware = cors(corsOptions);
