import { z } from 'zod';

// Server configuration schema
export const serverConfigSchema = z.object({
  port: z.number().min(1).max(65535).optional(),
  host: z.string().optional(),
  corsOrigins: z.array(z.string()).optional(),
  rateLimit: z
    .object({
      windowMs: z.number().min(1000).optional(),
      maxRequests: z.number().min(1).optional(),
    })
    .optional(),
});

// Database configuration schema
export const databaseConfigSchema = z.object({
  host: z.string().optional(),
  port: z.number().min(1).max(65535).optional(),
  database: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().optional(),
});

// Minecraft server configuration schema
export const minecraftConfigSchema = z.object({
  host: z.string().optional(),
  port: z.number().min(1).max(65535).optional(),
  version: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  auth: z.enum(['mojang', 'microsoft', 'offline']).optional(),
});

// Feature flags schema
export const featureFlagsSchema = z.object({
  enableLLM: z.boolean().optional(),
  enableLearning: z.boolean().optional(),
  enableWebSocket: z.boolean().optional(),
  enableMetrics: z.boolean().optional(),
  debug: z.boolean().optional(),
});

// General config update schema
export const configUpdateSchema = z.object({
  server: serverConfigSchema.optional(),
  database: databaseConfigSchema.optional(),
  minecraft: minecraftConfigSchema.optional(),
  features: featureFlagsSchema.optional(),
  settings: z.record(z.any()).optional(),
});
