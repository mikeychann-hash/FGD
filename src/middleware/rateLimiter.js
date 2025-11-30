import rateLimit from 'express-rate-limit';
import { ipKeyGenerator } from 'express-rate-limit';

/**
 * General API rate limiter (100 requests per 15 minutes)
 * Applied to all /api/ routes
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check endpoints
    return req.path.includes('/health');
  },
});

/**
 * Strict auth rate limiter (5 login attempts per 15 minutes)
 * Applied to /api/auth/login route
 * Only counts failed login attempts
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict bot creation limiter (10 per hour)
 * Applied to POST /api/bots route
 */
export const botCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Bot creation limit reached, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Spawn limiter - throttles bot spawns per user to prevent floods
 * Default: 10 spawns per minute per authenticated user (falls back to IP)
 */
export const botSpawnLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Spawn rate limit reached, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req?.user?.username || ipKeyGenerator(req, res),
});

/**
 * Spawn-all limiter - restricts mass spawns server-wide
 * Default: 2 spawn-all requests per 5 minutes per user
 */
export const botSpawnAllLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 2,
  message: 'Spawn-all rate limit reached, try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req?.user?.username || ipKeyGenerator(req, res),
});

export default {
  apiLimiter,
  authLimiter,
  botCreationLimiter,
  botSpawnLimiter,
  botSpawnAllLimiter,
};
