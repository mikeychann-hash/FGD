#!/usr/bin/env node
// npc_cli.js
// API-first NPC management CLI that strictly follows the Golden Path REST endpoints

const API_BASE = process.env.FGD_API_URL || 'http://localhost:3000/api';
const API_KEY = process.env.FGD_API_KEY || process.env.API_KEY || '';

const fetchFn = global.fetch;
if (!fetchFn) {
  console.error('Global fetch is required (Node 18+).');
  process.exit(1);
}

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetchFn(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message || data?.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

function requireApiKey() {
  if (!API_KEY) {
    console.error('API key required. Set FGD_API_KEY or pass X-API-Key header in the environment.');
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
NPC Management CLI (Golden Path)

Commands:
  list                       List bots (fetched from /api/bots)
  create <role> [name]       Create and auto-spawn a bot
  spawn <id>                 Spawn bot via POST /api/bots/:id/spawn
  spawn-all                  Spawn all bots via POST /api/bots/spawn-all
  info <id>                  Get bot details
  despawn <id>               Despawn bot via POST /api/bots/:id/despawn
  help                       Show this help

Environment:
  FGD_API_URL   Base URL (default http://localhost:3000/api)
  FGD_API_KEY   API key for authenticated requests
`);
}

async function listBots() {
  requireApiKey();
  const { bots = [] } = await api('/bots');
  if (!bots.length) {
    console.log('No bots found.');
    return;
  }
  bots.forEach((bot) => {
    console.log(`${bot.id} | role=${bot.role} | state=${bot.state || bot.status} | pos=${JSON.stringify(bot.position || {})}`);
  });
}

async function createBot(role, name) {
  requireApiKey();
  if (!role) {
    console.error('Role is required.');
    process.exit(1);
  }

  const payload = {
    role,
    name: name || `${role}_${Date.now()}`,
    autoSpawn: true, // ensure Golden Path triggers spawn pipeline
  };

  const result = await api('/bots', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  console.log(`Created ${result.bot?.id || payload.name} (role=${role})`);
  if (result.spawned) {
    console.log('Spawn dispatched via /api/bots/:id/spawn');
  }
}

async function spawnBot_cli(id) {
  requireApiKey();
  if (!id) {
    console.error('Bot id is required.');
    process.exit(1);
  }
  const result = await api(`/bots/${id}/spawn`, { method: 'POST', body: JSON.stringify({}) });
  console.log(`Spawn request for ${id}: ${result.message || 'ok'}`);
}

async function spawnAll() {
  requireApiKey();
  const result = await api('/bots/spawn-all', { method: 'POST', body: JSON.stringify({}) });
  console.log(`Spawn-all: ${result.message || `spawned ${result.count} bots`}`);
}

async function info(id) {
  requireApiKey();
  if (!id) {
    console.error('Bot id is required.');
    process.exit(1);
  }
  const result = await api(`/bots/${id}`);
  console.log(JSON.stringify(result.bot || result, null, 2));
}

async function despawn(id) {
  requireApiKey();
  if (!id) {
    console.error('Bot id is required.');
    process.exit(1);
  }
  const result = await api(`/bots/${id}/despawn`, { method: 'POST', body: JSON.stringify({}) });
  console.log(result.message || `Despawned ${id}`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  try {
    switch (command) {
      case 'list':
        await listBots();
        break;
      case 'create':
        await createBot(rest[0], rest[1]);
        break;
      case 'spawn':
        await spawnBot_cli(rest[0]);
        break;
      case 'spawn-all':
        await spawnAll();
        break;
      case 'info':
        await info(rest[0]);
        break;
      case 'despawn':
        await despawn(rest[0]);
        break;
      case 'help':
      case undefined:
        printHelp();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as runCLI };
