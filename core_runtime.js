// core_runtime.js
// Connects AICraft core systems (Bridge + NPC Engine + Autonomic Core)
// and provides unified access for Express and Socket.IO

import { MinecraftBridge } from "./minecraft_bridge.js";
import { NPCEngine } from "./npc_engine.js";
import { AutonomicCore } from "./autonomic_core.js";
import EventEmitter from "events";

export const runtimeEvents = new EventEmitter();

console.log("🔧 Initializing AICraft Federation runtime...");

// --- Initialize Minecraft Bridge ---
export const bridge = new MinecraftBridge({
  host: "127.0.0.1",
  port: 25575,
  password: "mikelind",
  connectOnCreate: true,
  enableUpdateServer: false,
  commandPrefix: "aicraft",
  maxCommandsPerSecond: 5
});

bridge.on("connected", () => console.log("🟢 Bridge connected to Minecraft server"));
bridge.on("error", (err) => console.error("🔴 Bridge error:", err.message));

// --- Initialize NPC Engine ---
export const engine = new NPCEngine({
  bridge,
  autoSpawn: false,
  requireFeedback: false,
  logEvents: true
});

engine.on("botCreated", (bot) => runtimeEvents.emit("bot:created", { bot }));
engine.on("botSpawned", (bot) => runtimeEvents.emit("bot:spawned", { bot }));
engine.on("botDespawned", (bot) => runtimeEvents.emit("bot:despawned", { bot }));
engine.on("taskAssigned", (task) => runtimeEvents.emit("bot:task_assigned", { task }));

// --- Initialize Autonomic Core ---
export const autonomic = new AutonomicCore();
await autonomic.init();
autonomic.start();

runtimeEvents.emit("system:log", {
  level: "info",
  message: "Autonomic core started",
  time: new Date().toISOString()
});

// --- Unified Runtime API ---
export function getSystemStats() {
  const m = autonomic.getMetrics();
  return {
    uptime: m.uptime || 0,
    avgCpu: (m.cpu * 100).toFixed(1),
    avgMemory: (m.mem * 100).toFixed(1),
    totalNodes: 2,
    activeTasks: engine.npcs?.length || 0,
    dataProcessed: "Simulated"
  };
}

export function listBots() {
  if (!engine.npcs) return [];
  return Array.from(engine.npcs.values()).map((bot) => ({
    id: bot.id || bot.name,
    name: bot.name,
    role: bot.role || "unknown",
    description: bot.description || "",
    status: bot.status || "idle",
    spawnCount: bot.spawnCount || 0
  }));
}

export async function executeLLMCommand(command, origin = "admin") {
  try {
    console.log(`🧠 LLM Command received (${origin}): ${command}`);
    const result = await engine.handleCommand(command, origin);
    return { success: true, result };
  } catch (err) {
    console.error("❌ LLM command error:", err);
    return { success: false, error: err.message };
  }
}

// --- Export Everything ---
export default { bridge, engine, autonomic, runtimeEvents, getSystemStats, listBots, executeLLMCommand };
