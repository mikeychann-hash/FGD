// routes/llm.js
// LLM command interface for natural language bot control

import express from 'express';
import { authenticate, authorize, ROLES } from '../middleware/auth.js';
import { spawnBot, spawnAllBots } from '../src/services/spawn_pipeline.js';
import { fail } from '../src/middleware/response.js';

const router = express.Router();

/**
 * Command parser for natural language inputs
 */
class LLMCommandParser {
  constructor(npcSystem, io) {
    this.npcSystem = npcSystem;
    this.engine = npcSystem?.npcEngine;
    this.io = io;




    // Command patterns
    this.patterns = [
      {
        regex:
          /(?:spawn|create|summon)\s+(?:a\s+)?(?:bot|npc)\s+(?:named\s+)?([a-z0-9_-]+)(?:\s+as\s+(?:a\s+)?([a-z]+))?/i,
        handler: this.handleSpawn.bind(this),
      },
      {
        regex: /(?:delete|remove|despawn)\s+(?:bot|npc)\s+([a-z0-9_-]+)/i,
        handler: this.handleDelete.bind(this),
      },
      {
        regex: /(?:list|show|get)\s+(?:all\s+)?(?:bots|npcs)/i,
        handler: this.handleList.bind(this),
      },
      {
        regex:
          /(?:assign|give|send)\s+([a-z0-9_-]+)\s+(?:a\s+)?(?:task|command|order)\s+(?:to\s+)?(.+)/i,
        handler: this.handleAssignTask.bind(this),
      },
      {
        regex: /(?:get|show|display)\s+(?:status|info|details)\s+(?:for|of|about)\s+([a-z0-9_-]+)/i,
        handler: this.handleStatus.bind(this),
      },
      {
        regex:
          /(?:teleport|move|send)\s+([a-z0-9_-]+)\s+(?:to\s+)?(?:position\s+)?(?:\(?)?(-?\d+)[,\s]+(-?\d+)[,\s]+(-?\d+)/i,
        handler: this.handleTeleport.bind(this),
      },
      {
        regex: /spawn\s+all\s+(?:bots|npcs)/i,
        handler: this.handleSpawnAll.bind(this),
      },
    ];
  }

  /**
   * Parse and execute a natural language command
   * @param {string} input - Natural language command
   * @param {Object} user - User executing the command
   * @returns {Promise<Object>} Command result
   */
  async parse(input, user, context = {}) {
    const cleanInput = input.trim();

    // Try to match against patterns
    for (const { regex, handler } of this.patterns) {
      const match = cleanInput.match(regex);
      if (match) {
        try {
          return await handler(match, user, context);
        } catch (error) {
          return {
            success: false,
            error: error.message,
            suggestion: 'Check your command syntax and try again',
          };
        }
      }
    }

    // If no pattern matched, try the interpreter
    try {
      const result = await this.engine.handleCommand(cleanInput, user.username, context);
      if (result) {
        return {
          success: true,
          message: 'Command interpreted and executed',
          result,
        };
      }
    } catch (error) {
      // Interpreter failed, return suggestions
    }

    // Return suggestions
    return {
      success: false,
      error: 'Command not recognized',
      suggestions: [
        'spawn bot miner_01 as miner',
        'list all bots',
        'assign bot_01 task mine iron',
        'get status for bot_01',
        'move bot_01 to 100 64 200',
        'spawn all bots',
        'delete bot bot_01',
      ],
    };
  }

  async handleSpawn(match, user) {
    const name = match[1];
    const role = match[2] || 'builder';

    const bot = await this.engine.createNPC({
      baseName: name,
      role: role,
      npcType: role,
      metadata: {
        createdBy: user.username,
        createdByRole: user.role,
        createdVia: 'llm',
      },
      autoSpawn: false,
    });

    const spawnResult = await spawnBot(this.npcSystem, this.io, {
      botId: bot.id,
      position: bot.spawnPosition,
      user,
      source: 'llm-command',
    });

    return {
      success: true,
      message: `Created bot ${bot.id} as ${role}` +
        (spawnResult.spawned ? ' and spawned' : ' (spawn queued)'),
      bot: {
        id: bot.id,
        role: bot.role,
        personality: bot.personalitySummary,
        position: spawnResult.position,
        spawned: spawnResult.spawned,
      },
    };
  }

  async handleDelete(match, user) {
    const botId = match[1];

    const bot = this.engine.registry.get(botId);
    if (!bot) {
      return {
        success: false,
        error: `Bot ${botId} not found`,
      };
    }

    await this.engine.registry.markInactive(botId);
    if (this.engine.npcs.has(botId)) {
      this.engine.unregisterNPC(botId);
    }

    return {
      success: true,
      message: `Bot ${botId} deleted`,
    };
  }

  async handleList(match, user) {
    const bots = this.engine.registry.listActive();

    return {
      success: true,
      message: `Found ${bots.length} active bots`,
      bots: bots.map((bot) => ({
        id: bot.id,
        role: bot.role,
        status: bot.status,
        description: bot.description,
      })),
    };
  }

  async handleAssignTask(match, user) {
    const botId = match[1];
    const taskDescription = match[2];

    const npc = this.engine.npcs.get(botId);
    if (!npc) {
      return {
        success: false,
        error: `Bot ${botId} not found or not active`,
      };
    }

    // Try to interpret the task
    const task = await this.engine.handleCommand(taskDescription, user.username);

    return {
      success: true,
      message: `Task assigned to ${botId}`,
      task,
    };
  }

  async handleStatus(match, user) {
    const botId = match[1];

    const bot = this.engine.registry.get(botId);
    if (!bot) {
      return {
        success: false,
        error: `Bot ${botId} not found`,
      };
    }

    let learning = null;
    if (this.engine.learningEngine) {
      const profile = this.engine.learningEngine.getProfile(botId);
      if (profile) {
        learning = {
          xp: profile.xp,
          level: Math.floor(profile.xp / 10),
          tasksCompleted: profile.tasksCompleted,
          tasksFailed: profile.tasksFailed,
        };
      }
    }

    return {
      success: true,
      bot: {
        id: bot.id,
        role: bot.role,
        status: bot.status,
        personality: bot.personalitySummary,
        position: bot.lastKnownPosition || bot.spawnPosition,
        learning,
      },
    };
  }

  async handleTeleport(match, user) {
    const botId = match[1];
    const x = parseInt(match[2]);
    const y = parseInt(match[3]);
    const z = parseInt(match[4]);

    const bot = this.engine.registry.get(botId);
    if (!bot) {
      return {
        success: false,
        error: `Bot ${botId} not found`,
      };
    }

    const position = { x, y, z };
    await this.engine.registry.upsert({
      ...bot,
      spawnPosition: position,
      lastKnownPosition: position,
    });

    // If bot is active, re-spawn at new position via the Golden Path so budget,
    // validation, and dead-letter queueing are enforced.
    if (this.engine.bridge && this.engine.npcs.has(botId)) {
      await spawnBot(this.npcSystem, this.io, {
        botId,
        position,
        user,
        source: 'llm_teleport',
      });
    }

    return {
      success: true,
      message: `Bot ${botId} moved to (${x}, ${y}, ${z})`,
      position,
    };
  }

  async handleSpawnAll(match, user) {
    const results = await spawnAllBots(this.npcSystem, this.io, {
      user,
      source: 'llm-command',
    });

    return {
      success: true,
      message: `Spawned ${results.count} bots`,
      count: results.count,
    };
  }
}

/**
 * Initialize LLM routes
 * @param {NPCSystem} npcSystem - The NPC system instance
 * @param {Server} io - Socket.io server instance
 */
export function initLLMRoutes(npcSystem, io) {
  const parser = new LLMCommandParser(npcSystem, io);
  /**
   * POST /api/llm/command
   * Execute a natural language command
   */
  router.post('/command', authenticate, authorize('command'), async (req, res) => {
    try {
      const { command, context } = req.body;

      if (!command || typeof command !== 'string') {
        return fail(res, 400, 'Bad request', 'Command must be a non-empty string');
      }

      console.log(`🤖 LLM command from ${req.user.username}: ${command}`);

      const result = await parser.parse(command, req.user, context);

      // Emit WebSocket event
      if (io) {
        io.emit('llm:command', {
          command,
          result,
          executedBy: req.user.username,
          context,
          timestamp: new Date().toISOString(),
        });
      }

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error executing LLM command:', error);
      return fail(res, 500, 'Internal server error', error.message);
    }
  });

  /**
   * POST /api/llm/batch
   * Execute multiple commands in sequence
   */
  router.post('/batch', authenticate, authorize('command'), async (req, res) => {
    try {
      const { commands } = req.body;

      if (!Array.isArray(commands)) {
        return fail(res, 400, 'Bad request', 'Commands must be an array');
      }

      console.log(`🤖 LLM batch (${commands.length} commands) from ${req.user.username}`);

      const results = [];
      for (const command of commands) {
        const result = await parser.parse(command, req.user);
        results.push({
          command,
          result,
        });

        // Stop on first error if requested
        if (!result.success && req.body.stopOnError) {
          break;
        }
      }

      // Emit WebSocket event
      if (io) {
        io.emit('llm:batch', {
          count: commands.length,
          results,
          executedBy: req.user.username,
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        count: commands.length,
        results,
      });
    } catch (error) {
      console.error('Error executing LLM batch:', error);
      return fail(res, 500, 'Internal server error', error.message);
    }
  });

  /**
   * GET /api/llm/help
   * Get available commands and examples
   */
  router.get('/help', authenticate, (req, res) => {
    res.json({
      success: true,
      commands: [
        {
          pattern: 'spawn bot <name> as <role>',
          description: 'Create and spawn a new bot',
          examples: ['spawn bot miner_01 as miner', 'create npc guard_alpha as guard'],
        },
        {
          pattern: 'list all bots',
          description: 'List all active bots',
          examples: ['list all bots', 'show all npcs'],
        },
        {
          pattern: 'assign <bot> task <description>',
          description: 'Assign a task to a bot',
          examples: ['assign miner_01 task mine iron ore', 'give builder_01 task build a tower'],
        },
        {
          pattern: 'get status for <bot>',
          description: 'Get detailed bot status',
          examples: ['get status for miner_01', 'show info about guard_01'],
        },
        {
          pattern: 'move <bot> to <x> <y> <z>',
          description: 'Teleport a bot to coordinates',
          examples: ['move miner_01 to 100 64 200', 'teleport guard_01 to -50 70 150'],
        },
        {
          pattern: 'spawn all bots',
          description: 'Spawn all registered bots',
          examples: ['spawn all bots', 'summon all npcs'],
        },
        {
          pattern: 'delete bot <name>',
          description: 'Remove a bot',
          examples: ['delete bot miner_01', 'remove npc old_bot'],
        },
      ],
      notes: [
        'Commands are case-insensitive',
        'Bot names should use lowercase and underscores',
        'Available roles: miner, builder, scout, guard, gatherer',
      ],
    });
  });

  return router;
}

export default { initLLMRoutes, LLMCommandParser };
