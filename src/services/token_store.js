/**
 * Pluggable token store used by middleware/auth.js for refresh tokens and
 * the access-token blacklist. Picks a backend at import time:
 *
 * - `FGD_TOKEN_STORE=redis`  -> uses the Redis client from src/database/redis.js
 * - `FGD_DESKTOP=1`          -> file-backed JSON store under FGD_DATA_DIR
 * - default                   -> in-memory Map (fine for a single Node process)
 *
 * The interface is async throughout so callers can await any backend without
 * special-casing the in-memory one.
 */

import fs from 'fs';
import path from 'path';

function createMemoryStore() {
  const map = new Map();
  return {
    async get(key) {
      const hit = map.get(key);
      if (!hit) return null;
      if (hit.expiresAt && Date.now() > hit.expiresAt) {
        map.delete(key);
        return null;
      }
      return hit.value;
    },
    async set(key, value, ttlMs) {
      map.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : null });
    },
    async delete(key) {
      map.delete(key);
    },
    async has(key) {
      const hit = map.get(key);
      if (!hit) return false;
      if (hit.expiresAt && Date.now() > hit.expiresAt) {
        map.delete(key);
        return false;
      }
      return true;
    },
  };
}

function createFileStore(filePath) {
  let cache = {};
  try {
    if (fs.existsSync(filePath)) {
      cache = JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}');
    }
  } catch (_err) {
    cache = {};
  }

  const flush = () => {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(cache), 'utf8');
    } catch (_err) {
      // best-effort
    }
  };

  return {
    async get(key) {
      const hit = cache[key];
      if (!hit) return null;
      if (hit.expiresAt && Date.now() > hit.expiresAt) {
        delete cache[key];
        flush();
        return null;
      }
      return hit.value;
    },
    async set(key, value, ttlMs) {
      cache[key] = { value, expiresAt: ttlMs ? Date.now() + ttlMs : null };
      flush();
    },
    async delete(key) {
      delete cache[key];
      flush();
    },
    async has(key) {
      const hit = cache[key];
      if (!hit) return false;
      if (hit.expiresAt && Date.now() > hit.expiresAt) {
        delete cache[key];
        flush();
        return false;
      }
      return true;
    },
  };
}

function resolveBackend() {
  const backend = (process.env.FGD_TOKEN_STORE || '').toLowerCase();

  if (backend === 'memory') return createMemoryStore();

  if (process.env.FGD_DESKTOP === '1' || backend === 'file') {
    const dir = process.env.FGD_DATA_DIR || path.join(process.cwd(), 'data');
    return createFileStore(path.join(dir, 'auth-tokens.json'));
  }

  return createMemoryStore();
}

export const tokenStore = resolveBackend();

export default tokenStore;
