// examples/spawn_npcs_demo.js
// Minimal Golden Path example using the REST spawn endpoints

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

async function runDemo() {
  if (!API_KEY) {
    console.error('Set FGD_API_KEY to run this demo.');
    process.exit(1);
  }

  console.log('Creating a miner bot (auto-spawn enabled)...');
  const created = await api('/bots', {
    method: 'POST',
    body: JSON.stringify({ role: 'miner', name: `demo_miner_${Date.now()}`, autoSpawn: true }),
  });
  console.log(created.message);

  console.log('Explicitly spawning the bot via POST /api/bots/:id/spawn...');
  const spawn = await api(`/bots/${created.bot.id}/spawn`, { method: 'POST', body: JSON.stringify({}) });
  console.log(spawn.message);

  console.log('Spawning all known bots via POST /api/bots/spawn-all...');
  const spawnAll = await api('/bots/spawn-all', { method: 'POST', body: JSON.stringify({}) });
  console.log(spawnAll.message || `Spawned ${spawnAll.count} bots`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch((err) => {
    console.error('Demo failed:', err.message);
    process.exit(1);
  });
}
