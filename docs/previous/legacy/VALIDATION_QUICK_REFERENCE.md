# Validation Quick Reference Guide

## How to Use Zod Validation in Routes

### 1. Import the Schemas and Middleware

```javascript
// Import validation middleware
import { validate, validateQuery, validateParams } from '../src/middleware/validate.js';

// Import schemas you need
import { createBotSchema, updateBotSchema, taskSchema } from '../src/validators/bot.schemas.js';
import { createNPCSchema, updateNPCSchema } from '../src/validators/npc.schemas.js';
import { configUpdateSchema } from '../src/validators/config.schemas.js';
import { policyRuleSchema } from '../src/validators/policy.schemas.js';
```

### 2. Apply Validation to Routes

#### Validate Request Body

```javascript
router.post('/api/bots',
  authenticate,
  authorize('write'),
  validate(createBotSchema),  // Add validation middleware
  async (req, res) => {
    // req.body is now validated and typed
    const { role, name, description } = req.body;
    // ... rest of handler
  }
);
```

#### Validate Query Parameters

```javascript
router.get('/api/bots',
  authenticate,
  authorize('read'),
  validateQuery(botQuerySchema),  // Validate query params
  async (req, res) => {
    // req.query is now validated
    const { status, role, type } = req.query;
    // ... rest of handler
  }
);
```

#### Validate Request Params

```javascript
import { z } from 'zod';

const idSchema = z.object({
  id: z.string().uuid()
});

router.get('/api/bots/:id',
  authenticate,
  authorize('read'),
  validateParams(idSchema),  // Validate URL params
  async (req, res) => {
    // req.params is now validated
    const { id } = req.params;
    // ... rest of handler
  }
);
```

---

## Creating New Schemas

### Basic Schema Example

```javascript
import { z } from 'zod';

// Simple schema
export const userSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  age: z.number().min(13).max(120).optional(),
});
```

### Schema with Enums

```javascript
export const statusSchema = z.object({
  status: z.enum(['active', 'inactive', 'pending']),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});
```

### Nested Object Schema

```javascript
export const configSchema = z.object({
  server: z.object({
    host: z.string(),
    port: z.number().min(1).max(65535),
  }),
  database: z.object({
    url: z.string().url(),
    poolSize: z.number().min(1).max(100).default(10),
  }).optional(),
});
```

### Array Schema

```javascript
export const bulkCreateSchema = z.object({
  bots: z.array(
    z.object({
      name: z.string(),
      role: z.enum(['miner', 'builder', 'scout']),
    })
  ).min(1).max(10),
});
```

---

## Common Validation Patterns

### String Validation

```javascript
z.string()                          // Any string
z.string().min(3)                   // Min length
z.string().max(100)                 // Max length
z.string().email()                  // Email format
z.string().url()                    // URL format
z.string().uuid()                   // UUID format
z.string().regex(/^[a-z]+$/)        // Custom regex
z.string().optional()               // Optional field
z.string().default('default')       // With default value
```

### Number Validation

```javascript
z.number()                          // Any number
z.number().min(0)                   // Minimum value
z.number().max(100)                 // Maximum value
z.number().int()                    // Integer only
z.number().positive()               // Positive numbers
z.number().nonnegative()            // >= 0
z.number().multipleOf(5)            // Multiple of 5
```

### Boolean Validation

```javascript
z.boolean()                         // Boolean
z.boolean().default(false)          // With default
```

### Date Validation

```javascript
z.date()                            // Date object
z.string().datetime()               // ISO datetime string
z.coerce.date()                     // Coerce string to date
```

### Object Validation

```javascript
z.object({ ... })                   // Object with specific shape
z.object({ ... }).strict()          // Reject extra keys
z.object({ ... }).partial()         // All fields optional
z.object({ ... }).pick(['name'])    // Pick specific fields
z.object({ ... }).omit(['id'])      // Omit specific fields
z.record(z.string())                // Any object with string values
```

### Array Validation

```javascript
z.array(z.string())                 // Array of strings
z.array(schema).min(1)              // Non-empty array
z.array(schema).max(10)             // Max 10 items
z.array(schema).length(5)           // Exactly 5 items
z.array(schema).nonempty()          // At least 1 item
```

### Union and Intersection

```javascript
z.union([z.string(), z.number()])   // String OR number
z.intersection(schema1, schema2)     // Both schemas
z.discriminatedUnion('type', [...])  // Tagged union
```

### Custom Error Messages

```javascript
z.string().min(3, { message: "Username must be at least 3 characters" })
z.number().max(100, { message: "Value cannot exceed 100" })

// For enums
z.enum(['a', 'b', 'c'], {
  errorMap: () => ({ message: "Must be one of: a, b, c" })
})
```

---

## Error Handling

### Validation Middleware Handles Errors Automatically

When validation fails, the middleware returns:

```json
{
  "error": "Validation failed",
  "message": "Invalid input data",
  "details": [
    {
      "field": "role",
      "message": "Role must be one of: miner, builder, scout",
      "code": "invalid_value"
    }
  ]
}
```

### Manual Validation (Optional)

```javascript
import { createBotSchema } from '../src/validators/bot.schemas.js';

try {
  const validData = createBotSchema.parse(inputData);
  // Use validData
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log(error.errors);
  }
}

// Or use safeParse (no exception)
const result = createBotSchema.safeParse(inputData);
if (result.success) {
  console.log(result.data);
} else {
  console.log(result.error.errors);
}
```

---

## Best Practices

### 1. Always Validate User Input
```javascript
// ❌ Bad
router.post('/api/bots', async (req, res) => {
  const { role } = req.body;  // No validation!
});

// ✅ Good
router.post('/api/bots', validate(createBotSchema), async (req, res) => {
  const { role } = req.body;  // Validated!
});
```

### 2. Separate Schemas for Create and Update
```javascript
// Create schema - required fields
export const createBotSchema = z.object({
  role: z.enum(['miner', 'builder', 'scout']),
  name: z.string().min(1),
});

// Update schema - all optional
export const updateBotSchema = z.object({
  role: z.enum(['miner', 'builder', 'scout']).optional(),
  name: z.string().min(1).optional(),
});
```

### 3. Use Meaningful Error Messages
```javascript
// ❌ Generic
z.string().min(3)

// ✅ Specific
z.string().min(3, {
  message: "Bot name must be at least 3 characters long"
})
```

### 4. Validate Early in Middleware Chain
```javascript
// ✅ Validate before authentication/authorization if possible
router.post('/public-api',
  validate(schema),      // Validate first
  rateLimiter,           // Then rate limit
  authenticate,          // Then auth
  async (req, res) => {
    // Handler
  }
);

// ✅ For protected routes, validate after auth but before business logic
router.post('/api/bots',
  authenticate,          // Auth first (to know who's making request)
  authorize('write'),    // Then check permissions
  validate(schema),      // Then validate input
  async (req, res) => {
    // Handler
  }
);
```

### 5. Keep Schemas Organized
```
src/validators/
├── bot.schemas.js       # Bot-related schemas
├── npc.schemas.js       # NPC-related schemas
├── config.schemas.js    # Configuration schemas
├── policy.schemas.js    # Policy schemas
└── common.schemas.js    # Shared schemas (optional)
```

---

## Testing Validation

### Unit Test Example

```javascript
import { createBotSchema } from '../src/validators/bot.schemas.js';

describe('createBotSchema', () => {
  it('should accept valid bot data', () => {
    const validBot = {
      role: 'miner',
      name: 'TestBot',
    };
    expect(() => createBotSchema.parse(validBot)).not.toThrow();
  });

  it('should reject invalid role', () => {
    const invalidBot = {
      role: 'hacker',
      name: 'BadBot',
    };
    expect(() => createBotSchema.parse(invalidBot)).toThrow();
  });
});
```

---

## Migration Checklist

When adding validation to existing routes:

- [ ] Create schema in appropriate file
- [ ] Import schema and middleware in route file
- [ ] Add validation middleware to route
- [ ] Test with valid data
- [ ] Test with invalid data
- [ ] Update API documentation
- [ ] Update frontend to handle new error format
- [ ] Add unit tests for schema

---

## Additional Resources

- [Zod Documentation](https://zod.dev/)
- [Zod GitHub](https://github.com/colinhacks/zod)
- Project validation schemas: `/home/user/FGD/src/validators/`
- Validation middleware: `/home/user/FGD/src/middleware/validate.js`
- Test examples: `/home/user/FGD/test/validation-test.js`

---

**Last Updated:** 2025-11-18
