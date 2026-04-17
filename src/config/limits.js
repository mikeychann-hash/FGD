/**
 * Centralised runtime limits and tunables.
 *
 * Every value is read from an environment variable with a sensible
 * default so operators can tune without code changes. Callers should
 * import from here rather than hardcoding numbers in individual files.
 */

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringEnv(name, fallback) {
  const raw = process.env[name];
  return raw && raw.trim() ? raw.trim() : fallback;
}

export const AUTH_LIMITS = {
  JWT_EXPIRES_IN: stringEnv('JWT_EXPIRES_IN', '1h'),
  BCRYPT_SALT_ROUNDS: intEnv('BCRYPT_SALT_ROUNDS', 12),
  REFRESH_TOKEN_TTL_MS: intEnv('REFRESH_TOKEN_TTL_MS', 7 * 24 * 60 * 60 * 1000), // 7 days
  BLACKLIST_TTL_SEC: intEnv('JWT_BLACKLIST_TTL_SEC', 60 * 60), // 1 hour, matches default JWT TTL
};

export const RATE_LIMITS = {
  API_WINDOW_MS: intEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  API_MAX: intEnv('RATE_LIMIT_MAX', 100),
  AUTH_WINDOW_MS: intEnv('AUTH_RATE_WINDOW_MS', 15 * 60 * 1000),
  AUTH_MAX: intEnv('AUTH_RATE_MAX', 5),
  BOT_CREATION_WINDOW_MS: intEnv('BOT_CREATION_WINDOW_MS', 60 * 60 * 1000),
  BOT_CREATION_MAX: intEnv('BOT_CREATION_MAX', 10),
  BOT_SPAWN_WINDOW_MS: intEnv('BOT_SPAWN_WINDOW_MS', 60 * 1000),
  BOT_SPAWN_MAX: intEnv('BOT_SPAWN_MAX', 10),
  BOT_SPAWN_ALL_WINDOW_MS: intEnv('BOT_SPAWN_ALL_WINDOW_MS', 5 * 60 * 1000),
  BOT_SPAWN_ALL_MAX: intEnv('BOT_SPAWN_ALL_MAX', 2),
};

export const MINEFLAYER_LIMITS = {
  PATHFINDING_TIMEOUT_MS: intEnv('MF_PATHFINDING_TIMEOUT_MS', 30_000),
  MINING_TIMEOUT_MS: intEnv('MF_MINING_TIMEOUT_MS', 30_000),
  MOVEMENT_TIMEOUT_MS: intEnv('MF_MOVEMENT_TIMEOUT_MS', 60_000),
  INVENTORY_TIMEOUT_MS: intEnv('MF_INVENTORY_TIMEOUT_MS', 5_000),
  CONNECTION_TIMEOUT_MS: intEnv('MF_CONNECTION_TIMEOUT_MS', 30_000),
  RECONNECT_DELAY_MS: intEnv('MF_RECONNECT_DELAY_MS', 5_000),
  MAX_RECONNECT_ATTEMPTS: intEnv('MF_MAX_RECONNECT_ATTEMPTS', 3),
};

export const HTTP_LIMITS = {
  BODY_LIMIT: stringEnv('HTTP_BODY_LIMIT', '1mb'),
};

export default { AUTH_LIMITS, RATE_LIMITS, MINEFLAYER_LIMITS, HTTP_LIMITS };
