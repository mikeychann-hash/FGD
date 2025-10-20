// shared/task_schema.js
// Defines the schema and validation helpers for NPC tasks

export const VALID_ACTIONS = [
  "build",
  "mine",
  "explore",
  "gather",
  "guard",
  "open_chest",
  "craft",
  "fight",
  "check_inventory",
  "assess_equipment"
];

const CHEST_MODES = ["inspect", "deposit", "withdraw"];
const COMBAT_STYLES = ["melee", "ranged", "defensive", "support", "balanced"];
const INVENTORY_MODES = ["summary", "locate", "count", "missing"];
const INVENTORY_SCOPES = ["self", "npc", "chest", "storage", "area"];
const EQUIPMENT_GOALS = ["best_defense", "best_attack", "balanced", "specialized"];
const MINING_PRIORITY_RANKS = ["primary", "secondary", "tertiary", "optional"];
const HAZARD_TYPES = [
  "lava",
  "water",
  "enemy",
  "void",
  "fall",
  "explosive",
  "cave_in",
  "darkness",
  "drowning",
  "gravel",
  "unknown"
];
const HAZARD_SEVERITIES = ["low", "moderate", "high", "critical"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validateItemDescriptor(descriptor, errors, context) {
  if (typeof descriptor === "string") {
    return;
  }

  if (typeof descriptor !== "object" || descriptor === null) {
    errors.push(`${context} item must be a string or object`);
    return;
  }

  const name = descriptor.item || descriptor.id || descriptor.name;
  if (!name || typeof name !== "string") {
    errors.push(`${context} item must include an item/id/name string`);
  }

  if (
    descriptor.count !== undefined &&
    descriptor.quantity !== undefined &&
    descriptor.count !== descriptor.quantity
  ) {
    errors.push(`${context} item count and quantity must match when both provided`);
  }

  const count = descriptor.count ?? descriptor.quantity;
  if (count !== undefined && !isPositiveInteger(count)) {
    errors.push(`${context} item quantity must be a positive integer`);
  }
}

function validateResourceDescriptor(descriptor, errors, context) {
  if (typeof descriptor === "string") {
    return;
  }

  if (typeof descriptor !== "object" || descriptor === null) {
    errors.push(`${context} must be a string or object`);
    return;
  }

  const name = descriptor.block || descriptor.ore || descriptor.material || descriptor.id || descriptor.name || descriptor.tag;
  if (!isNonEmptyString(name)) {
    errors.push(`${context} must identify a block, ore, material, id, name, or tag`);
  }

  if (descriptor.priority && !MINING_PRIORITY_RANKS.includes(descriptor.priority)) {
    errors.push(`${context}.priority must be one of ${MINING_PRIORITY_RANKS.join(", ")}`);
  }

  if (descriptor.quantity !== undefined && !isPositiveInteger(descriptor.quantity)) {
    errors.push(`${context}.quantity must be a positive integer when provided`);
  }

  if (descriptor.depthRange !== undefined) {
    const { min, max } = descriptor.depthRange || {};
    if (min !== undefined && typeof min !== "number") {
      errors.push(`${context}.depthRange.min must be a number when provided`);
    }
    if (max !== undefined && typeof max !== "number") {
      errors.push(`${context}.depthRange.max must be a number when provided`);
    }
  }
}

function validateMiningTarget(target, errors, context) {
  if (typeof target === "string") {
    return;
  }

  if (typeof target !== "object" || target === null) {
    errors.push(`${context} must be a string or object`);
    return;
  }

  const block = target.block || target.ore || target.material || target.id || target.name || target.tag;
  if (!isNonEmptyString(block)) {
    errors.push(`${context} must specify a block, ore, id, name, or tag`);
  }

  if (target.priority && !MINING_PRIORITY_RANKS.includes(target.priority)) {
    errors.push(`${context}.priority must be one of ${MINING_PRIORITY_RANKS.join(", ")}`);
  }

  if (target.quantity !== undefined && !isPositiveInteger(target.quantity)) {
    errors.push(`${context}.quantity must be a positive integer when provided`);
  }

  if (target.avoidHazards !== undefined) {
    if (!Array.isArray(target.avoidHazards)) {
      errors.push(`${context}.avoidHazards must be an array when provided`);
    } else {
      target.avoidHazards.forEach((hazard, index) => {
        if (!isNonEmptyString(hazard)) {
          errors.push(`${context}.avoidHazards[${index}] must be a non-empty string`);
        }
      });
    }
  }
}

function validateHazardDescriptor(descriptor, errors, context) {
  if (typeof descriptor === "string") {
    return;
  }

  if (typeof descriptor !== "object" || descriptor === null) {
    errors.push(`${context} must be a string or object`);
    return;
  }

  if (descriptor.type && !HAZARD_TYPES.includes(descriptor.type) && descriptor.type !== "custom") {
    errors.push(`${context}.type must be one of ${[...HAZARD_TYPES, "custom"].join(", ")}`);
  }

  if (descriptor.severity && !HAZARD_SEVERITIES.includes(descriptor.severity)) {
    errors.push(`${context}.severity must be one of ${HAZARD_SEVERITIES.join(", ")}`);
  }

  if (descriptor.mitigation !== undefined) {
    if (
      !isNonEmptyString(descriptor.mitigation) &&
      !Array.isArray(descriptor.mitigation)
    ) {
      errors.push(`${context}.mitigation must be a string or array of strings when provided`);
    } else if (Array.isArray(descriptor.mitigation)) {
      descriptor.mitigation.forEach((step, index) => {
        if (!isNonEmptyString(step)) {
          errors.push(`${context}.mitigation[${index}] must be a non-empty string`);
        }
      });
    }
  }
}

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

  if (task.action === "mine") {
    if (typeof task.metadata !== "object" || task.metadata === null) {
      errors.push("mine tasks require metadata describing the resource and safety plan");
    } else {
      const { resource, ore, block, targets, hazards, tools, priority, mitigations } = task.metadata;

      const resourceDescriptor = resource ?? ore ?? block;
      if (!resourceDescriptor) {
        errors.push("mine metadata.resource must describe the block or ore being extracted");
      } else {
        validateResourceDescriptor(resourceDescriptor, errors, "mine metadata.resource");
      }

      if (targets !== undefined) {
        if (!Array.isArray(targets) || targets.length === 0) {
          errors.push("mine metadata.targets must be a non-empty array when provided");
        } else {
          targets.forEach((target, index) =>
            validateMiningTarget(target, errors, `mine metadata.targets[${index}]`)
          );
        }
      }

      if (hazards === undefined) {
        errors.push("mine metadata.hazards must be provided (use an empty array if no hazards are present)");
      } else if (!Array.isArray(hazards)) {
        errors.push("mine metadata.hazards must be an array");
      } else {
        hazards.forEach((hazard, index) =>
          validateHazardDescriptor(hazard, errors, `mine metadata.hazards[${index}]`)
        );
      }

      if (priority && !MINING_PRIORITY_RANKS.includes(priority)) {
        errors.push(`mine metadata.priority must be one of ${MINING_PRIORITY_RANKS.join(", ")}`);
      }

      if (tools !== undefined) {
        if (!Array.isArray(tools)) {
          errors.push("mine metadata.tools must be an array when provided");
        } else {
          tools.forEach(item =>
            validateItemDescriptor(item, errors, "mine metadata.tools")
          );
        }
      }

      if (mitigations !== undefined) {
        if (!Array.isArray(mitigations)) {
          errors.push("mine metadata.mitigations must be an array of steps when provided");
        } else {
          mitigations.forEach((step, index) => {
            if (!isNonEmptyString(step) && (typeof step !== "object" || !isNonEmptyString(step?.action))) {
              errors.push(`mine metadata.mitigations[${index}] must be a string or object with an action`);
            }
          });
        }
      }
    }
  }

  if (task.action === "open_chest") {
    if (typeof task.metadata !== "object" || task.metadata === null) {
      errors.push("open_chest tasks require metadata describing the interaction mode");
    } else {
      const { mode, items } = task.metadata;
      if (!CHEST_MODES.includes(mode)) {
        errors.push(`open_chest metadata.mode must be one of ${CHEST_MODES.join(", ")}`);
      }
      if (mode === "deposit" || mode === "withdraw") {
        if (!Array.isArray(items) || items.length === 0) {
          errors.push(`open_chest metadata.items must list at least one item for ${mode} actions`);
        } else {
          items.forEach(item =>
            validateItemDescriptor(item, errors, "open_chest metadata.items")
          );
        }
      }
    }
  }

  if (task.action === "craft") {
    if (typeof task.metadata !== "object" || task.metadata === null) {
      errors.push("craft tasks require metadata describing the recipe");
    } else {
      const { output, recipe, ingredients, quantity } = task.metadata;
      if (!output || typeof output !== "string") {
        errors.push("craft metadata.output must describe the crafted item");
      }

      const recipeList = Array.isArray(recipe) ? recipe : ingredients;
      if (!Array.isArray(recipeList) || recipeList.length === 0) {
        errors.push("craft metadata.recipe must describe required ingredients");
      } else {
        recipeList.forEach(item =>
          validateItemDescriptor(item, errors, "craft metadata.recipe")
        );
      }

      if (quantity !== undefined && !isPositiveInteger(quantity)) {
        errors.push("craft metadata.quantity must be a positive integer when provided");
      }
    }
  }

  if (task.action === "fight") {
    if (typeof task.metadata !== "object" || task.metadata === null) {
      errors.push("fight tasks require metadata describing the target and combat style");
    } else {
      const { target, targetType, style, weapons, support, potions } = task.metadata;

      if (!isNonEmptyString(target) && (typeof target !== "object" || !isNonEmptyString(target?.name))) {
        errors.push("fight metadata.target must describe an enemy or objective name");
      }

      if (targetType && !isNonEmptyString(targetType)) {
        errors.push("fight metadata.targetType must be a non-empty string when provided");
      }

      if (style && !COMBAT_STYLES.includes(style)) {
        errors.push(`fight metadata.style must be one of ${COMBAT_STYLES.join(", ")}`);
      }

      if (Array.isArray(weapons)) {
        weapons.forEach(item => validateItemDescriptor(item, errors, "fight metadata.weapons"));
      } else if (weapons !== undefined) {
        errors.push("fight metadata.weapons must be an array of items when provided");
      }

      if (Array.isArray(potions)) {
        potions.forEach(item => validateItemDescriptor(item, errors, "fight metadata.potions"));
      } else if (potions !== undefined && !Array.isArray(potions)) {
        errors.push("fight metadata.potions must be an array when provided");
      }

      if (support !== undefined && typeof support !== "boolean" && !Array.isArray(support)) {
        errors.push("fight metadata.support must be a boolean or array of support actions");
      }
    }
  }

  if (task.action === "check_inventory") {
    if (task.metadata !== undefined && (typeof task.metadata !== "object" || task.metadata === null)) {
      errors.push("check_inventory metadata must be an object when provided");
    } else if (task.metadata) {
      const { mode, scope, filters, includeEmpty } = task.metadata;

      if (mode && !INVENTORY_MODES.includes(mode)) {
        errors.push(`check_inventory metadata.mode must be one of ${INVENTORY_MODES.join(", ")}`);
      }

      if (scope && !INVENTORY_SCOPES.includes(scope)) {
        errors.push(`check_inventory metadata.scope must be one of ${INVENTORY_SCOPES.join(", ")}`);
      }

      if (filters !== undefined) {
        if (!Array.isArray(filters)) {
          errors.push("check_inventory metadata.filters must be an array when provided");
        } else {
          filters.forEach((filter, index) => {
            if (typeof filter === "string") return;
            if (typeof filter !== "object" || filter === null) {
              errors.push(`check_inventory metadata.filters[${index}] must be a string or object`);
            } else if (!isNonEmptyString(filter.item) && !isNonEmptyString(filter.tag)) {
              errors.push(`check_inventory metadata.filters[${index}] must include an item or tag`);
            }
          });
        }
      }

      if (includeEmpty !== undefined && typeof includeEmpty !== "boolean") {
        errors.push("check_inventory metadata.includeEmpty must be a boolean when provided");
      }
    }
  }

  if (task.action === "assess_equipment") {
    if (typeof task.metadata !== "object" || task.metadata === null) {
      errors.push("assess_equipment tasks require metadata describing evaluation goals");
    } else {
      const { goal, criteria, preferredStyle, candidates, minimumTier } = task.metadata;

      if (goal && !EQUIPMENT_GOALS.includes(goal)) {
        errors.push(`assess_equipment metadata.goal must be one of ${EQUIPMENT_GOALS.join(", ")}`);
      }

      if (criteria !== undefined) {
        if (Array.isArray(criteria)) {
          criteria.forEach((entry, index) => {
            if (!isNonEmptyString(entry)) {
              errors.push(`assess_equipment metadata.criteria[${index}] must be a non-empty string`);
            }
          });
        } else if (!isNonEmptyString(criteria)) {
          errors.push("assess_equipment metadata.criteria must be a string or array of strings");
        }
      }

      if (preferredStyle && !COMBAT_STYLES.includes(preferredStyle)) {
        errors.push(`assess_equipment metadata.preferredStyle must be one of ${COMBAT_STYLES.join(", ")}`);
      }

      if (candidates !== undefined) {
        if (!Array.isArray(candidates)) {
          errors.push("assess_equipment metadata.candidates must be an array when provided");
        } else {
          candidates.forEach(item =>
            validateItemDescriptor(item, errors, "assess_equipment metadata.candidates")
          );
        }
      }

      if (minimumTier !== undefined && !isNonEmptyString(minimumTier)) {
        errors.push("assess_equipment metadata.minimumTier must be a non-empty string when provided");
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
