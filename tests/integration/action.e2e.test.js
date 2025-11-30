import express from 'express';
import { createServer } from 'http';
import { jest } from '@jest/globals';
import EventEmitter from 'events';

describe('Action REST → UAF (mocked bridge) E2E', () => {
  let app;
  let server;
  let baseUrl;
  let ioMock;
  let registryMock;
  let npcSystem;
  let initBotRoutes;

  beforeAll(async () => {
    process.env.ADMIN_API_KEY = 'test-key';
    process.env.LLM_API_KEY = 'test-key';

    jest.unstable_mockModule('../../middleware/auth.js', () => ({
      authenticate: (_req, _res, next) => {
        _req.user = { username: 'tester', role: 'admin' };
        next();
      },
      authorize: () => (_req, _res, next) => next(),
    }));

    ({ initBotRoutes } = await import('../../routes/bot.js'));

    registryMock = {
      getAll: () => [],
      get: (id) => ({
        id,
        npcType: 'miner',
        role: 'miner',
        status: 'active',
        spawnPosition: { x: 0, y: 64, z: 0 },
        metadata: { inventory: ['stone_pickaxe'] },
        inventory: ['stone_pickaxe'],
      }),
      recordDespawn: jest.fn().mockResolvedValue(true),
      upsert: jest.fn().mockResolvedValue(true),
      markInactive: jest.fn().mockResolvedValue(true),
    };

    const bridgeMock = {
      dispatchAction: jest.fn().mockResolvedValue({ success: true }),
    };

    const engineMock = new EventEmitter();
    engineMock.registry = registryMock;
    engineMock.bridge = bridgeMock;

    npcSystem = {
      npcEngine: engineMock,
      npcSpawner: { spawn: jest.fn(), spawnAllKnown: jest.fn() },
      npcFinalizer: { finalizeNPC: jest.fn() },
      minecraftBridge: bridgeMock,
    };

    app = express();
    app.use(express.json());
    ioMock = { emit: jest.fn() };
    app.use('/api/bots', initBotRoutes(npcSystem, ioMock));

    server = createServer(app).listen(0);
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll((done) => {
    if (npcSystem?.npcEngine?.stopHungerMonitor) {
      npcSystem.npcEngine.stopHungerMonitor();
    }
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  test('POST /api/bots/:id/action dispatches mine action and updates bridge', async () => {
    const res = await fetch(`${baseUrl}/api/bots/miner_01/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test' },
      body: JSON.stringify({
        type: 'mine',
        block: 'minecraft:iron_ore',
        position: { x: 10, y: 64, z: -5 },
      }),
    });
    expect(res.status).toBe(200);
    expect(npcSystem.minecraftBridge.dispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'mine',
        botId: 'miner_01',
        target: 'minecraft:iron_ore',
      })
    );
    expect(ioMock.emit).toHaveBeenCalledWith(
      'bot:actionDispatched',
      expect.objectContaining({ botId: 'miner_01', action: 'mine' })
    );
  });

  test('POST /api/bots/:id/action fails when tool missing', async () => {
    registryMock.get = () => ({
      id: 'miner_01',
      npcType: 'miner',
      role: 'miner',
      status: 'active',
      spawnPosition: { x: 0, y: 64, z: 0 },
      metadata: { inventory: [] },
      inventory: [],
    });

    const res = await fetch(`${baseUrl}/api/bots/miner_01/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test' },
      body: JSON.stringify({
        type: 'mine',
        block: 'minecraft:iron_ore',
        position: { x: 10, y: 64, z: -5 },
      }),
    });
    expect(res.status).toBe(400);
  });
});
