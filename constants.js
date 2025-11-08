// constants.js
// Shared constants for FGD bot system

/**
 * Maximum number of bots that can be spawned simultaneously
 * This limit prevents server overload and ensures stable performance
 */
export const MAX_BOTS = 8;

/**
 * Default bot spawn position (world spawn)
 */
export const DEFAULT_SPAWN_POSITION = { x: 0, y: 64, z: 0 };

/**
 * Bot tick rate (milliseconds between updates)
 */
export const DEFAULT_TICK_RATE_MS = 200;

/**
 * Bot scan interval (milliseconds between area scans)
 */
export const DEFAULT_SCAN_INTERVAL_MS = 1500;

/**
 * Default scan radius (blocks)
 */
export const DEFAULT_SCAN_RADIUS = 5;

/**
 * Maximum retry attempts for failed spawns
 */
export const MAX_SPAWN_RETRIES = 3;

/**
 * Base retry delay (milliseconds) for exponential backoff
 */
export const RETRY_DELAY_MS = 1000;

/**
 * Maximum task queue size
 */
export const MAX_QUEUE_SIZE = 100;

/**
 * Bot memory context size
 */
export const MEMORY_SIZE = 10;

/**
 * Minecraft world height limits
 */
export const WORLD_BOUNDS = {
  MIN_Y: -64,
  MAX_Y: 320
};

/**
 * Default bot statuses
 */
export const BOT_STATUS = {
  IDLE: 'idle',
  ACTIVE: 'active',
  WORKING: 'working',
  MOVING: 'moving',
  RESTING: 'resting',
  INACTIVE: 'inactive'
};

/**
 * Bot roles
 */
export const BOT_ROLES = {
  MINER: 'miner',
  BUILDER: 'builder',
  SCOUT: 'scout',
  GUARD: 'guard',
  GATHERER: 'gatherer',
  EXPLORER: 'explorer',
  FIGHTER: 'fighter',
  FARMER: 'farmer'
};

/**
 * Task priorities
 */
export const TASK_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical'
};
