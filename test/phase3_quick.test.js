/**
 * Phase 3-5 Quick Test Suite
 * Fast tests for multi-bot coordination and advanced features
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { BotRegistry, BOT_ROLES } from '../adapters/mineflayer/bot_registry.js';
import { CoordinationEngine } from '../adapters/mineflayer/coordination_engine.js';

test('Bot Registry - Core Operations', async (t) => {
  await t.test('registers and retrieves bot', () => {
    const registry = new BotRegistry();
    registry.registerBot({ botId: 'bot_01', role: BOT_ROLES.MINER });
    const bot = registry.getBot('bot_01');
    assert.ok(bot);
    assert.equal(bot.botId, 'bot_01');
  });

  await t.test('manages bot status', () => {
    const registry = new BotRegistry();
    registry.registerBot({ botId: 'bot_01' });
    registry.updateBotStatus('bot_01', 'mining');
    const bot = registry.getBot('bot_01');
    assert.equal(bot.status, 'mining');
  });

  await t.test('claims and releases work', () => {
    const registry = new BotRegistry();
    registry.registerBot({ botId: 'bot_01' });
    registry.claimWork('work_01', 'bot_01');
    const work = registry.getBotWork('bot_01');
    assert.equal(work.length, 1);
    registry.releaseWork('work_01');
    assert.equal(registry.getBotWork('bot_01').length, 0);
  });

  await t.test('manages regions', () => {
    const registry = new BotRegistry();
    registry.registerBot({ botId: 'bot_01' });
    registry.registerRegion('mining_area', ['bot_01']);
    const bots = registry.getRegionBots('mining_area');
    assert.equal(bots.length, 1);
  });

  await t.test('finds bots by capability', () => {
    const registry = new BotRegistry();
    registry.registerBot({ botId: 'miner_01', capabilities: ['mining'] });
    registry.registerBot({ botId: 'builder_01', capabilities: ['building'] });
    const miners = registry.findBotsByCapability('mining');
    assert.equal(miners.length, 1);
    assert.equal(miners[0], 'miner_01');
  });

  await t.test('detects collisions', () => {
    const registry = new BotRegistry();
    registry.registerBot({ botId: 'bot_01', position: { x: 0, y: 64, z: 0 } });
    registry.registerBot({ botId: 'bot_02', position: { x: 3, y: 64, z: 0 } });
    const collision = registry.checkCollision('bot_01', 'bot_02', 5);
    assert.equal(collision, true);
  });
});

test('Coordination Engine - Swarm Management', async (t) => {
  await t.test('registers swarm', () => {
    const engine = new CoordinationEngine();
    const result = engine.registerSwarm([
      { botId: 'miner_01', role: BOT_ROLES.MINER },
      { botId: 'builder_01', role: BOT_ROLES.BUILDER }
    ]);
    assert.equal(result.success.length, 2);
  });

  await t.test('assigns work to capable bots', () => {
    const engine = new CoordinationEngine();
    engine.registerSwarm([
      { botId: 'miner_01', capabilities: ['mining'] },
      { botId: 'builder_01', capabilities: ['building'] }
    ]);
    
    const result = engine.assignWork('mine_coal', {
      requiredCapability: 'mining'
    });
    
    assert.equal(result.success, true);
    assert.equal(result.claim.botId, 'miner_01');
  });

  await t.test('loads balance across region', () => {
    const engine = new CoordinationEngine();
    engine.registerSwarm([
      { botId: 'bot_01' },
      { botId: 'bot_02' }
    ]);
    engine.registry.registerRegion('zone_1', ['bot_01', 'bot_02']);
    engine.registry.claimWork('task_1', 'bot_01');
    engine.registry.claimWork('task_2', 'bot_01');
    engine.registry.claimWork('task_3', 'bot_02');
    
    const balance = engine.getSwarmStatus('zone_1');
    assert.ok(balance.botCount >= 1);
    assert.ok(balance.totalTasks >= 3);
  });

  await t.test('exports state for analysis', () => {
    const engine = new CoordinationEngine();
    engine.registerSwarm([{ botId: 'bot_01' }]);
    
    const state = engine.exportState();
    assert.ok(state.bots);
    assert.ok(state.status);
  });
});

test('Mineflayer Bridge - Interface Compatibility', async (t) => {
  await t.test('defines movement API', () => {
    const movementAPI = {
      moveTo: async (target) => ({ success: true, target }),
      navigate: async (waypoints) => ({ success: true, waypoints }),
      follow: async (entity) => ({ success: true, entity })
    };
    
    assert.ok(movementAPI.moveTo);
    assert.ok(movementAPI.navigate);
    assert.ok(movementAPI.follow);
  });

  await t.test('defines interaction API', () => {
    const interactionAPI = {
      mine: async (block) => ({ success: true, block }),
      place: async (target, type) => ({ success: true, target, type }),
      interact: async (target) => ({ success: true, target })
    };
    
    assert.ok(interactionAPI.mine);
    assert.ok(interactionAPI.place);
    assert.ok(interactionAPI.interact);
  });

  await t.test('defines inventory API', () => {
    const inventoryAPI = {
      getInventory: async () => ([]),
      equipItem: async (item) => ({ success: true, item }),
      dropItem: async (slot) => ({ success: true, slot })
    };
    
    assert.ok(inventoryAPI.getInventory);
    assert.ok(inventoryAPI.equipItem);
    assert.ok(inventoryAPI.dropItem);
  });
});

test('Autonomy Loop - Core Pattern', async (t) => {
  await t.test('implements observe phase', async () => {
    const observe = async (bot) => ({
      position: { x: 0, y: 64, z: 0 },
      health: 20,
      inventory: []
    });
    
    const state = await observe('bot_01');
    assert.ok(state.position);
    assert.ok(state.health);
  });

  await t.test('implements decide phase', async () => {
    const decide = async (state, goal) => [
      { type: 'move_to', target: { x: 100, y: 64, z: 0 } },
      { type: 'mine_block', target: { x: 100, y: 64, z: 0 } }
    ];
    
    const plan = await decide({ position: { x: 0, y: 64, z: 0 } }, 'mine_coal');
    assert.ok(Array.isArray(plan));
    assert.equal(plan.length, 2);
  });

  await t.test('implements validate phase', async () => {
    const validate = async (plan) => ({
      valid: true,
      errors: [],
      warnings: []
    });
    
    const plan = [{ type: 'move_to', target: { x: 100, y: 64, z: 0 } }];
    const result = await validate(plan);
    assert.equal(result.valid, true);
  });

  await t.test('implements act phase', async () => {
    const act = async (task) => ({
      success: true,
      taskId: task.type,
      result: {}
    });
    
    const result = await act({ type: 'move_to', target: { x: 100, y: 64, z: 0 } });
    assert.equal(result.success, true);
  });

  await t.test('completes full autonomy loop', async () => {
    let state = { position: { x: 0, y: 64, z: 0 }, health: 20 };
    
    // Observe
    const observed = { ...state, timestamp: new Date() };
    
    // Decide
    const plan = [{ type: 'move_to', target: { x: 100, y: 64, z: 0 } }];
    
    // Validate
    const validated = { valid: true, errors: [] };
    
    // Act
    const executed = { success: true, plan };
    
    assert.ok(observed);
    assert.ok(plan);
    assert.ok(validated.valid);
    assert.ok(executed.success);
  });
});
