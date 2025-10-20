// shared/task_schema.js
// Defines the schema and validation helpers for NPC tasks

export const VALID_ACTIONS = [
  "build",
  "mine",
  "explore",
  "gather",
  "guard",
  "open_chest",
  "open_inventory",
  "craft",
  "fight",
  "check_inventory",
  "manage_inventory",
  "use_item",
  "equip_item",
  "dig",
  "assess_equipment"
];

const CHEST_MODES = ["inspect", "deposit", "withdraw"];
const COMBAT_STYLES = ["melee", "ranged", "defensive", "support", "balanced"];
const INVENTORY_MODES = ["summary", "locate", "count", "missing"];
const INVENTORY_SCOPES = ["self", "npc", "chest", "storage", "area"];
const INVENTORY_VIEWS = ["overview", "hotbar", "equipment", "crafting", "materials"];
const INVENTORY_PRIORITY_LEVELS = ["critical", "high", "medium", "low", "junk"];
const EQUIPMENT_GOALS = ["best_defense", "best_attack", "balanced", "specialized"];
const EQUIP_SLOTS = [
  "main_hand",
  "off_hand",
  "head",
  "chest",
  "legs",
  "feet",
  "hotbar",
  "accessory"
];
const ITEM_USAGE_TYPES = [
  "heal",
  "buff",
  "attack",
  "utility",
  "tool",
  "place",
  "consume",
  "equip",
  "interact"
];
const MINING_PRIORITY_RANKS = ["primary", "secondary", "tertiary", "optional"];
const LOADOUT_PRIORITIES = ["primary", "secondary", "backup"];
const DIG_STRATEGIES = [
  "clear",
  "tunnel",
  "staircase",
  "quarry",
  "strip",
  "pillar"
];
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
const MINING_DIRECTIVE_ACTIONS = [
  "pause",
  "resume",
  "reroute",
  "request_support",
  "request_tools",
  "continue"
];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
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

function validateInventoryFocusList(list, errors, context) {
  if (list === undefined) {
    return;
  }

  if (!Array.isArray(list)) {
    errors.push(`${context} must be an array when provided`);
    return;
  }

  list.forEach((entry, index) => {
    if (typeof entry === "string") {
      if (!isNonEmptyString(entry)) {
        errors.push(`${context}[${index}] must not be an empty string`);
      }
      return;
    }

    if (typeof entry !== "object" || entry === null) {
      errors.push(`${context}[${index}] must be a string or object`);
      return;
    }

    if (!isNonEmptyString(entry.item) && !isNonEmptyString(entry.tag)) {
      errors.push(`${context}[${index}] must include an item or tag`);
    }

    if (entry.tag && !isNonEmptyString(entry.tag)) {
      errors.push(`${context}[${index}].tag must be a non-empty string when provided`);
    }

    if (entry.item) {
      validateItemDescriptor(entry.item, errors, `${context}[${index}].item`);
    }
  });
}

function validateInventoryPriorityEntry(entry, errors, context) {
  if (typeof entry === "string") {
    return;
  }

  if (typeof entry !== "object" || entry === null) {
    errors.push(`${context} must be a string or object`);
    return;
  }

  if (!entry.item && !entry.tag && !entry.category) {
    errors.push(`${context} must include an item, tag, or category`);
  }

  if (entry.item) {
    validateItemDescriptor(entry.item, errors, `${context}.item`);
  }

  if (entry.tag && !isNonEmptyString(entry.tag)) {
    errors.push(`${context}.tag must be a non-empty string when provided`);
  }

  if (entry.category && !isNonEmptyString(entry.category)) {
    errors.push(`${context}.category must be a non-empty string when provided`);
  }

  if (entry.priority) {
    const normalized = String(entry.priority).toLowerCase();
    if (!INVENTORY_PRIORITY_LEVELS.includes(normalized)) {
      errors.push(
        `${context}.priority must be one of ${INVENTORY_PRIORITY_LEVELS.join(", ")}`
      );
    }
  }

  ["minCount", "maxCount", "desired", "desiredCount"].forEach(field => {
    if (entry[field] !== undefined) {
      const value = Number(entry[field]);
      if (!Number.isFinite(value) || value < 0) {
        errors.push(`${context}.${field} must be a non-negative number when provided`);
      }
    }
  });

  if (entry.actions !== undefined) {
    const actions = Array.isArray(entry.actions) ? entry.actions : [entry.actions];
    actions.forEach((action, index) => {
      if (!isNonEmptyString(action)) {
        errors.push(`${context}.actions[${index}] must be a non-empty string`);
      }
    });
  }
}

function validateInventoryPriorities(priorities, errors, context) {
  if (priorities === undefined) {
    return;
  }

  if (!Array.isArray(priorities) || priorities.length === 0) {
    errors.push(`${context} must be a non-empty array when provided`);
    return;
  }

  priorities.forEach((entry, index) =>
    validateInventoryPriorityEntry(entry, errors, `${context}[${index}]`)
  );
}

function validateUsageType(value, errors, context) {
  if (value === undefined) {
    return;
  }

  if (!isNonEmptyString(value)) {
    errors.push(`${context} must be a non-empty string when provided`);
    return;
  }

  const normalized = value.toLowerCase();
  if (!ITEM_USAGE_TYPES.includes(normalized)) {
    errors.push(`${context} must be one of ${ITEM_USAGE_TYPES.join(", ")}`);
  }
}

function validateTargetDescriptor(descriptor, errors, context) {
  if (descriptor === undefined || descriptor === null) {
    return;
  }

  if (typeof descriptor === "string") {
    if (!isNonEmptyString(descriptor)) {
      errors.push(`${context} must not be an empty string`);
    }
    return;
  }

  if (typeof descriptor !== "object") {
    errors.push(`${context} must be a string or object`);
    return;
  }

  if (descriptor.id !== undefined && !isNonEmptyString(descriptor.id)) {
    errors.push(`${context}.id must be a non-empty string when provided`);
  }

  if (descriptor.name !== undefined && !isNonEmptyString(descriptor.name)) {
    errors.push(`${context}.name must be a non-empty string when provided`);
  }

  if (descriptor.type !== undefined && !isNonEmptyString(descriptor.type)) {
    errors.push(`${context}.type must be a non-empty string when provided`);
  }

  if (descriptor.position !== undefined) {
    const pos = descriptor.position;
    if (typeof pos !== "object" || pos === null) {
      errors.push(`${context}.position must be an object when provided`);
    } else {
      ["x", "y", "z"].forEach(axis => {
        if (pos[axis] !== undefined && typeof pos[axis] !== "number") {
          errors.push(`${context}.position.${axis} must be a number when provided`);
        }
      });
    }
  }
}

function validateUseItemMetadata(metadata, errors, context) {
  if (typeof metadata !== "object" || metadata === null) {
    errors.push(`${context} must be an object`);
    return;
  }

  if (metadata.item === undefined) {
    errors.push(`${context}.item is required`);
  } else {
    validateItemDescriptor(metadata.item, errors, `${context}.item`);
  }

  validateUsageType(metadata.usage ?? metadata.purpose, errors, `${context}.usage`);
  validateTargetDescriptor(metadata.target, errors, `${context}.target`);

  if (metadata.quantity !== undefined && !isPositiveInteger(metadata.quantity)) {
    errors.push(`${context}.quantity must be a positive integer when provided`);
  }

  if (metadata.cooldown !== undefined && typeof metadata.cooldown !== "number") {
    errors.push(`${context}.cooldown must be a number when provided`);
  }

  if (metadata.healAmount !== undefined && typeof metadata.healAmount !== "number") {
    errors.push(`${context}.healAmount must be a number when provided`);
  }

  if (metadata.conditions !== undefined) {
    if (!Array.isArray(metadata.conditions)) {
      errors.push(`${context}.conditions must be an array when provided`);
    } else {
      metadata.conditions.forEach((condition, index) => {
        if (!isNonEmptyString(condition)) {
          errors.push(`${context}.conditions[${index}] must be a non-empty string`);
        }
      });
    }
  }

  if (metadata.fallbacks !== undefined) {
    if (!Array.isArray(metadata.fallbacks)) {
      errors.push(`${context}.fallbacks must be an array when provided`);
    } else {
      metadata.fallbacks.forEach((item, index) =>
        validateItemDescriptor(item, errors, `${context}.fallbacks[${index}]`)
      );
    }
  }
}

function validateEquipMetadata(metadata, errors, context) {
  if (typeof metadata !== "object" || metadata === null) {
    errors.push(`${context} must be an object`);
    return;
  }

  if (!metadata.item && !metadata.candidates && !metadata.category) {
    errors.push(`${context} must include item, candidates, or category`);
  }

  if (metadata.item) {
    validateItemDescriptor(metadata.item, errors, `${context}.item`);
  }

  if (metadata.candidates !== undefined) {
    if (!Array.isArray(metadata.candidates) || metadata.candidates.length === 0) {
      errors.push(`${context}.candidates must be a non-empty array when provided`);
    } else {
      metadata.candidates.forEach((item, index) =>
        validateItemDescriptor(item, errors, `${context}.candidates[${index}]`)
      );
    }
  }

  if (metadata.category !== undefined && !isNonEmptyString(metadata.category)) {
    errors.push(`${context}.category must be a non-empty string when provided`);
  }

  if (metadata.slot !== undefined) {
    const slot = metadata.slot.toLowerCase();
    if (!EQUIP_SLOTS.includes(slot)) {
      errors.push(`${context}.slot must be one of ${EQUIP_SLOTS.join(", ")}`);
    }
  }

  if (metadata.preferred !== undefined) {
    if (!Array.isArray(metadata.preferred)) {
      errors.push(`${context}.preferred must be an array when provided`);
    } else {
      metadata.preferred.forEach((item, index) =>
        validateItemDescriptor(item, errors, `${context}.preferred[${index}]`)
      );
    }
  }

  if (metadata.backups !== undefined) {
    if (!Array.isArray(metadata.backups)) {
      errors.push(`${context}.backups must be an array when provided`);
    } else {
      metadata.backups.forEach((item, index) =>
        validateItemDescriptor(item, errors, `${context}.backups[${index}]`)
      );
    }
  }

  if (metadata.priority !== undefined) {
    const normalized = String(metadata.priority).toLowerCase();
    if (!LOADOUT_PRIORITIES.includes(normalized)) {
      errors.push(
        `${context}.priority must be one of ${LOADOUT_PRIORITIES.join(", ")}`
      );
    }
  }

  if (metadata.requirements !== undefined) {
    if (!Array.isArray(metadata.requirements)) {
      errors.push(`${context}.requirements must be an array when provided`);
    } else {
      metadata.requirements.forEach((req, index) => {
        if (!isNonEmptyString(req)) {
          errors.push(`${context}.requirements[${index}] must be a non-empty string`);
        }
      });
    }
  }
}

function validateAreaDescriptor(area, errors, context) {
  if (typeof area !== "object" || area === null) {
    errors.push(`${context} must be an object describing the dig area`);
    return;
  }

  if (!isNonEmptyString(area.shape) && !isNonEmptyString(area.type)) {
    errors.push(`${context}.shape must describe the area shape`);
  } else {
    const shape = (area.shape || area.type).toLowerCase();
    if (!DIG_STRATEGIES.includes(shape) && !["cube", "circle", "rectangle", "custom"].includes(shape)) {
      errors.push(
        `${context}.shape must be one of ${[...DIG_STRATEGIES, "cube", "circle", "rectangle", "custom"].join(", ")}`
      );
    }
  }

  if (area.dimensions !== undefined) {
    if (typeof area.dimensions !== "object" || area.dimensions === null) {
      errors.push(`${context}.dimensions must be an object when provided`);
    } else {
      ["width", "height", "length", "radius"].forEach(key => {
        if (area.dimensions[key] !== undefined && typeof area.dimensions[key] !== "number") {
          errors.push(`${context}.dimensions.${key} must be a number when provided`);
        }
      });
    }
  }

  if (area.depth !== undefined && typeof area.depth !== "number") {
    errors.push(`${context}.depth must be a number when provided`);
  }

  if (area.levels !== undefined && !isPositiveInteger(area.levels)) {
    errors.push(`${context}.levels must be a positive integer when provided`);
  }
}

function validateDigMetadata(metadata, errors, context) {
  if (typeof metadata !== "object" || metadata === null) {
    errors.push(`${context} must be an object`);
    return;
  }

  if (!metadata.area) {
    errors.push(`${context}.area is required to describe the dig region`);
  } else {
    validateAreaDescriptor(metadata.area, errors, `${context}.area`);
  }

  if (metadata.depth !== undefined && typeof metadata.depth !== "number") {
    errors.push(`${context}.depth must be a number when provided`);
  }

  if (metadata.layers !== undefined && !isPositiveInteger(metadata.layers)) {
    errors.push(`${context}.layers must be a positive integer when provided`);
  }

  if (metadata.strategy !== undefined) {
    const strategy = metadata.strategy.toLowerCase();
    if (!DIG_STRATEGIES.includes(strategy)) {
      errors.push(`${context}.strategy must be one of ${DIG_STRATEGIES.join(", ")}`);
    }
  }

  if (metadata.hazards !== undefined) {
    if (!Array.isArray(metadata.hazards)) {
      errors.push(`${context}.hazards must be an array when provided`);
    } else {
      metadata.hazards.forEach((hazard, index) =>
        validateHazardDescriptor(hazard, errors, `${context}.hazards[${index}]`)
      );
    }
  }

  if (metadata.mitigations !== undefined) {
    if (!Array.isArray(metadata.mitigations)) {
      errors.push(`${context}.mitigations must be an array when provided`);
    } else {
      metadata.mitigations.forEach((step, index) => {
        if (!isNonEmptyString(step) && (typeof step !== "object" || !isNonEmptyString(step?.action))) {
          errors.push(`${context}.mitigations[${index}] must be a string or object with an action`);
        }
      });
    }
  }

  if (metadata.tools !== undefined) {
    if (!Array.isArray(metadata.tools)) {
      errors.push(`${context}.tools must be an array when provided`);
    } else {
      metadata.tools.forEach((tool, index) =>
        validateItemDescriptor(tool, errors, `${context}.tools[${index}]`)
      );
    }
  }

  validateMiningStatusDirectives(
    metadata.statusDirectives,
    errors,
    `${context}.statusDirectives`
  );
}

function validateDirectiveAction(action, errors, context) {
  if (!isNonEmptyString(action)) {
    errors.push(`${context}.action must be a non-empty string`);
    return;
  }

  const normalized = action.toLowerCase();
  if (!MINING_DIRECTIVE_ACTIONS.includes(normalized)) {
    errors.push(
      `${context}.action must be one of ${MINING_DIRECTIVE_ACTIONS.join(", ")}`
    );
  }
}

function validateDirectiveNotify(notify, errors, context) {
  if (notify === undefined) {
    return;
  }

  const list = Array.isArray(notify) ? notify : [notify];
  list.forEach((entry, index) => {
    if (!isNonEmptyString(entry)) {
      errors.push(`${context}.notify[${index}] must be a non-empty string`);
    }
  });
}

function validateDirectiveRequest(request, errors, context) {
  if (request === undefined) {
    return;
  }

  if (typeof request === "string") {
    if (!isNonEmptyString(request)) {
      errors.push(`${context}.request must not be an empty string`);
    }
    return;
  }

  if (typeof request !== "object" || request === null) {
    errors.push(`${context}.request must be a string or object when provided`);
    return;
  }

  if (request.items !== undefined) {
    const items = Array.isArray(request.items) ? request.items : [request.items];
    items.forEach((item, index) =>
      validateItemDescriptor(item, errors, `${context}.request.items[${index}]`)
    );
  }

  if (request.message !== undefined && !isNonEmptyString(request.message)) {
    errors.push(`${context}.request.message must be a non-empty string when provided`);
  }

  if (request.reason !== undefined && !isNonEmptyString(request.reason)) {
    errors.push(`${context}.request.reason must be a non-empty string when provided`);
  }
}

function validateHazardDirectiveEntry(entry, errors, context) {
  if (typeof entry === "string") {
    return;
  }

  if (typeof entry !== "object" || entry === null) {
    errors.push(`${context} must be a string or object`);
    return;
  }

  if (entry.type !== undefined && !isNonEmptyString(entry.type)) {
    errors.push(`${context}.type must be a non-empty string when provided`);
  }

  if (entry.severity !== undefined && !HAZARD_SEVERITIES.includes(entry.severity)) {
    errors.push(`${context}.severity must be one of ${HAZARD_SEVERITIES.join(", ")}`);
  }

  validateDirectiveAction(entry.action ?? "pause", errors, `${context}`);
  validateDirectiveNotify(entry.notify, errors, context);
  validateDirectiveRequest(entry.request, errors, context);

  if (entry.escalate !== undefined) {
    validateDirectiveAction(entry.escalate, errors, `${context}.escalate`);
  }

  if (entry.reroute !== undefined && !isNonEmptyString(entry.reroute)) {
    errors.push(`${context}.reroute must be a non-empty string when provided`);
  }

  if (entry.resume !== undefined) {
    validateDirectiveAction(entry.resume, errors, `${context}.resume`);
  }
}

function validateDirectiveBlock(block, errors, context, defaultAction = "continue") {
  if (block === undefined) {
    return;
  }

  if (typeof block === "string") {
    if (!isNonEmptyString(block)) {
      errors.push(`${context} must not be an empty string`);
      return;
    }

    validateDirectiveAction(block, errors, context);
    return;
  }

  if (typeof block !== "object" || block === null) {
    errors.push(`${context} must be a string or object`);
    return;
  }

  validateDirectiveAction(block.action ?? defaultAction, errors, context);
  validateDirectiveNotify(block.notify, errors, context);
  validateDirectiveRequest(block.request, errors, context);

  if (block.reroute !== undefined && !isNonEmptyString(block.reroute)) {
    errors.push(`${context}.reroute must be a non-empty string when provided`);
  }

  if (block.priority !== undefined && !isNonEmptyString(block.priority)) {
    errors.push(`${context}.priority must be a non-empty string when provided`);
  }
}

function validateMiningStatusDirectives(directives, errors, context) {
  if (directives === undefined) {
    return;
  }

  if (typeof directives !== "object" || directives === null) {
    errors.push(`${context} must be an object when provided`);
    return;
  }

  if (directives.hazards !== undefined) {
    if (!Array.isArray(directives.hazards) || directives.hazards.length === 0) {
      errors.push(`${context}.hazards must be a non-empty array when provided`);
    } else {
      directives.hazards.forEach((entry, index) =>
        validateHazardDirectiveEntry(entry, errors, `${context}.hazards[${index}]`)
      );
    }
  }

  validateDirectiveBlock(directives.depletion, errors, `${context}.depletion`, "continue");
  validateDirectiveBlock(
    directives.toolFailure,
    errors,
    `${context}.toolFailure`,
    "request_tools"
  );
  validateDirectiveBlock(directives.resume, errors, `${context}.resume`, "resume");
  validateDirectiveBlock(directives.fallback, errors, `${context}.fallback`, "pause");
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
      const {
        resource,
        ore,
        block,
        targets,
        hazards,
        tools,
        priority,
        mitigations,
        statusDirectives
      } = task.metadata;

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

      if (!Array.isArray(tools) || tools.length === 0) {
        errors.push("mine metadata.tools must list at least one tool item");
      } else {
        tools.forEach((item, index) =>
          validateItemDescriptor(item, errors, `mine metadata.tools[${index}]`)
        );
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

      validateMiningStatusDirectives(
        statusDirectives,
        errors,
        "mine metadata.statusDirectives"
      );
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

  if (task.action === "open_inventory") {
    if (typeof task.metadata !== "object" || task.metadata === null) {
      errors.push("open_inventory tasks require metadata describing the view and scope");
    } else {
      const { scope, view, focus, priorities, actions, autoSort, includeEquipment } =
        task.metadata;

      if (!scope || !INVENTORY_SCOPES.includes(scope)) {
        errors.push(
          `open_inventory metadata.scope must be one of ${INVENTORY_SCOPES.join(", ")}`
        );
      }

      if (view !== undefined) {
        if (!isNonEmptyString(view)) {
          errors.push("open_inventory metadata.view must be a non-empty string when provided");
        } else {
          const normalized = view.toLowerCase();
          if (!INVENTORY_VIEWS.includes(normalized)) {
            errors.push(
              `open_inventory metadata.view must be one of ${INVENTORY_VIEWS.join(", ")}`
            );
          }
        }
      }

      validateInventoryFocusList(focus, errors, "open_inventory metadata.focus");
      validateInventoryPriorities(priorities, errors, "open_inventory metadata.priorities");

      if (actions !== undefined) {
        if (!Array.isArray(actions)) {
          errors.push("open_inventory metadata.actions must be an array when provided");
        } else {
          actions.forEach((action, index) => {
            if (!isNonEmptyString(action)) {
              errors.push(`open_inventory metadata.actions[${index}] must be a non-empty string`);
            }
          });
        }
      }

      if (autoSort !== undefined && typeof autoSort !== "boolean") {
        errors.push("open_inventory metadata.autoSort must be a boolean when provided");
      }

      if (includeEquipment !== undefined && typeof includeEquipment !== "boolean") {
        errors.push(
          "open_inventory metadata.includeEquipment must be a boolean when provided"
        );
      }
    }
  }

  if (task.action === "craft") {
    if (typeof task.metadata !== "object" || task.metadata === null) {
      errors.push("craft tasks require metadata describing the recipe");
    } else {
      const { output, recipe, ingredients, quantity, tools, priority, autoCraft } =
        task.metadata;
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

      if (tools !== undefined) {
        if (!Array.isArray(tools) || tools.length === 0) {
          errors.push("craft metadata.tools must be a non-empty array when provided");
        } else {
          tools.forEach((tool, index) =>
            validateItemDescriptor(tool, errors, `craft metadata.tools[${index}]`)
          );
        }
      }

      if (priority !== undefined) {
        const normalized = String(priority).toLowerCase();
        if (!INVENTORY_PRIORITY_LEVELS.includes(normalized)) {
          errors.push(
            `craft metadata.priority must be one of ${INVENTORY_PRIORITY_LEVELS.join(", ")}`
          );
        }
      }

      if (autoCraft !== undefined && typeof autoCraft !== "boolean") {
        errors.push("craft metadata.autoCraft must be a boolean when provided");
      }
    }
  }

  if (task.action === "fight") {
    if (typeof task.metadata !== "object" || task.metadata === null) {
      errors.push("fight tasks require metadata describing the target and combat style");
    } else {
      const {
        target,
        targetType,
        style,
        weapons,
        support,
        potions,
        preferredWeapons,
        backupWeapons,
        healingItems,
        weaponType
      } = task.metadata;

      if (!isNonEmptyString(target) && (typeof target !== "object" || !isNonEmptyString(target?.name))) {
        errors.push("fight metadata.target must describe an enemy or objective name");
      }

      if (targetType && !isNonEmptyString(targetType)) {
        errors.push("fight metadata.targetType must be a non-empty string when provided");
      }

      if (style && !COMBAT_STYLES.includes(style)) {
        errors.push(`fight metadata.style must be one of ${COMBAT_STYLES.join(", ")}`);
      }

      const hasWeapons = Array.isArray(weapons) && weapons.length > 0;

      if (weapons !== undefined) {
        if (!Array.isArray(weapons)) {
          errors.push("fight metadata.weapons must be an array of items when provided");
        } else {
          weapons.forEach((item, index) =>
            validateItemDescriptor(item, errors, `fight metadata.weapons[${index}]`)
          );
        }
      }

      if (preferredWeapons !== undefined) {
        if (!Array.isArray(preferredWeapons) || preferredWeapons.length === 0) {
          errors.push("fight metadata.preferredWeapons must be a non-empty array when provided");
        } else {
          preferredWeapons.forEach((item, index) =>
            validateItemDescriptor(item, errors, `fight metadata.preferredWeapons[${index}]`)
          );
        }
      }

      if (backupWeapons !== undefined) {
        if (!Array.isArray(backupWeapons)) {
          errors.push("fight metadata.backupWeapons must be an array when provided");
        } else {
          backupWeapons.forEach((item, index) =>
            validateItemDescriptor(item, errors, `fight metadata.backupWeapons[${index}]`)
          );
        }
      }

      const hasPreferred = Array.isArray(preferredWeapons) && preferredWeapons.length > 0;

      if (!hasWeapons && !hasPreferred) {
        errors.push("fight tasks must include weapons or preferredWeapons to guide combat loadout");
      }

      if (Array.isArray(potions)) {
        potions.forEach(item => validateItemDescriptor(item, errors, "fight metadata.potions"));
      } else if (potions !== undefined && !Array.isArray(potions)) {
        errors.push("fight metadata.potions must be an array when provided");
      }

      if (support !== undefined && typeof support !== "boolean" && !Array.isArray(support)) {
        errors.push("fight metadata.support must be a boolean or array of support actions");
      }

      if (healingItems !== undefined) {
        if (!Array.isArray(healingItems)) {
          errors.push("fight metadata.healingItems must be an array when provided");
        } else {
          healingItems.forEach((item, index) =>
            validateItemDescriptor(item, errors, `fight metadata.healingItems[${index}]`)
          );
        }
      }

      if (weaponType !== undefined && !isNonEmptyString(weaponType)) {
        errors.push("fight metadata.weaponType must be a non-empty string when provided");
      }
    }
  }

  if (task.action === "check_inventory") {
    if (task.metadata !== undefined && (typeof task.metadata !== "object" || task.metadata === null)) {
      errors.push("check_inventory metadata must be an object when provided");
    } else if (task.metadata) {
      const { mode, scope, filters, includeEmpty, view, priorities, focus } = task.metadata;

      if (mode && !INVENTORY_MODES.includes(mode)) {
        errors.push(`check_inventory metadata.mode must be one of ${INVENTORY_MODES.join(", ")}`);
      }

      if (scope && !INVENTORY_SCOPES.includes(scope)) {
        errors.push(`check_inventory metadata.scope must be one of ${INVENTORY_SCOPES.join(", ")}`);
      }

      if (view !== undefined) {
        if (!isNonEmptyString(view)) {
          errors.push("check_inventory metadata.view must be a non-empty string when provided");
        } else {
          const normalized = view.toLowerCase();
          if (!INVENTORY_VIEWS.includes(normalized)) {
            errors.push(
              `check_inventory metadata.view must be one of ${INVENTORY_VIEWS.join(", ")}`
            );
          }
        }
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

      validateInventoryFocusList(focus, errors, "check_inventory metadata.focus");
      validateInventoryPriorities(priorities, errors, "check_inventory metadata.priorities");
    }
  }

  if (task.action === "use_item") {
    validateUseItemMetadata(task.metadata, errors, "use_item metadata");
  }

  if (task.action === "equip_item") {
    validateEquipMetadata(task.metadata, errors, "equip_item metadata");
  }

  if (task.action === "manage_inventory") {
    if (typeof task.metadata !== "object" || task.metadata === null) {
      errors.push("manage_inventory tasks require metadata describing inventory priorities");
    } else {
      const { priorities, restock, discard, actions, autoSort, lockSlots, ensure } =
        task.metadata;

      if (priorities === undefined) {
        errors.push("manage_inventory metadata.priorities must be provided");
      }

      validateInventoryPriorities(priorities, errors, "manage_inventory metadata.priorities");

      if (restock !== undefined) {
        if (!Array.isArray(restock)) {
          errors.push("manage_inventory metadata.restock must be an array when provided");
        } else {
          restock.forEach((item, index) =>
            validateItemDescriptor(item, errors, `manage_inventory metadata.restock[${index}]`)
          );
        }
      }

      if (discard !== undefined) {
        if (!Array.isArray(discard)) {
          errors.push("manage_inventory metadata.discard must be an array when provided");
        } else {
          discard.forEach((item, index) =>
            validateItemDescriptor(item, errors, `manage_inventory metadata.discard[${index}]`)
          );
        }
      }

      if (ensure !== undefined) {
        if (!Array.isArray(ensure)) {
          errors.push("manage_inventory metadata.ensure must be an array when provided");
        } else {
          ensure.forEach((entry, index) =>
            validateItemDescriptor(entry, errors, `manage_inventory metadata.ensure[${index}]`)
          );
        }
      }

      if (actions !== undefined) {
        if (!Array.isArray(actions)) {
          errors.push("manage_inventory metadata.actions must be an array when provided");
        } else {
          actions.forEach((action, index) => {
            if (!isNonEmptyString(action)) {
              errors.push(`manage_inventory metadata.actions[${index}] must be a non-empty string`);
            }
          });
        }
      }

      if (autoSort !== undefined && typeof autoSort !== "boolean") {
        errors.push("manage_inventory metadata.autoSort must be a boolean when provided");
      }

      if (lockSlots !== undefined) {
        if (!Array.isArray(lockSlots)) {
          errors.push("manage_inventory metadata.lockSlots must be an array when provided");
        } else {
          lockSlots.forEach((slot, index) => {
            if (!isNonEmptyString(slot)) {
              errors.push(`manage_inventory metadata.lockSlots[${index}] must be a non-empty string`);
            }
          });
        }
      }
    }
  }

  if (task.action === "dig") {
    validateDigMetadata(task.metadata, errors, "dig metadata");
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
