import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import compression from 'compression';

/**
 * Creates and configures the Express app, HTTP server, and Socket.IO server
 * @returns {{ app: Express, httpServer: http.Server, io: Server }}
 */
export function createAppServer() {
  const app = express();
  const httpServer = createServer(app);

  // Parse allowed origins from environment variable
  // Falls back to localhost defaults for development
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) || [
    'http://localhost:3000',
    'http://localhost:8080',
  ];

  // CORS middleware for Express with origin validation
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS policy`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    })
  );

  // Socket.IO server with secure CORS configuration
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // Baseline security headers (helmet-equivalent, no extra dependency)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Compression middleware (must come BEFORE static file serving)
  app.use(
    compression({
      threshold: 1024, // Only compress files > 1KB
      level: 6, // Compression level (0-9)
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
    })
  );

  // Parse JSON bodies with an explicit size cap to mitigate large-payload DoS.
  const bodyLimit = process.env.HTTP_BODY_LIMIT || '1mb';
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

  // CORS error handling middleware
  app.use((err, req, res, next) => {
    if (err.message && err.message.includes('not allowed by CORS')) {
      return res.status(403).json({
        error: 'CORS Policy Violation',
        message: 'Origin not allowed',
        allowedOrigins: process.env.NODE_ENV === 'development' ? allowedOrigins : undefined,
      });
    }
    next(err);
  });

  return { app, httpServer, io };
}
