import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

/**
 * Resolve the runtime data directory. When running inside Electron,
 * `FGD_DATA_DIR` points at a writable per-user location
 * (app.getPath('userData')/data) so the installed bundle is never
 * mutated at runtime. Falls back to the repo-local `data/` for dev/server.
 *
 * @returns {string} absolute path to the runtime data dir
 */
export function getDataDir() {
  const envDir = process.env.FGD_DATA_DIR;
  const resolved = envDir && envDir.trim() !== ''
    ? path.resolve(envDir)
    : path.join(REPO_ROOT, 'data');
  try {
    fs.mkdirSync(resolved, { recursive: true });
  } catch (_err) {
    // best-effort; callers will surface IO errors
  }
  return resolved;
}

/**
 * Resolve a file inside the runtime data dir.
 * @param {...string} segments path segments
 * @returns {string} absolute path
 */
export function dataPath(...segments) {
  return path.join(getDataDir(), ...segments);
}

export default { getDataDir, dataPath };
