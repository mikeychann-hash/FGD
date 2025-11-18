/**
 * Validation middleware using Zod schemas
 * Provides input validation to prevent SQL injection, data corruption, and improve error messages
 */

/**
 * Creates a validation middleware for request body
 * @param {ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 */
export function validate(schema) {
  return (req, res, next) => {
    try {
      // Parse and validate the request body
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      // Zod validation error - return detailed error information
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid input data',
        details: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
      });
    }
  };
}

/**
 * Creates a validation middleware for query parameters
 * @param {ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      // Parse and validate the query parameters
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      // Zod validation error - return detailed error information
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid query parameters',
        details: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
      });
    }
  };
}

/**
 * Creates a validation middleware for request params
 * @param {ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 */
export function validateParams(schema) {
  return (req, res, next) => {
    try {
      // Parse and validate the request params
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      // Zod validation error - return detailed error information
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid request parameters',
        details: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
      });
    }
  };
}
