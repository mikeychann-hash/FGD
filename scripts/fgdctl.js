#!/usr/bin/env node
// scripts/fgdctl.js
// CLI wrapper that routes ALL terminal spawns through the REST Golden Path

const API_BASE = process.env.FGD_API_BASE || "http://localhost:3000";
const API_KEY = process.env.FGD_API_KEY || process.env.API_KEY || "";

const COLORS = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function help() {
  console.log(`
fgdctl - Unified REST spawn CLI

Usage:
  fgdctl spawn <botId>        POST /api/bots/<id>/spawn
  fgdctl spawn-all            POST /api/bots/spawn-all
  fgdctl status               GET  /api/health
  fgdctl bots                 GET  /api/bots
  fgdctl action <type> --bot <id> [--block iron_ore] [--pos x y z]

Environment:
  FGD_API_BASE   API base URL (default http://localhost:3000)
  FGD_API_KEY    API key for X-API-Key header
`);
}

function requireApiKey() {
  if (!API_KEY) {
    console.error(COLORS.red("Error: FGD_API_KEY is required for authenticated calls."));
    process.exit(1);
  }
}

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
      ...(options.headers || {}),
    },
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const msg = data.message || data.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function isHealthHealthy(payload) {
  if (!payload) return false;
  const components = payload.components || {};
  const bridgeState = payload.details?.bridge?.minecraft;

  const requiredHealthy = ["npcRegistry", "npcSpawner", "learningEngine"];
  const allHealthy = requiredHealthy.every((k) => components[k] && components[k] !== "disconnected" && components[k] !== "error");

  // Require minecraft bridge to be healthy/ok
  const bridgeOk = bridgeState === "ok";

  return allHealthy && bridgeOk;
}

async function assertHealth() {
  const health = await api("/api/health");
  if (!isHealthHealthy(health)) {
    console.error(COLORS.red("Refusing spawn: backend or plugin is unhealthy."));
    console.error(JSON.stringify(health.details || health.components || {}, null, 2));
    process.exit(1);
  }
  return health;
}

async function cmdStatus() {
  const health = await api("/api/health");
  console.log(COLORS.cyan("Health:"));
  console.log(JSON.stringify(health, null, 2));
}

async function cmdBots() {
  requireApiKey();
  const bots = await api("/api/bots");
  console.log(COLORS.cyan("Bots:"));
  console.log(JSON.stringify(bots, null, 2));
}

async function cmdSpawn(botId) {
  if (!botId) {
    console.error(COLORS.red("spawn requires <botId>"));
    help();
    process.exit(1);
  }
  requireApiKey();
  await assertHealth();
  const result = await api(`/api/bots/${botId}/spawn`, { method: "POST", body: JSON.stringify({}) });
  console.log(COLORS.green(`Spawn request accepted for ${botId}`));
  console.log(JSON.stringify(result, null, 2));
}

async function cmdSpawnAll() {
  requireApiKey();
  await assertHealth();
  const result = await api(`/api/bots/spawn-all`, { method: "POST", body: JSON.stringify({}) });
  console.log(COLORS.green(`Spawn-all request accepted`));
  console.log(JSON.stringify(result, null, 2));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--bot") out.bot = argv[++i];
    else if (a === "--block") out.block = argv[++i];
    else if (a === "--pos") {
      const x = Number(argv[++i]);
      const y = Number(argv[++i]);
      const z = Number(argv[++i]);
      out.position = { x, y, z };
    } else if (!out.type) {
      out.type = a;
    }
  }
  return out;
}

async function cmdAction(argv) {
  const parsed = parseArgs(argv);
  if (!parsed.type || !parsed.bot) {
    console.error(COLORS.red("action requires <type> --bot <id>"));
    help();
    process.exit(1);
  }
  requireApiKey();
  await assertHealth();
  const body = { botId: parsed.bot, type: parsed.type };
  if (parsed.block) body.block = parsed.block;
  if (parsed.position) body.position = parsed.position;
  const result = await api(`/api/action`, { method: "POST", body: JSON.stringify(body) });
  console.log(COLORS.green(`Action dispatched: ${parsed.type} for ${parsed.bot}`));
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const [cmd, arg, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    help();
    process.exit(0);
  }

  try {
    switch (cmd) {
      case "status":
        await cmdStatus();
        break;
      case "bots":
        await cmdBots();
        break;
      case "spawn":
        await cmdSpawn(arg);
        break;
      case "spawn-all":
        await cmdSpawnAll();
        break;
      case "action":
        await cmdAction([arg, ...rest]);
        break;
      default:
        console.error(COLORS.red(`Unknown command: ${cmd}`));
        help();
        process.exit(1);
    }
  } catch (err) {
    console.error(COLORS.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

main();
