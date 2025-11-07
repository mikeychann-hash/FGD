// routes/bot.js
// Bot management API routes

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Maximum number of bots that can be spawned at once
const MAX_BOTS = 8;

/**
 * Count currently spawned bots
 * @param {NPCEngine} npcEngine - The NPC engine instance
 * @returns {number} Number of bots with status "active"
 */
function countSpawnedBots(npcEngine) {
  const allBots = npcEngine.registry.getAll();
  return allBots.filter(bot => bot.status === 'active').length;
}

/**
 * Check if spawning additional bots would exceed the limit
 * @param {NPCEngine} npcEngine - The NPC engine instance
 * @param {number} count - Number of bots to spawn
 * @returns {Object|null} Error object if limit exceeded, null otherwise
 */
function checkSpawnLimit(npcEngine, count = 1) {
  const currentCount = countSpawnedBots(npcEngine);
  if (currentCount + count > MAX_BOTS) {
    return {
      error: 'Spawn limit exceeded',
      message: `Cannot spawn ${count} bot(s): would exceed maximum of ${MAX_BOTS} bots. ` +
               `Currently ${currentCount} bot(s) active. Please despawn some bots first.`,
      currentCount,
      maxBots: MAX_BOTS,
      requested: count
    };
  }
  return null;
}

/**
 * Initialize bot routes with NPC engine and socket.io
 * @param {NPCEngine} npcEngine - The NPC engine instance
 * @param {Server} io - Socket.io server instance
 */
export function initBotRoutes(npcEngine, io) {
  if (!npcEngine) {
    throw new Error('NPC engine is required');
  }

  if (io) {
    npcEngine.on('npc_moved', data => io.emit('bot:moved', data));
    npcEngine.on('npc_status', data => io.emit('bot:status', data));
    npcEngine.on('npc_task_completed', data => io.emit('bot:task_complete', data));
    npcEngine.on('npc_scan', data => io.emit('bot:scan', data));
    npcEngine.on('npc_error', data => io.emit('bot:error', data));
  }

  // ============================================================================
  // Public Routes (no auth required)
  // ============================================================================

  /**
   * GET /api/bots/health
   * Health check endpoint
   */
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  });

  // ============================================================================
  // Protected Routes (require authentication)
  // ============================================================================

  /**
   * GET /api/bots
   * List all bots with optional filtering
   */
  router.get('/', authenticate, authorize('read'), (req, res) => {
    try {
      const { status, role, type } = req.query;

      let bots = npcEngine.registry.getAll();
      const runtimeMap = npcEngine.npcs instanceof Map ? npcEngine.npcs : null;

      // Filter out inactive bots by default (unless explicitly requested)
      if (status !== 'inactive') {
        bots = bots.filter(bot => bot.status !== 'inactive');
      }

      // Apply filters
      if (status) {
        bots = bots.filter(bot => bot.status === status);
      }
      if (role) {
        bots = bots.filter(bot => bot.role === role);
      }
      if (type) {
        bots = bots.filter(bot => bot.npcType === type);
      }

      res.json({
        success: true,
        count: bots.length,
        bots: bots.map(bot => {
          const runtime = runtimeMap?.get(bot.id)?.runtime || null;
          return {
            id: bot.id,
            role: bot.role,
            type: bot.npcType,
            status: runtime?.status || bot.status,
            description: bot.description,
            personalitySummary: bot.personalitySummary,
            personalityTraits: bot.personalityTraits,
            position: runtime?.position || bot.lastKnownPosition || bot.spawnPosition,
            velocity: runtime?.velocity || null,
            tick: runtime?.tickCount || 0,
            lastTickAt: runtime?.lastTickAt || null,
            memory: runtime?.memory?.context || [],
            lastScan: runtime?.lastScan || null,
            spawnCount: bot.spawnCount,
            lastSpawnedAt: bot.lastSpawnedAt,
            createdAt: bot.createdAt,
            updatedAt: bot.updatedAt
          };
        })
      });
    } catch (error) {
      console.error('Error listing bots:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/bots/:id
   * Get detailed information about a specific bot
   */
  router.get('/:id', authenticate, authorize('read'), (req, res) => {
    try {
      const { id } = req.params;
      const bot = npcEngine.registry.get(id);

      if (!bot) {
        return res.status(404).json({
          error: 'Not found',
          message: `Bot ${id} not found`
        });
      }

      // Get learning profile if available
      let learning = null;
      if (npcEngine.learningEngine) {
        const learningProfile = npcEngine.learningEngine.getProfile(id);
        if (learningProfile) {
          learning = {
            xp: learningProfile.xp,
            level: Math.floor(learningProfile.xp / 10),
            tasksCompleted: learningProfile.tasksCompleted,
            tasksFailed: learningProfile.tasksFailed,
            successRate: learningProfile.tasksCompleted /
              (learningProfile.tasksCompleted + learningProfile.tasksFailed) * 100,
            skills: learningProfile.skills,
            personality: learningProfile.personality
          };
        }
      }

      const runtime = npcEngine.npcs instanceof Map
        ? npcEngine.npcs.get(id)?.runtime || null
        : null;

      const runtimeSafe = runtime
        ? {
            status: runtime.status,
            position: runtime.position,
            velocity: runtime.velocity,
            tickCount: runtime.tickCount,
            lastTickAt: runtime.lastTickAt,
            memory: runtime.memory,
            lastScan: runtime.lastScan
          }
        : null;

      res.json({
        success: true,
        bot: {
          ...bot,
          state: runtime?.status || bot.status,
          runtime: runtimeSafe,
          learning
        }
      });
    } catch (error) {
      console.error(`Error getting bot ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  /**
   * POST /api/bots
   * Create a new bot
   */
  router.post('/', authenticate, authorize('write'), async (req, res) => {
    try {
      const {
        name,
        role,
        type,
        personality,
        appearance,
        description,
        position,
        taskParameters,
        behaviorPreset
      } = req.body;

      if (!role && !type) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Role or type is required'
        });
      }

      const botRole = role || type;
      const botType = type || role;

      // Create the bot
      const bot = await npcEngine.createNPC({
        baseName: name || botRole,
        role: botRole,
        npcType: botType,
        personality: personality || undefined,
        appearance: appearance || undefined,
        description: description || undefined,
        position: position || undefined,
        metadata: {
          taskParameters: taskParameters || {},
          behaviorPreset: behaviorPreset || 'default',
          createdBy: req.user.username,
          createdByRole: req.user.role
        },
        autoSpawn: false
      });

      // Emit WebSocket event
      if (io) {
        io.emit('bot:created', {
          bot: {
            id: bot.id,
            role: bot.role,
            type: bot.npcType,
            personalitySummary: bot.personalitySummary
          },
          createdBy: req.user.username,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ Bot ${bot.id} created by ${req.user.username} (${req.user.role})`);

      res.status(201).json({
        success: true,
        message: `Bot ${bot.id} created successfully`,
        bot: {
          id: bot.id,
          role: bot.role,
          type: bot.npcType,
          personalitySummary: bot.personalitySummary,
          personalityTraits: bot.personalityTraits,
          description: bot.description,
          position: bot.spawnPosition
        }
      });
    } catch (error) {
      console.error('Error creating bot:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  /**
   * PUT /api/bots/:id
   * Update bot configuration
   */
  router.put('/:id', authenticate, authorize('write'), async (req, res) => {
    try {
      const { id } = req.params;
      const {
        description,
        personality,
        appearance,
        position,
        taskParameters,
        behaviorPreset
      } = req.body;

      const existingBot = npcEngine.registry.get(id);
      if (!existingBot) {
        return res.status(404).json({
          error: 'Not found',
          message: `Bot ${id} not found`
        });
      }

      // Update bot
      const updatedBot = await npcEngine.registry.upsert({
        ...existingBot,
        description: description || existingBot.description,
        personality: personality || existingBot.personality,
        appearance: appearance || existingBot.appearance,
        spawnPosition: position || existingBot.spawnPosition,
        metadata: {
          ...existingBot.metadata,
          taskParameters: taskParameters || existingBot.metadata?.taskParameters,
          behaviorPreset: behaviorPreset || existingBot.metadata?.behaviorPreset,
          updatedBy: req.user.username,
          updatedByRole: req.user.role
        }
      });

      // Emit WebSocket event
      if (io) {
        io.emit('bot:updated', {
          botId: id,
          changes: { description, personality, appearance, position },
          updatedBy: req.user.username,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ Bot ${id} updated by ${req.user.username}`);

      res.json({
        success: true,
        message: `Bot ${id} updated successfully`,
        bot: updatedBot
      });
    } catch (error) {
      console.error(`Error updating bot ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  /**
   * DELETE /api/bots/:id
   * Delete/deactivate a bot
   */
  router.delete('/:id', authenticate, authorize('delete'), async (req, res) => {
    try {
      const { id } = req.params;
      const { permanent } = req.query;

      const bot = npcEngine.registry.get(id);
      if (!bot) {
        return res.status(404).json({
          error: 'Not found',
          message: `Bot ${id} not found`
        });
      }

      if (permanent === 'true') {
        // Permanently delete (only admin)
        if (req.user.role !== 'admin') {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Only admins can permanently delete bots'
          });
        }
        // TODO: Implement permanent deletion
        return res.status(501).json({
          error: 'Not implemented',
          message: 'Permanent deletion not yet implemented'
        });
      } else {
        // Mark as inactive
        await npcEngine.registry.markInactive(id);
      }

      // Unregister from engine if active
      if (npcEngine.npcs.has(id)) {
        npcEngine.unregisterNPC(id);
      }

      // Emit WebSocket event
      if (io) {
        io.emit('bot:deleted', {
          botId: id,
          deletedBy: req.user.username,
          permanent: permanent === 'true',
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ Bot ${id} deleted by ${req.user.username}`);

      res.json({
        success: true,
        message: `Bot ${id} ${permanent === 'true' ? 'permanently deleted' : 'deactivated'}`
      });
    } catch (error) {
      console.error(`Error deleting bot ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  /**
   * POST /api/bots/:id/spawn
   * Spawn a bot in Minecraft
   */
  router.post('/:id/spawn', authenticate, authorize('spawn'), async (req, res) => {
    try {
      const { id } = req.params;
      const { position } = req.body;

      if (!npcEngine.bridge) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Minecraft bridge not configured'
        });
      }

      const bot = npcEngine.registry.get(id);
      if (!bot) {
        return res.status(404).json({
          error: 'Not found',
          message: `Bot ${id} not found`
        });
      }

      // Check if bot is already spawned
      const spawnCount = bot.status === 'active' ? 0 : 1;

      // Check spawn limit
      const limitError = checkSpawnLimit(npcEngine, spawnCount);
      if (limitError) {
        return res.status(400).json(limitError);
      }

      const spawnPosition = position || bot.lastKnownPosition || bot.spawnPosition;
      await npcEngine.spawnNPC(id, { position: spawnPosition });

      // Emit WebSocket event
      if (io) {
        io.emit('bot:spawned', {
          botId: id,
          position: spawnPosition,
          spawnedBy: req.user.username,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ Bot ${id} spawned by ${req.user.username} at`, spawnPosition);

      res.json({
        success: true,
        message: `Bot ${id} spawned successfully`,
        position: spawnPosition
      });
    } catch (error) {
      console.error(`Error spawning bot ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  /**
   * POST /api/bots/:id/despawn
   * Despawn a bot from Minecraft
   */
  router.post('/:id/despawn', authenticate, authorize('spawn'), async (req, res) => {
    try {
      const { id } = req.params;

      if (npcEngine.npcs.has(id)) {
        npcEngine.unregisterNPC(id);
      }

      await npcEngine.registry.recordDespawn(id);

      // Emit WebSocket event
      if (io) {
        io.emit('bot:despawned', {
          botId: id,
          despawnedBy: req.user.username,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ Bot ${id} despawned by ${req.user.username}`);

      res.json({
        success: true,
        message: `Bot ${id} despawned successfully`
      });
    } catch (error) {
      console.error(`Error despawning bot ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  /**
   * POST /api/bots/:id/task
   * Assign a task to a bot
   */
  router.post('/:id/task', authenticate, authorize('command'), async (req, res) => {
    try {
      const { id } = req.params;
      const { action, target, parameters, priority } = req.body;

      if (!action) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Action is required'
        });
      }

      const npc = npcEngine.npcs.get(id);
      if (!npc) {
        return res.status(404).json({
          error: 'Not found',
          message: `Bot ${id} not found or not active`
        });
      }

      const task = {
        action,
        target: target || null,
        ...parameters,
        priority: priority || 'normal',
        sender: req.user.username,
        createdAt: Date.now()
      };

      await npcEngine.assignTask(npc, task);

      // Emit WebSocket event
      if (io) {
        io.emit('bot:task_assigned', {
          botId: id,
          task: { action, target, priority },
          assignedBy: req.user.username,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ Task ${action} assigned to ${id} by ${req.user.username}`);

      res.json({
        success: true,
        message: `Task assigned to bot ${id}`,
        task: { action, target, priority }
      });
    } catch (error) {
      console.error(`Error assigning task to bot ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  /**
   * POST /api/bots/spawn-all
   * Spawn all active bots
   */
  router.post('/spawn-all', authenticate, authorize('spawn'), async (req, res) => {
    try {
      if (!npcEngine.bridge) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Minecraft bridge not configured'
        });
      }

      // Count how many bots would be spawned
      const allBots = npcEngine.registry.getAll();
      const inactiveBots = allBots.filter(bot => bot.status !== 'active');

      // Check spawn limit
      const limitError = checkSpawnLimit(npcEngine, inactiveBots.length);
      if (limitError) {
        return res.status(400).json(limitError);
      }

      const results = await npcEngine.spawnAllKnownNPCs();

      // Emit WebSocket event
      if (io) {
        io.emit('bot:spawn_all', {
          count: results.length,
          bots: results.map(r => r.id),
          spawnedBy: req.user.username,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ ${results.length} bots spawned by ${req.user.username}`);

      res.json({
        success: true,
        message: `Spawned ${results.length} bots`,
        count: results.length,
        bots: results.map(r => ({ id: r.id, role: r.role }))
      });
    } catch (error) {
      console.error('Error spawning all bots:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/bots/status
   * Get engine status
   */
  router.get('/status', authenticate, authorize('read'), (req, res) => {
    try {
      const status = npcEngine.getStatus();

      res.json({
        success: true,
        status: {
          total: status.total,
          idle: status.idle,
          working: status.working,
          queueLength: status.queueLength,
          maxQueueSize: status.maxQueueSize,
          queueUtilization: status.queueUtilization,
          bridgeConnected: status.bridgeConnected,
          npcs: status.npcs
        }
      });
    } catch (error) {
      console.error('Error getting status:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  /**
   * GET /api/bots/learning
   * Get learning profiles
   */
  router.get('/learning', authenticate, authorize('read'), (req, res) => {
    try {
      if (!npcEngine.learningEngine) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Learning engine not available'
        });
      }

      const profiles = Object.values(npcEngine.learningEngine.getAllProfiles());

      res.json({
        success: true,
        count: profiles.length,
        profiles: profiles.map(p => ({
          id: p.id,
          xp: p.xp,
          level: Math.floor(p.xp / 10),
          tasksCompleted: p.tasksCompleted,
          tasksFailed: p.tasksFailed,
          successRate: p.tasksCompleted /
            (p.tasksCompleted + p.tasksFailed) * 100,
          skills: p.skills,
          personality: p.personality
        }))
      });
    } catch (error) {
      console.error('Error getting learning profiles:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  return router;
}

export default { initBotRoutes };
