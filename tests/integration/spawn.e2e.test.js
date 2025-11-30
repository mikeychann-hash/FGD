import express from 'express';
import { createServer } from 'http';
import { jest } from '@jest/globals';
import EventEmitter from 'events';

describe('Spawn REST → Bridge (mocked plugin) E2E', () => {
  let app;
  let server;
  let baseUrl;
  let ioMock;
  let npcSystem;
  let registryMock;
  let engineMock;
  let spawnerMock;
  let initBotRoutes;

  beforeAll(async () => {
    process.env.ADMIN_API_KEY = 'test-key';
    process.env.LLM_API_KEY = 'test-key';

    jest.unstable_mockModule('../../middleware/auth.js', () => ({
      authenticate: (req, _res, next) => {
        req.user = { username: 'tester', role: 'admin' };
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
        status: 'inactive',
        spawnPosition: { x: 0, y: 64, z: 0 },
        metadata: {},
      }),
      recordDespawn: jest.fn().mockResolvedValue(true),
      upsert: jest.fn().mockResolvedValue(true),
      markInactive: jest.fn().mockResolvedValue(true),
    };

    spawnerMock = {
      getDeadLetterQueue: () => [],
      spawn: jest.fn().mockResolvedValue({ id: 'miner_01' }),
      spawnAllKnown: jest.fn().mockResolvedValue([{ id: 'bot1' }, { id: 'bot2' }]),
    };

    engineMock = new EventEmitter();
    engineMock.registry = registryMock;
    engineMock.mineflayerBridge = {};
    engineMock.spawnNPC = jest.fn().mockResolvedValue({ success: true });
    engineMock.spawnAllKnownNPCs = jest.fn().mockResolvedValue([{ id: 'bot1' }, { id: 'bot2' }]);

    npcSystem = {
      npcEngine: engineMock,
      npcSpawner: spawnerMock,
      npcFinalizer: { finalizeNPC: jest.fn() },
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
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  test('POST /api/bots/:id/spawn uses canonical spawner and emits WS', async () => {
    const res = await fetch(`${baseUrl}/api/bots/miner_01/spawn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    expect(spawnerMock.spawn).toHaveBeenCalledWith({
      id: 'miner_01',
      position: { x: 0, y: 64, z: 0 },
      autoSpawn: true,
      persist: true,
      metadata: expect.objectContaining({
        spawnedBy: 'tester',
        spawnedVia: 'rest:spawn',
      }),
    });
    expect(ioMock.emit).toHaveBeenCalledWith('bot:spawned', expect.objectContaining({ botId: 'miner_01' }));
  });

  test('POST /api/bots/spawn-all emits bot:spawn_all', async () => {
    const res = await fetch(`${baseUrl}/api/bots/spawn-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    expect(spawnerMock.spawnAllKnown).toHaveBeenCalled();
    expect(ioMock.emit).toHaveBeenCalledWith('bot:spawn_all', expect.objectContaining({ count: 2 }));
  });
});
