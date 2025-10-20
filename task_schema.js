// shared/task_schema.js
// Defines the schema and validation helpers for NPC tasks.
// Supports navigationContext fields that describe elevation, liquid, and hazard reasoning for movement tasks.

export const VALID_ACTIONS = [
  "build",
  "mine",
  "explore",
  "gather",
  "guard",
  "craft",
  "interact",
  "combat",
  "navigate"
];

export const actionsRequiringTarget = new Set([
  "build",
  "mine",
  "explore",
  "gather",
  "guard",
  "interact",
  "combat",
  "navigate"
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
    navigationContext: {
      type: "object",
      additionalProperties: false,
      properties: {
        viable: { type: "boolean" },
        path: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "z"],
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              z: { type: "number" },
              elevation: { type: "number" },
              liquid: { type: ["string", "null"] },
              hazards: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    type: { type: "string" },
                    severity: { type: "string" },
                    description: { type: ["string", "null"] }
                  }
                }
              }
            }
          }
        },
        elevationGain: { type: "number" },
        elevationDrop: { type: "number" },
        liquidSegments: { type: "number" },
        hazards: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string" },
              severity: { type: "string" },
              description: { type: ["string", "null"] },
              location: {
                type: "object",
                additionalProperties: false,
                required: ["x", "y", "z"],
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                  z: { type: "number" }
                }
              }
            }
          }
        },
        estimatedCost: { type: "number" },
        movementMode: { type: "string" },
        allowWater: { type: "boolean" },
        directives: {
          type: "object",
          additionalProperties: true,
          properties: {
            avoidHazards: {
              type: "array",
              items: { type: "string" }
            },
            targetElevation: { type: "string" },
            seekLiquid: { type: "string" }
          }
        }
      }
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

  if (task.navigationContext != null) {
    if (!isObject(task.navigationContext)) {
      errors.push("Navigation context must be an object when provided");
    } else {
      const { path, hazards, viable, estimatedCost, movementMode, allowWater, directives } = task.navigationContext;
      if (path != null && !Array.isArray(path)) {
        errors.push("Navigation context path must be an array when provided");
      }
      if (Array.isArray(path)) {
        for (const step of path) {
          if (!isObject(step)) {
            errors.push("Navigation context path entries must be objects");
            break;
          }
          const { x, y, z } = step;
          if (![x, y, z].every(coord => typeof coord === "number" && Number.isFinite(coord))) {
            errors.push("Navigation context path coordinates must be finite numbers");
            break;
          }
        }
      }
      if (hazards != null && !Array.isArray(hazards)) {
        errors.push("Navigation context hazards must be an array when provided");
      }
      if (typeof viable !== "undefined" && typeof viable !== "boolean") {
        errors.push("Navigation context viable flag must be a boolean when provided");
      }
      if (typeof estimatedCost !== "undefined" && typeof estimatedCost !== "number") {
        errors.push("Navigation context estimatedCost must be a number when provided");
      }
      if (typeof movementMode !== "undefined" && typeof movementMode !== "string") {
        errors.push("Navigation context movementMode must be a string when provided");
      }
      if (typeof allowWater !== "undefined" && typeof allowWater !== "boolean") {
        errors.push("Navigation context allowWater must be a boolean when provided");
      }
      if (directives != null) {
        if (!isObject(directives)) {
          errors.push("Navigation context directives must be an object when provided");
        } else {
          if (directives.avoidHazards != null && !Array.isArray(directives.avoidHazards)) {
            errors.push("Navigation context directives.avoidHazards must be an array when provided");
          }
          if (Array.isArray(directives.avoidHazards)) {
            for (const hazard of directives.avoidHazards) {
              if (typeof hazard !== "string") {
                errors.push("Navigation context directives.avoidHazards entries must be strings");
                break;
              }
            }
          }
          if (directives.targetElevation != null && typeof directives.targetElevation !== "string") {
            errors.push("Navigation context directives.targetElevation must be a string when provided");
          }
          if (directives.seekLiquid != null && typeof directives.seekLiquid !== "string") {
            errors.push("Navigation context directives.seekLiquid must be a string when provided");
          }
        }
      }
    }
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
