/**
 * Phase 4-5 Integration Tests
 * Comprehensive test suite for Mineflayer bridge and autonomy loop
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { MineflayerBridge } from '../adapters/mineflayer/mineflayer_bridge.js';
import { WorldStateObserver } from '../adapters/mineflayer/world_observer.js';
import { TaskPlanner } from '../adapters/mineflayer/task_planner.js';
import { AutonomyLoop } from '../adapters/mineflayer/autonomy_loop.js';
import { AutonomyOrchestrator } from '../adapters/mineflayer/autonomy_orchestrator.js';
import { BotRegistry } from '../adapters/mineflayer/bot_registry.js';
import { CoordinationEngine } from '../adapters/mineflayer/coordination_engine.js';

// Mock implementations for testing
class MockMineflayerBot {
  constructor(username) {
    this.username = username;
    this.entity = {
      position: { x: 0, y: 64, z: 0 },
      yaw: 0,
      pitch: 0,
      distanceTo: (pos) => {
        const dx = this.entity.position.x - pos.x;
        const dy = this.entity.position.y - pos.y;
        const dz = this.entity.position.z - pos.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
    };
    this.health = 20;
    this.food = 20;
    this.game = { dimension: 'minecraft:overworld', gameMode: 'survival' };
    this.inventory = {
      size: () => 36,
      items: () => []
    };
    this.pathfinder = { isMoving: () => false };
    this.listeners = new Map();
  }

  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
  }

  once(event, listener) {
    const wrappedListener = (...args) => {
      listener(...args);
      const listeners = this.listeners.get(event);
      listeners.splice(listeners.indexOf(wrappedListener), 1);
    };
    this.on(event, wrappedListener);
  }

  emit(event, ...args) {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach((listener) => listener(...args));
  }

  chat(message) {
    this.emit('chat', 'Bot', message);
  }

  async quit() {
    return true;
  }

  blockAt(pos) {
    return { name: 'stone', hardness: 1 };
  }

  nearestEntity(filter) {
    return [];
  }

  look(yaw, pitch) {
    this.entity.yaw = yaw;
    this.entity.pitch = pitch;
  }
}

class MockMineflayerModule {
  static createBot(options) {
    return new MockMineflayerBot(options.username);
  }

  static goals = {
    GoalBlock: class {
      constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
    }
  };
}

class MockPathfinderPlugin {
  static inject(bot) {
    bot.pathfinder.setGoal = async (goal) => {
      bot.entity.position = { x: goal.x, y: goal.y, z: goal.z };
      return true;
    };
  }
}

class MockAdapter {
  async executeTask(task) {
    return { success: true, data: { taskId: task.id } };
  }
}

class MockPolicyEngine {
  validateTaskPolicy(task, context) {
    return { valid: true, errors: [] };
  }
}

test('Mineflayer Bridge - Connection Management', async (t) => {
  await t.test('initializes bridge with valid modules', () => {
    const bridge = new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin, {
      host: 'localhost',
      port: 25565
    });

    assert.ok(bridge);
    assert.equal(bridge.options.host, 'localhost');
    assert.equal(bridge.options.port, 25565);
  });

  await t.test('tracks connected bots', async () => {
    const bridge = new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin);
    const result = await bridge.connectBot('bot_01', { username: 'TestBot' });

    assert.equal(result.success, true);
    assert.ok(bridge.bots.has('bot_01'));
  });

  await t.test('prevents duplicate connections', async () => {
    const bridge = new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin);
    await bridge.connectBot('bot_01', { username: 'TestBot' });

    const result = await bridge.connectBot('bot_01', { username: 'TestBot' });
    assert.equal(result.success, false);
  });

  await t.test('provides bot state snapshots', async () => {
    const bridge = new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin);
    await bridge.connectBot('bot_01', { username: 'TestBot' });

    const state = bridge.getBotState('bot_01');
    assert.ok(state);
    assert.ok(state.position);
    assert.ok(state.health !== undefined);
  });

  await t.test('performs health checks', async () => {
    const bridge = new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin);
    await bridge.connectBot('bot_01', { username: 'TestBot' });

    const health = bridge.healthCheckAll();
    assert.ok(health.bots);
    assert.ok(health.bots.bot_01);
  });
});

test('World State Observer - Environmental Awareness', async (t) => {
  await t.test('observes world state', () => {
    const bridge = new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin);
    const observer = new WorldStateObserver(bridge);

    assert.ok(observer);
    assert.equal(observer.options.scanRadius, 32);
  });

  await t.test('starts and stops observation', async () => {
    const bridge = new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin);
    await bridge.connectBot('bot_01', { username: 'TestBot' });

    const observer = new WorldStateObserver(bridge);
    observer.startObserving('bot_01');

    assert.ok(observer.scanTimers.has('bot_01'));

    observer.stopObserving('bot_01');
    assert.equal(observer.scanTimers.has('bot_01'), false);
  });

  await t.test('tracks entity positions', async () => {
    const bridge = new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin);
    await bridge.connectBot('bot_01', { username: 'TestBot' });

    const observer = new WorldStateObserver(bridge);
    observer.startObserving('bot_01');

    // Simulate a scan
    const mockWorld = {
      botState: { position: { x: 0, y: 64, z: 0 }, health: 20 },
      entities: [
        { id: 'player1', name: 'Player1', type: 'player', position: { x: 5, y: 64, z: 0 }, distance: 5 }
      ],
      blocks: []
    };

    observer.worldState.set('bot_01', mockWorld);

    const entities = observer.findEntities('bot_01', { type: 'player' });
    assert.equal(entities.length, 1);
  });

  await t.test('records events', async () => {
    const bridge = new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin);
    const observer = new WorldStateObserver(bridge);

    observer.recordEvent('bot_01', 'mine_block', { block: 'coal_ore' });
    observer.recordEvent('bot_01', 'find_entity', { entity: 'Zombie' });

    const history = observer.getEventHistory('bot_01');
    assert.equal(history.length, 2);
  });
});

test('Task Planner - LLM-Safe Goal Planning', async (t) => {
  await t.test('initializes with goal templates', () => {
    const registry = new BotRegistry();
    const observer = new WorldStateObserver(new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin));
    const planner = new TaskPlanner(observer, registry);

    assert.ok(planner.goalTemplates['mine_coal']);
    assert.ok(planner.goalTemplates['gather_wood']);
    assert.ok(planner.goalTemplates['explore_area']);
  });

  await t.test('generates safe plans from goals', async () => {
    const registry = new BotRegistry();
    const observer = new WorldStateObserver(new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin));
    const planner = new TaskPlanner(observer, registry);

    // Set mock world state
    const mockWorld = {
      botState: { position: { x: 0, y: 64, z: 0 }, health: 20, inventory: { items: [] } },
      entities: [],
      blocks: []
    };
    observer.worldState.set('bot_01', mockWorld);

    const result = await planner.generatePlan('bot_01', 'idle');
    assert.equal(result.success, true);
    assert.ok(Array.isArray(result.plan));
    assert.ok(result.plan.length > 0);
  });

  await t.test('validates task plans', async () => {
    const registry = new BotRegistry();
    const observer = new WorldStateObserver(new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin));
    const planner = new TaskPlanner(observer, registry);

    const validPlan = [
      { type: 'move_to', target: { x: 10, y: 64, z: 10 } },
      { type: 'mine_block', target: { x: 10, y: 64, z: 11 } }
    ];

    const validation = planner._validatePlan(validPlan);
    assert.equal(validation.valid, true);
  });

  await t.test('rejects invalid plans', async () => {
    const registry = new BotRegistry();
    const observer = new WorldStateObserver(new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin));
    const planner = new TaskPlanner(observer, registry);

    const invalidPlan = [
      { type: 'unknown_action', target: {} }
    ];

    const validation = planner._validatePlan(invalidPlan);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.length > 0);
  });

  await t.test('evaluates plan feasibility', async () => {
    const registry = new BotRegistry();
    const observer = new WorldStateObserver(new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin));
    const planner = new TaskPlanner(observer, registry);

    const mockWorld = {
      botState: { position: { x: 0, y: 64, z: 0 }, health: 20, inventory: { items: [] } },
      entities: [],
      blocks: [],
      summary: { nearbyHostiles: 0 }
    };
    observer.worldState.set('bot_01', mockWorld);

    const plan = [
      { type: 'move_to', target: { x: 10, y: 64, z: 10 } }
    ];

    const evaluation = planner.evaluatePlan('bot_01', plan);
    assert.ok(evaluation.feasible !== undefined);
  });
});

test('Autonomy Loop - ODVA Execution', async (t) => {
  await t.test('starts autonomy loop for bot', async () => {
    const adapter = new MockAdapter();
    const observer = new WorldStateObserver(new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin));
    const registry = new BotRegistry();
    const planner = new TaskPlanner(observer, registry);
    const policyEngine = new MockPolicyEngine();

    const loop = new AutonomyLoop(adapter, observer, planner, registry, policyEngine);
    const result = await loop.startLoop('bot_01', ['idle']);

    assert.equal(result.success, true);
    assert.ok(result.loopInterval);
  });

  await t.test('stops autonomy loop', async () => {
    const adapter = new MockAdapter();
    const observer = new WorldStateObserver(new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin));
    const registry = new BotRegistry();
    const planner = new TaskPlanner(observer, registry);
    const policyEngine = new MockPolicyEngine();

    const loop = new AutonomyLoop(adapter, observer, planner, registry, policyEngine);
    await loop.startLoop('bot_01', ['idle']);

    const stopResult = await loop.stopLoop('bot_01');
    assert.equal(stopResult.success, true);
  });

  await t.test('queues goals for bot', async () => {
    const adapter = new MockAdapter();
    const observer = new WorldStateObserver(new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin));
    const registry = new BotRegistry();
    const planner = new TaskPlanner(observer, registry);
    const policyEngine = new MockPolicyEngine();

    const loop = new AutonomyLoop(adapter, observer, planner, registry, policyEngine);
    await loop.startLoop('bot_01', ['idle']);

    const queued = loop.queueGoal('bot_01', 'mine_coal', {});
    assert.equal(queued, true);
  });

  await t.test('tracks autonomy history', async () => {
    const adapter = new MockAdapter();
    const observer = new WorldStateObserver(new MineflayerBridge(MockMineflayerModule, MockPathfinderPlugin));
    const registry = new BotRegistry();
    const planner = new TaskPlanner(observer, registry);
    const policyEngine = new MockPolicyEngine();

    const loop = new AutonomyLoop(adapter, observer, planner, registry, policyEngine);
    await loop.startLoop('bot_01', ['idle']);

    const history = loop.getHistory('bot_01');
    assert.ok(Array.isArray(history));
  });
});

test('Autonomy Orchestrator - Swarm Management', async (t) => {
  await t.test('initializes orchestrator with all systems', () => {
    const adapter = new MockAdapter();
    const coordinationEngine = new CoordinationEngine();
    const policyEngine = new MockPolicyEngine();
    const mineflayerModules = { mineflayer: MockMineflayerModule, pathfinder: MockPathfinderPlugin };

    const orchestrator = new AutonomyOrchestrator(
      adapter,
      coordinationEngine,
      policyEngine,
      mineflayerModules
    );

    assert.ok(orchestrator);
    assert.ok(orchestrator.bridge);
    assert.ok(orchestrator.observer);
    assert.ok(orchestrator.planner);
    assert.ok(orchestrator.autonomyLoop);
  });

  await t.test('connects bot with autonomy', async () => {
    const adapter = new MockAdapter();
    const coordinationEngine = new CoordinationEngine();
    const policyEngine = new MockPolicyEngine();
    const mineflayerModules = { mineflayer: MockMineflayerModule, pathfinder: MockPathfinderPlugin };

    const orchestrator = new AutonomyOrchestrator(
      adapter,
      coordinationEngine,
      policyEngine,
      mineflayerModules
    );

    const result = await orchestrator.connectBotWithAutonomy('bot_01', { username: 'TestBot' }, ['idle']);
    assert.equal(result.success, true);
    assert.equal(result.botId, 'bot_01');
  });

  await t.test('gets swarm status', async () => {
    const adapter = new MockAdapter();
    const coordinationEngine = new CoordinationEngine();
    const policyEngine = new MockPolicyEngine();
    const mineflayerModules = { mineflayer: MockMineflayerModule, pathfinder: MockPathfinderPlugin };

    const orchestrator = new AutonomyOrchestrator(
      adapter,
      coordinationEngine,
      policyEngine,
      mineflayerModules
    );

    await orchestrator.connectBotWithAutonomy('bot_01', { username: 'TestBot' }, ['idle']);

    const status = orchestrator.getSwarmStatus();
    assert.ok(status.has('bot_01'));
  });

  await t.test('queues bot goals', async () => {
    const adapter = new MockAdapter();
    const coordinationEngine = new CoordinationEngine();
    const policyEngine = new MockPolicyEngine();
    const mineflayerModules = { mineflayer: MockMineflayerModule, pathfinder: MockPathfinderPlugin };

    const orchestrator = new AutonomyOrchestrator(
      adapter,
      coordinationEngine,
      policyEngine,
      mineflayerModules
    );

    await orchestrator.connectBotWithAutonomy('bot_01', { username: 'TestBot' }, ['idle']);

    const queued = orchestrator.queueBotGoal('bot_01', 'mine_coal', {});
    assert.equal(queued, true);
  });

  await t.test('queues swarm goals', async () => {
    const adapter = new MockAdapter();
    const coordinationEngine = new CoordinationEngine();
    const policyEngine = new MockPolicyEngine();
    const mineflayerModules = { mineflayer: MockMineflayerModule, pathfinder: MockPathfinderPlugin };

    const orchestrator = new AutonomyOrchestrator(
      adapter,
      coordinationEngine,
      policyEngine,
      mineflayerModules
    );

    await orchestrator.connectBotWithAutonomy('bot_01', { username: 'TestBot' }, ['idle']);

    orchestrator.queueSwarmGoal('explore_area', {});
    assert.equal(orchestrator.swarmGoals.length, 1);
  });

  await t.test('gets swarm health', async () => {
    const adapter = new MockAdapter();
    const coordinationEngine = new CoordinationEngine();
    const policyEngine = new MockPolicyEngine();
    const mineflayerModules = { mineflayer: MockMineflayerModule, pathfinder: MockPathfinderPlugin };

    const orchestrator = new AutonomyOrchestrator(
      adapter,
      coordinationEngine,
      policyEngine,
      mineflayerModules
    );

    await orchestrator.connectBotWithAutonomy('bot_01', { username: 'TestBot' }, ['idle']);

    const health = orchestrator.getSwarmHealth();
    assert.ok(health.summary);
    assert.equal(health.summary.totalBots, 1);
  });

  await t.test('exports full autonomy state', async () => {
    const adapter = new MockAdapter();
    const coordinationEngine = new CoordinationEngine();
    const policyEngine = new MockPolicyEngine();
    const mineflayerModules = { mineflayer: MockMineflayerModule, pathfinder: MockPathfinderPlugin };

    const orchestrator = new AutonomyOrchestrator(
      adapter,
      coordinationEngine,
      policyEngine,
      mineflayerModules
    );

    await orchestrator.connectBotWithAutonomy('bot_01', { username: 'TestBot' }, ['idle']);

    const state = orchestrator.exportState();
    assert.ok(state.timestamp);
    assert.ok(state.bots);
  });
});

test('End-to-End Autonomy Flow', async (t) => {
  await t.test('complete autonomy cycle: connect -> observe -> plan -> act -> disconnect', async () => {
    const adapter = new MockAdapter();
    const coordinationEngine = new CoordinationEngine();
    const policyEngine = new MockPolicyEngine();
    const mineflayerModules = { mineflayer: MockMineflayerModule, pathfinder: MockPathfinderPlugin };

    const orchestrator = new AutonomyOrchestrator(
      adapter,
      coordinationEngine,
      policyEngine,
      mineflayerModules
    );

    // Connect with autonomy
    const connectResult = await orchestrator.connectBotWithAutonomy('bot_01', {
      username: 'TestBot'
    }, ['idle']);

    assert.equal(connectResult.success, true);

    // Queue a goal
    const queued = orchestrator.queueBotGoal('bot_01', 'explore_area', {});
    assert.equal(queued, true);

    // Get status
    const status = orchestrator.getBotStatus('bot_01');
    assert.ok(status);
    assert.ok(status.session);

    // Get swarm health
    const health = orchestrator.getSwarmHealth();
    assert.ok(health.summary);

    // Disconnect
    const disconnectResult = await orchestrator.disconnectBot('bot_01', 'Test complete');
    assert.equal(disconnectResult.success, true);
  });
});
