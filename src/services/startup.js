import { logger } from "../../logger.js";

const STARTUP_SEQUENCE = ["telemetry", "database", "npc_engine", "minecraft_bridge"];

function recordStep(results, name, status, details = null) {
  results.push({ name, status, details, timestamp: new Date().toISOString() });
  const logMethod = status === "error" ? "error" : status === "warn" ? "warn" : "info";
  logger[logMethod]?.(`Startup step ${name} => ${status}`, details ? { details } : {});
}

export async function runStartupValidation({
  stateManager,
  npcSystem,
  initializeDatabase,
  initializeNpcSystem
}) {
  if (!stateManager || !npcSystem) {
    throw new Error("Startup validation requires stateManager and npcSystem");
  }

  const results = [];

  // Telemetry validation (already started prior to invocation)
  try {
    const metrics = stateManager.getState()?.metrics || {};
    const telemetryHealthy = typeof metrics === "object";
    recordStep(results, "telemetry", telemetryHealthy ? "pass" : "warn", telemetryHealthy ? null : "Metrics snapshot unavailable");
  } catch (err) {
    recordStep(results, "telemetry", "error", err.message);
    throw err;
  }

  // Database initialization
  if (typeof initializeDatabase === "function") {
    try {
      await initializeDatabase();
      recordStep(results, "database", "pass");
    } catch (err) {
      recordStep(results, "database", "error", err.message);
      throw err;
    }
  } else {
    recordStep(results, "database", "warn", "initializeDatabase not provided");
  }

  // NPC engine initialization (includes bridge wiring)
  if (typeof initializeNpcSystem !== "function") {
    throw new Error("initializeNpcSystem callback is required");
  }

  try {
    await initializeNpcSystem();
    recordStep(results, "npc_engine", "pass");
  } catch (err) {
    recordStep(results, "npc_engine", "error", err.message);
    throw err;
  }

  // Bridge validation
  if (npcSystem.minecraftBridge) {
    try {
      const bridge = npcSystem.minecraftBridge;
      const connected = typeof bridge.isConnected === "function" ? bridge.isConnected() : false;
      if (!connected && typeof bridge.ensureConnected === "function") {
        await bridge.ensureConnected();
      }
      recordStep(results, "minecraft_bridge", bridge.isConnected() ? "pass" : "warn", bridge.isConnected() ? null : "Bridge configured but not connected");
    } catch (err) {
      recordStep(results, "minecraft_bridge", "warn", err.message);
    }
  } else {
    recordStep(results, "minecraft_bridge", "warn", "Bridge not configured");
  }

  logger.info("Startup validation completed", { sequence: STARTUP_SEQUENCE, results });
  return results;
}

export default { runStartupValidation };
