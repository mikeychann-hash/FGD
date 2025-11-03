// npc_engine/utils.js
// Shared utilities and helper functions for NPCEngine

export const TASK_TIMEOUT = 30000; // 30 seconds max per task
export const SIMULATED_TASK_DURATION = 3000;
export const DEFAULT_MAX_QUEUE_SIZE = 100; // Default back-pressure threshold

export const PRIORITY_WEIGHT = {
  high: 2,
  normal: 1,
  low: 0
};

export const ACTION_ROLE_PREFERENCES = {
  build: ["builder", "worker"],
  mine: ["miner", "worker"],
  explore: ["scout", "explorer", "builder"],
  gather: ["farmer", "gatherer", "miner"],
  guard: ["guard", "fighter"],
  craft: ["crafter", "builder"],
  interact: ["support", "builder", "worker"],
  combat: ["fighter", "guard"]
};

/**
 * Determines whether a value looks like XYZ coordinates.
 * @param {any} value
 * @returns {{x:number,y:number,z:number}|null}
 */
function normalizeCoordinates(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value.position || value.location || value;
  const { x, y, z } = candidate;

  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return null;
  }

  return {
    x: Number(x),
    y: Number.isFinite(y) ? Number(y) : 0,
    z: Number(z)
  };
}

/**
 * Normalizes priority to one of: low, normal, high
 * @param {string} priority - Priority value to normalize
 * @returns {string} Normalized priority
 */
export function normalizePriority(priority) {
  if (["low", "normal", "high"].includes(priority)) {
    return priority;
  }
  return "normal";
}

/**
 * Normalizes control ratio to a value between 0 and 1
 * @param {number|string} value - Control ratio value
 * @returns {number|undefined} Normalized ratio or undefined
 */
export function normalizeControlRatio(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(1, Math.max(0, value));
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return Math.min(1, Math.max(0, parsed));
  }
  return undefined;
}

/**
 * Deep clones a task object
 * @param {object} task - Task to clone
 * @returns {object} Cloned task
 */
export function cloneTask(task) {
  return {
    ...task,
    target:
      task.target && typeof task.target === "object"
        ? { ...task.target }
        : task.target ?? null,
    metadata: task.metadata ? { ...task.metadata } : {},
    preferredNpcTypes: Array.isArray(task.preferredNpcTypes)
      ? [...task.preferredNpcTypes]
      : []
  };
}

/**
 * Gets preferred NPC types for a task based on action and metadata
 * @param {object} task - Task object
 * @returns {string[]} Array of preferred NPC types
 */
export function getPreferredNpcTypes(task) {
  if (!task || typeof task !== "object") {
    return [];
  }

  const explicitPreference = [];

  if (Array.isArray(task.preferredNpcTypes)) {
    explicitPreference.push(...task.preferredNpcTypes);
  }

  const metadataPreference = task.metadata?.preferredNpcType;
  if (typeof metadataPreference === "string" && metadataPreference.trim().length > 0) {
    explicitPreference.push(metadataPreference.trim());
  }

  const actionPreferences = ACTION_ROLE_PREFERENCES[task.action] || [];

  const merged = [...explicitPreference, ...actionPreferences];
  return [...new Set(merged.filter(Boolean))];
}

/**
 * Derives a spatial target for a task if one is available.
 * @param {object} task - Task object to inspect
 * @param {{x:number,y:number,z:number}|null} [fallback=null] - Fallback position
 * @returns {{x:number,y:number,z:number}|null}
 */
export function getTaskTargetPosition(task, fallback = null) {
  if (!task || typeof task !== "object") {
    return fallback ? { ...fallback } : null;
  }

  const candidates = [
    task.target,
    task.metadata?.target,
    task.metadata?.targetPosition,
    task.metadata?.destination,
    task.metadata?.waypoint,
    Array.isArray(task.metadata?.waypoints) ? task.metadata.waypoints[0] : null,
    task.metadata?.location,
    Array.isArray(task.waypoints) ? task.waypoints[0] : null
  ];

  for (const entry of candidates) {
    const resolved = Array.isArray(entry)
      ? entry.map(normalizeCoordinates).find(Boolean)
      : normalizeCoordinates(entry);

    if (resolved) {
      return resolved;
    }
  }

  return fallback ? { ...fallback } : null;
}
