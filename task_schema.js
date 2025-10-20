// shared/task_schema.js
// Defines the schema and validation helpers for NPC tasks.
// NPCs cannot reason about elevation, liquids, or hazards with the current schema.
// Enhancing those capabilities would require extending this schema to carry richer navigation context.

export const VALID_ACTIONS = [
  "build",
  "mine",
  "explore",
  "gather",
  "guard",
  "craft",
  "interact",
  "combat"
];

export const actionsRequiringTarget = new Set([
  "build",
  "mine",
  "explore",
  "gather",
  "guard",
  "interact",
  "combat"
]);

export const NPC_TASK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["action", "details"],
  properties: {
    action: {
      type: "string",
      enum: VALID_ACTIONS
    },
    details: {
      type: "string",
      minLength: 1,
      maxLength: 500
    },
    target: {
      type: "object",
      additionalProperties: false,
      required: ["x", "y", "z"],
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        z: { type: "number" },
        dimension: { type: "string" },
        facing: {
          type: "object",
          additionalProperties: false,
          properties: {
            pitch: { type: "number" },
            yaw: { type: "number" }
          }
        }
      }
    },
    metadata: {
      type: "object",
      additionalProperties: true
    },
    priority: {
      type: "string",
      enum: ["low", "normal", "high"],
      default: "normal"
    }
  }
};

export const NPC_TASK_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "npc_task",
    schema: NPC_TASK_SCHEMA
  }
};

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePriority(priority) {
  if (["low", "normal", "high"].includes(priority)) {
    return priority;
  }
  return "normal";
}

export function validateTask(task) {
  const errors = [];

  if (typeof task !== "object" || task === null) {
    return { valid: false, errors: ["Task must be an object"] };
  }

  const normalizedPriority = normalizePriority(task.priority);

  if (!VALID_ACTIONS.includes(task.action)) {
    errors.push(`Unknown action: ${task.action}`);
  }

  if (typeof task.details !== "string" || task.details.trim().length === 0) {
    errors.push("Task details must be a non-empty string");
  }

  if (task.metadata != null && !isObject(task.metadata)) {
    errors.push("Task metadata must be an object when provided");
  }

  const metadata = isObject(task.metadata) ? task.metadata : {};

  if (task.target == null) {
    if (actionsRequiringTarget.has(task.action)) {
      errors.push(`Task target must be provided for action "${task.action}"`);
    }
  } else if (typeof task.target === "object") {
    const { x, y, z } = task.target;
    if (![x, y, z].every(coord => typeof coord === "number" && Number.isFinite(coord))) {
      errors.push("Target coordinates must be finite numbers");
    }
  } else {
    errors.push("Task target must be an object when provided");
  }

  if (task.priority && task.priority !== normalizedPriority) {
    errors.push(`Invalid priority: ${task.priority}`);
  }

  if (task.action === "craft") {
    if (typeof metadata.item !== "string" || metadata.item.trim().length === 0) {
      errors.push("Craft tasks must include metadata.item describing the item to craft");
    }
  }

  if (task.action === "interact") {
    if (typeof metadata.interaction !== "string" || metadata.interaction.trim().length === 0) {
      errors.push("Interact tasks must include metadata.interaction describing the action");
    }
  }

  if (task.action === "combat") {
    if (typeof metadata.targetEntity !== "string" || metadata.targetEntity.trim().length === 0) {
      errors.push("Combat tasks must include metadata.targetEntity describing the opponent");
    }
  }

  return { valid: errors.length === 0, errors };
}
