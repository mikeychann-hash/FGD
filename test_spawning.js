// test_spawning.js
// Integration harness that exercises the Golden Path spawn endpoints

const API_BASE = process.env.FGD_API_URL || 'http://localhost:3000/api';
const API_KEY = process.env.FGD_API_KEY || process.env.API_KEY || '';

const fetchFn = global.fetch;
if (!fetchFn) {
  console.error('Global fetch is required (Node 18+).');
  process.exit(1);
}

async function api(path, options = {}) {
  const res = await fetchFn(`${API_BASE}${path}`, {
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
    throw new Error(message);
  }
  return data;
}

async function run() {
  if (!API_KEY) {
    console.error('Set FGD_API_KEY to run the spawn harness against a live server.');
    process.exit(1);
  }

  const suffix = Date.now();
  const bots = [
    { role: 'miner', name: `miner_${suffix}` },
    { role: 'builder', name: `builder_${suffix}` },
  ];

  console.log('Creating test bots via POST /api/bots (auto-spawn enabled)...');
  for (const bot of bots) {
    const created = await api('/bots', {
      method: 'POST',
      body: JSON.stringify({ role: bot.role, name: bot.name, autoSpawn: true }),
    });
    console.log(` - ${created.bot?.id || bot.name}: ${created.message}`);
  }

  console.log('Spawning first bot via POST /api/bots/:id/spawn (Golden Path)...');
  const spawnOne = await api(`/bots/${bots[0].name}/spawn`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  console.log(` - Spawn result: ${spawnOne.message}`);

  console.log('Triggering spawn-all via POST /api/bots/spawn-all...');
  const spawnAll = await api('/bots/spawn-all', { method: 'POST', body: JSON.stringify({}) });
  console.log(` - Spawn-all: ${spawnAll.message || `count=${spawnAll.count}`}`);

  console.log('Fetching bot status after spawns...');
  const status = await api('/bots');
  console.log(` - Active bots returned: ${status.count}`);

  console.log('Despawn test bots to clean up...');
  for (const bot of bots) {
    await api(`/bots/${bot.name}/despawn`, { method: 'POST', body: JSON.stringify({}) });
    console.log(` - Despawned ${bot.name}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error('Spawn harness failed:', err.message);
    process.exit(1);
  });
}
