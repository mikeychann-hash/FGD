import { z } from 'zod';

// NPC types
const npcTypes = ['villager', 'guard', 'merchant', 'worker', 'companion'];

// NPC status
const npcStatuses = ['active', 'inactive', 'idle', 'working', 'patrolling'];

// Position schema
const positionSchema = z
  .object({
    x: z.number(),
    y: z.number().min(-64).max(320),
    z: z.number(),
  })
  .optional();

// Behavior schema
const behaviorSchema = z
  .object({
    patrol: z.boolean().optional(),
    hostile: z.boolean().optional(),
    followOwner: z.boolean().optional(),
    canTrade: z.boolean().optional(),
  })
  .optional();

// Create NPC schema
export const createNPCSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(npcTypes, {
    errorMap: () => ({
      message: `NPC type must be one of: ${npcTypes.join(', ')}`,
    }),
  }),
  description: z.string().max(500).optional(),
  position: positionSchema,
  behavior: behaviorSchema,
  metadata: z.record(z.any()).optional(),
});

// Update NPC schema
export const updateNPCSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  position: positionSchema,
  behavior: behaviorSchema,
  metadata: z.record(z.any()).optional(),
});

// NPC query schema
export const npcQuerySchema = z.object({
  status: z.enum(npcStatuses).optional(),
  type: z.enum(npcTypes).optional(),
  name: z.string().optional(),
});

// NPC command schema (for direct NPC commands)
export const npcCommandSchema = z.object({
  command: z.string().min(1, 'Command is required'),
  parameters: z.record(z.any()).optional(),
});
