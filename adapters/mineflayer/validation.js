/**
 * Task Validation for Mineflayer Adapter
 *
 * Ensures all task inputs are:
 * 1. Properly structured
 * 2. Have required fields
 * 3. Have valid parameter values
 * 4. Pass safety checks
 *
 * No arbitrary evaluation of LLM output - all tasks are validated against
 * strict schemas before execution.
 */

const TASK_SCHEMAS = {
  'move_to': {
    required: ['parameters'],
    parameters: {
      required: ['target'],
      target: {
        required: ['x', 'y', 'z'],
        x: { type: 'number' },
        y: { type: 'number' },
        z: { type: 'number' }
      }
    }
  },

  'follow': {
    required: ['parameters'],
    parameters: {
      required: ['target'],
      target: {
        required: ['entity'],
        entity: { type: 'string', maxLength: 32 }
      }
    }
  },

  'navigate': {
    required: ['parameters'],
    parameters: {
      required: ['waypoints'],
      waypoints: {
        type: 'array',
        minLength: 1,
        maxLength: 50,
        items: {
          required: ['x', 'y', 'z'],
          x: { type: 'number' },
          y: { type: 'number' },
          z: { type: 'number' }
        }
      }
    }
  },

  'mine_block': {
    required: ['parameters'],
    parameters: {
      required: ['target'],
      target: {
        required: ['x', 'y', 'z'],
        x: { type: 'number' },
        y: { type: 'number' },
        z: { type: 'number' }
      },
      blockType: { type: 'string', maxLength: 32 } // Optional, for validation
    }
  },

  'place_block': {
    required: ['parameters'],
    parameters: {
      required: ['target', 'blockType'],
      target: {
        required: ['x', 'y', 'z'],
        x: { type: 'number' },
        y: { type: 'number' },
        z: { type: 'number' }
      },
      blockType: { type: 'string', maxLength: 32 },
      face: { type: 'string', enum: ['top', 'bottom', 'north', 'south', 'east', 'west'] }
    }
  },

  'interact': {
    required: ['parameters'],
    parameters: {
      required: ['target'],
      target: {
        required: ['x', 'y', 'z'],
        x: { type: 'number' },
        y: { type: 'number' },
        z: { type: 'number' }
      },
      hand: { type: 'string', enum: ['left', 'right'] }
    }
  },

  'use_item': {
    required: ['parameters'],
    parameters: {
      required: ['itemName'],
      itemName: { type: 'string', maxLength: 32 },
      target: {
        x: { type: 'number' },
        y: { type: 'number' },
        z: { type: 'number' }
      }
    }
  },

  'look_at': {
    required: ['parameters'],
    parameters: {
      required: ['target'],
      target: {
        required: ['x', 'y', 'z'],
        x: { type: 'number' },
        y: { type: 'number' },
        z: { type: 'number' }
      }
    }
  },

  'chat': {
    required: ['parameters'],
    parameters: {
      required: ['message'],
      message: { type: 'string', minLength: 1, maxLength: 256 }
    }
  },

  'get_inventory': {
    required: ['botId']
  },

  'equip_item': {
    required: ['parameters'],
    parameters: {
      required: ['itemName'],
      itemName: { type: 'string', maxLength: 32 },
      slot: { type: 'number', min: 0, max: 8 }
    }
  },

  'drop_item': {
    required: ['parameters'],
    parameters: {
      required: ['slot'],
      slot: { type: 'number', min: 0, max: 8 },
      count: { type: 'number', min: 1, max: 64 }
    }
  }
};

/**
 * Validate a task object against its schema
 *
 * @param {Object} task - Task to validate
 * @returns {{valid: boolean, errors: Array<string>}}
 */
export function validateBotCommand(task) {
  const errors = [];

  // Check basic task structure
  if (!task || typeof task !== 'object') {
    return { valid: false, errors: ['Task must be an object'] };
  }

  if (!task.type || typeof task.type !== 'string') {
    errors.push('Task type (string) is required');
  }

  if (!task.botId || typeof task.botId !== 'string') {
    errors.push('Bot ID (string) is required');
  }

  // Check task-specific schema
  const schema = TASK_SCHEMAS[task.type];
  if (!schema) {
    errors.push(`Unknown task type: ${task.type}`);
    return { valid: false, errors };
  }

  // Validate required top-level fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in task)) {
        errors.push(`Required field missing: ${field}`);
      }
    }
  }

  // Validate parameters if schema specifies them
  if (schema.parameters) {
    const paramErrors = validateParameters(task.parameters, schema.parameters);
    errors.push(...paramErrors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate parameters against a parameter schema
 * @private
 */
function validateParameters(params, schema, path = 'parameters') {
  const errors = [];

  if (!params || typeof params !== 'object') {
    return [`${path} must be an object`];
  }

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in params)) {
        errors.push(`Required field missing: ${path}.${field}`);
      }
    }
  }

  // Validate specific fields
  for (const [key, fieldSchema] of Object.entries(schema)) {
    if (key === 'required' || !(key in params)) continue;

    const fieldPath = `${path}.${key}`;
    const value = params[key];
    const fieldErrors = validateField(value, fieldSchema, fieldPath);
    errors.push(...fieldErrors);
  }

  return errors;
}

/**
 * Validate a single field value
 * @private
 */
function validateField(value, schema, path) {
  const errors = [];

  // Type checking
  if (schema.type) {
    if (typeof value !== schema.type) {
      errors.push(`${path} must be a ${schema.type}, got ${typeof value}`);
      return errors;
    }
  }

  // String constraints
  if (schema.maxLength && typeof value === 'string' && value.length > schema.maxLength) {
    errors.push(`${path} exceeds max length ${schema.maxLength}`);
  }
  if (schema.minLength && typeof value === 'string' && value.length < schema.minLength) {
    errors.push(`${path} below min length ${schema.minLength}`);
  }

  // Number constraints
  if (schema.min && typeof value === 'number' && value < schema.min) {
    errors.push(`${path} below minimum ${schema.min}`);
  }
  if (schema.max && typeof value === 'number' && value > schema.max) {
    errors.push(`${path} exceeds maximum ${schema.max}`);
  }

  // Enum constraint
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path} must be one of [${schema.enum.join(', ')}]`);
  }

  // Array handling
  if (Array.isArray(value)) {
    if (schema.minLength && value.length < schema.minLength) {
      errors.push(`${path} array below min length ${schema.minLength}`);
    }
    if (schema.maxLength && value.length > schema.maxLength) {
      errors.push(`${path} array exceeds max length ${schema.maxLength}`);
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        // If items schema has required fields, validate as object
        if (schema.items.required) {
          const itemErrors = validateParameters(item, schema.items, `${path}[${i}]`);
          errors.push(...itemErrors);
        } else {
          // Otherwise validate as field
          const itemErrors = validateField(item, schema.items, `${path}[${i}]`);
          errors.push(...itemErrors);
        }
      }
    }
    return errors;
  }

  // Object field validation (for nested structures like 'target')
  if (typeof value === 'object' && !Array.isArray(value) && (schema.required || Object.keys(schema).some(k => !['type', 'min', 'max', 'minLength', 'maxLength', 'enum'].includes(k)))) {
    const nestedErrors = validateParameters(value, schema, path);
    errors.push(...nestedErrors);
  }

  return errors;
}

/**
 * Validate coordinates are within reasonable bounds
 * @returns {boolean}
 */
export function validateCoordinates(x, y, z, worldBounds = {}) {
  const { minX = -30000000, maxX = 30000000, minY = -64, maxY = 319, minZ = -30000000, maxZ = 30000000 } = worldBounds;

  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
    return false;
  }

  return (
    x >= minX && x <= maxX &&
    y >= minY && y <= maxY &&
    z >= minZ && z <= maxZ
  );
}

/**
 * Check if a command contains dangerous patterns
 * @private
 */
export function isSafeBlockType(blockType) {
  // Blacklist destructive blocks that require explicit approval
  const DESTRUCTIVE_BLOCKS = [
    'tnt', 'redstone_block', 'command_block', 'structure_block',
    'bedrock', 'void_air', 'end_portal_frame', 'end_portal',
    'spawner', 'end_gateway'
  ];

  if (DESTRUCTIVE_BLOCKS.includes(blockType?.toLowerCase())) {
    return false;
  }

  return true;
}
