import { z } from 'zod';

// Policy actions
const policyActions = ['allow', 'deny', 'warn'];

// Resource types
const resourceTypes = ['bot', 'npc', 'config', 'user', 'system'];

// Permission levels
const permissionLevels = ['read', 'write', 'delete', 'admin'];

// Policy rule schema
export const policyRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  resource: z.enum(resourceTypes, {
    errorMap: () => ({
      message: `Resource must be one of: ${resourceTypes.join(', ')}`,
    }),
  }),
  action: z.enum(policyActions, {
    errorMap: () => ({
      message: `Action must be one of: ${policyActions.join(', ')}`,
    }),
  }),
  conditions: z
    .object({
      role: z.array(z.string()).optional(),
      user: z.array(z.string()).optional(),
      ipRange: z.array(z.string()).optional(),
      timeRange: z
        .object({
          start: z.string().optional(),
          end: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  priority: z.number().min(0).max(100).default(50),
  enabled: z.boolean().default(true),
});

// Update policy rule schema
export const updatePolicyRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  resource: z.enum(resourceTypes).optional(),
  action: z.enum(policyActions).optional(),
  conditions: z
    .object({
      role: z.array(z.string()).optional(),
      user: z.array(z.string()).optional(),
      ipRange: z.array(z.string()).optional(),
      timeRange: z
        .object({
          start: z.string().optional(),
          end: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  priority: z.number().min(0).max(100).optional(),
  enabled: z.boolean().optional(),
});

// Policy query schema
export const policyQuerySchema = z.object({
  resource: z.enum(resourceTypes).optional(),
  action: z.enum(policyActions).optional(),
  enabled: z.boolean().optional(),
});

// Permission check schema
export const permissionCheckSchema = z.object({
  user: z.string().min(1),
  resource: z.enum(resourceTypes),
  action: z.string().min(1),
  context: z.record(z.any()).optional(),
});
