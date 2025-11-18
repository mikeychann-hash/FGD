import { z } from 'zod';

// Valid bot roles
const validRoles = ['miner', 'builder', 'scout', 'guard', 'gatherer'];

// Personality trait schema (0-1 range)
const personalityTraitSchema = z.number().min(0).max(1).optional();

// Personality object schema
const personalitySchema = z
  .object({
    curiosity: personalityTraitSchema,
    patience: personalityTraitSchema,
    motivation: personalityTraitSchema,
    empathy: personalityTraitSchema,
    aggression: personalityTraitSchema,
    creativity: personalityTraitSchema,
    loyalty: personalityTraitSchema,
  })
  .optional();

// Position schema for bot coordinates
const positionSchema = z
  .object({
    x: z.number(),
    y: z.number().min(-64).max(320), // Minecraft world height limits
    z: z.number(),
  })
  .optional();

// Appearance schema
const appearanceSchema = z
  .object({
    skin: z.string().optional(),
    model: z.string().optional(),
  })
  .optional();

// Create bot schema
export const createBotSchema = z.object({
  name: z.string().max(100).optional(),
  role: z.enum(validRoles, {
    errorMap: () => ({
      message: `Role must be one of: ${validRoles.join(', ')}`,
    }),
  }),
  type: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  personality: personalitySchema,
  appearance: appearanceSchema,
  position: positionSchema,
  taskParameters: z.record(z.any()).optional(),
  behaviorPreset: z.string().optional(),
  autoSpawn: z.boolean().optional(),
});

// Update bot schema (all fields optional except those that make sense)
export const updateBotSchema = z.object({
  name: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  personality: personalitySchema,
  appearance: appearanceSchema,
  position: positionSchema,
  taskParameters: z.record(z.any()).optional(),
  behaviorPreset: z.string().optional(),
});

// Task assignment schema
export const taskSchema = z.object({
  action: z.string().min(1, 'Action is required'),
  target: z.any().optional(),
  parameters: z.record(z.any()).optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional().default('normal'),
});

// Spawn position schema (position is optional, defaults to bot's last known or spawn position)
export const spawnPositionSchema = z
  .object({
    position: positionSchema,
  })
  .partial();

// Query parameter schemas for filtering
export const botQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'idle', 'working']).optional(),
  role: z.enum(validRoles).optional(),
  type: z.string().optional(),
});
