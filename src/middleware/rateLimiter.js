import rateLimit from 'express-rate-limit';
import { ipKeyGenerator } from 'express-rate-limit';
import { RATE_LIMITS } from '../config/limits.js';

/**
 * General API rate limiter
 * Applied to all /api/ routes
 */
export const apiLimiter = rateLimit({
  windowMs: RATE_LIMITS.API_WINDOW_MS,
  max: RATE_LIMITS.API_MAX,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check endpoints
    return req.path.includes('/health');
  },
});

/**
 * Strict auth rate limiter
 * Applied to /api/auth/login route. Only counts failed login attempts.
 */
export const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH_WINDOW_MS,
  max: RATE_LIMITS.AUTH_MAX,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict bot creation limiter
 * Applied to POST /api/bots route
 */
export const botCreationLimiter = rateLimit({
  windowMs: RATE_LIMITS.BOT_CREATION_WINDOW_MS,
  max: RATE_LIMITS.BOT_CREATION_MAX,
  message: 'Bot creation limit reached, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Spawn limiter - throttles bot spawns per user to prevent floods
 */
export const botSpawnLimiter = rateLimit({
  windowMs: RATE_LIMITS.BOT_SPAWN_WINDOW_MS,
  max: RATE_LIMITS.BOT_SPAWN_MAX,
  message: 'Spawn rate limit reached, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req?.user?.username || ipKeyGenerator(req, res),
});

/**
 * Spawn-all limiter - restricts mass spawns server-wide
 */
export const botSpawnAllLimiter = rateLimit({
  windowMs: RATE_LIMITS.BOT_SPAWN_ALL_WINDOW_MS,
  max: RATE_LIMITS.BOT_SPAWN_ALL_MAX,
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
