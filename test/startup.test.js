import test from "node:test";
import assert from "node:assert/strict";
import { runStartupValidation } from "../src/services/startup.js";

function createStateManager() {
  return {
    metricsUpdated: false,
    getState() {
      return { metrics: { cpu: 0, memory: 0 } };
    }
  };
}

test("runStartupValidation enforces startup ordering", async () => {
  const order = [];
  const stateManager = createStateManager();
  const npcSystem = {
    minecraftBridge: { isConnected: () => true },
    initialize: () => { order.push("npcSystem.initialize"); }
  };

  const results = await runStartupValidation({
    stateManager,
    npcSystem,
    initializeDatabase: async () => { order.push("database"); },
    initializeNpcSystem: async () => { order.push("npcEngine"); }
  });

  assert.equal(results.length, 4);
  assert.deepEqual(order, ["database", "npcEngine"]);
  assert.ok(results.every(step => ["pass", "warn"].includes(step.status)));
});
