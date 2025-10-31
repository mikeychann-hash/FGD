/**
 * Schema Validation Utility
 * Lightweight JSON schema validator for NPC profiles and other data structures
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = logger.child({ component: 'Validator' });

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Schema Validator
 */
export class Validator {
  constructor() {
    this.schemas = new Map();
  }

  /**
   * Load schema from file
   */
  async loadSchema(name, filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const schema = JSON.parse(data);
      this.schemas.set(name, schema);
      log.debug('Schema loaded', { name, filePath });
      return schema;
    } catch (error) {
      log.error('Failed to load schema', { name, filePath, error: error.message });
      throw new Error(`Failed to load schema ${name}: ${error.message}`);
    }
  }

  /**
   * Register schema directly
   */
  registerSchema(name, schema) {
    this.schemas.set(name, schema);
    log.debug('Schema registered', { name });
  }

  /**
   * Validate data against schema
   */
  validate(data, schemaNameOrObject, options = {}) {
    const schema = typeof schemaNameOrObject === 'string'
      ? this.schemas.get(schemaNameOrObject)
      : schemaNameOrObject;

    if (!schema) {
      throw new Error(`Schema not found: ${schemaNameOrObject}`);
    }

    const errors = [];
    const result = this._validateValue(data, schema, '', errors, options);

    if (!result || errors.length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    return true;
  }

  /**
   * Validate value against schema recursively
   */
  _validateValue(value, schema, path, errors, options = {}) {
    const { strict = true } = options;

    // Handle type validation
    if (schema.type) {
      if (!this._validateType(value, schema.type, path, errors)) {
        return false;
      }
    }

    // Handle enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        value
      });
      return false;
    }

    // Type-specific validation
    if (Array.isArray(schema.type) ? schema.type.includes('object') : schema.type === 'object') {
      return this._validateObject(value, schema, path, errors, options);
    }

    if (Array.isArray(schema.type) ? schema.type.includes('array') : schema.type === 'array') {
      return this._validateArray(value, schema, path, errors, options);
    }

    if (Array.isArray(schema.type) ? schema.type.includes('number') : schema.type === 'number') {
      return this._validateNumber(value, schema, path, errors);
    }

    if (Array.isArray(schema.type) ? schema.type.includes('string') : schema.type === 'string') {
      return this._validateString(value, schema, path, errors);
    }

    return true;
  }

  /**
   * Validate type
   */
  _validateType(value, type, path, errors) {
    const types = Array.isArray(type) ? type : [type];
    const actualType = this._getType(value);

    if (!types.some(t => this._matchType(value, t, actualType))) {
      errors.push({
        path,
        message: `Expected type ${types.join(' or ')}, got ${actualType}`,
        value
      });
      return false;
    }

    return true;
  }

  /**
   * Get value type
   */
  _getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Match type
   */
  _matchType(value, expectedType, actualType) {
    if (expectedType === 'null') return value === null;
    if (expectedType === 'array') return Array.isArray(value);
    if (expectedType === 'integer') return Number.isInteger(value);
    return actualType === expectedType;
  }

  /**
   * Validate object
   */
  _validateObject(value, schema, path, errors, options) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return true; // Type validation handles this
    }

    let valid = true;

    // Validate required properties
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in value)) {
          errors.push({
            path: path ? `${path}.${requiredProp}` : requiredProp,
            message: `Required property missing: ${requiredProp}`
          });
          valid = false;
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in value) {
          const propPath = path ? `${path}.${key}` : key;
          if (!this._validateValue(value[key], propSchema, propPath, errors, options)) {
            valid = false;
          }
        }
      }
    }

    // Validate additional properties
    if (schema.additionalProperties === false && options.strict) {
      const allowedProps = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(value)) {
        if (!allowedProps.has(key)) {
          errors.push({
            path: path ? `${path}.${key}` : key,
            message: `Additional property not allowed: ${key}`
          });
          valid = false;
        }
      }
    } else if (typeof schema.additionalProperties === 'object') {
      const allowedProps = new Set(Object.keys(schema.properties || {}));
      for (const [key, val] of Object.entries(value)) {
        if (!allowedProps.has(key)) {
          const propPath = path ? `${path}.${key}` : key;
          if (!this._validateValue(val, schema.additionalProperties, propPath, errors, options)) {
            valid = false;
          }
        }
      }
    }

    return valid;
  }

  /**
   * Validate array
   */
  _validateArray(value, schema, path, errors, options) {
    if (!Array.isArray(value)) {
      return true; // Type validation handles this
    }

    let valid = true;

    // Validate min/max items
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        path,
        message: `Array must have at least ${schema.minItems} items, got ${value.length}`
      });
      valid = false;
    }

    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({
        path,
        message: `Array must have at most ${schema.maxItems} items, got ${value.length}`
      });
      valid = false;
    }

    // Validate items
    if (schema.items) {
      value.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        if (!this._validateValue(item, schema.items, itemPath, errors, options)) {
          valid = false;
        }
      });
    }

    return valid;
  }

  /**
   * Validate number
   */
  _validateNumber(value, schema, path, errors) {
    if (typeof value !== 'number') {
      return true; // Type validation handles this
    }

    let valid = true;

    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path,
        message: `Value must be >= ${schema.minimum}, got ${value}`
      });
      valid = false;
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path,
        message: `Value must be <= ${schema.maximum}, got ${value}`
      });
      valid = false;
    }

    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      errors.push({
        path,
        message: `Value must be > ${schema.exclusiveMinimum}, got ${value}`
      });
      valid = false;
    }

    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      errors.push({
        path,
        message: `Value must be < ${schema.exclusiveMaximum}, got ${value}`
      });
      valid = false;
    }

    if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
      errors.push({
        path,
        message: `Value must be multiple of ${schema.multipleOf}, got ${value}`
      });
      valid = false;
    }

    return valid;
  }

  /**
   * Validate string
   */
  _validateString(value, schema, path, errors) {
    if (typeof value !== 'string') {
      return true; // Type validation handles this
    }

    let valid = true;

    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        message: `String must be at least ${schema.minLength} characters, got ${value.length}`
      });
      valid = false;
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        message: `String must be at most ${schema.maxLength} characters, got ${value.length}`
      });
      valid = false;
    }

    if (schema.pattern !== undefined) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push({
          path,
          message: `String must match pattern ${schema.pattern}`
        });
        valid = false;
      }
    }

    return valid;
  }

  /**
   * Validate with default error handling
   */
  validateSafe(data, schemaNameOrObject, options = {}) {
    try {
      return {
        valid: this.validate(data, schemaNameOrObject, options),
        errors: []
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        return {
          valid: false,
          errors: error.errors
        };
      }
      throw error;
    }
  }
}

// Default validator instance
const defaultValidator = new Validator();

// Auto-load NPC profile schema
const npcProfileSchemaPath = path.join(__dirname, 'npc_profile.schema.json');
try {
  await defaultValidator.loadSchema('npc_profile', npcProfileSchemaPath);
} catch (error) {
  log.warn('Could not load NPC profile schema', { error: error.message });
}

export { defaultValidator as validator };
export default Validator;
