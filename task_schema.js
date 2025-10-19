// shared/task_schema.js
// Defines the schema and validation helpers for NPC tasks

export const VALID_ACTIONS = ["build", "mine", "explore", "gather", "guard"];

export const NPC_TASK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["action", "details", "target"],
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

export function validateTask(task) {
  const errors = [];

  if (typeof task !== "object" || task === null) {
    return { valid: false, errors: ["Task must be an object"] };
  }

  if (!VALID_ACTIONS.includes(task.action)) {
    errors.push(`Unknown action: ${task.action}`);
  }

  if (typeof task.details !== "string" || task.details.trim().length === 0) {
    errors.push("Task details must be a non-empty string");
  }

  if (typeof task.target !== "object" || task.target === null) {
    errors.push("Task target must be provided");
  } else {
    const { x, y, z } = task.target;
    if (![x, y, z].every(coord => typeof coord === "number" && Number.isFinite(coord))) {
      errors.push("Target coordinates must be finite numbers");
    }
  }

  if (task.priority && !["low", "normal", "high"].includes(task.priority)) {
    errors.push(`Invalid priority: ${task.priority}`);
  }

  return { valid: errors.length === 0, errors };
}
