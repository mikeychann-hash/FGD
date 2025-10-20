import test from "node:test";
import assert from "node:assert/strict";
import EventEmitter from "events";

import { NPCEngine } from "../npc_engine.js";

class StubBridge extends EventEmitter {
  async dispatchTask(taskPayload) {
    this.emit("dispatched", taskPayload);
    return { command: null, response: null, envelope: null, runtime: null };
  }

  isConnected() {
    return true;
  }
}

const MINING_TASK = {
  action: "mine",
  details: "Mine safe iron",
  target: { x: 0, y: 64, z: 0 },
  metadata: {
    resource: "minecraft:iron_ore",
    targets: [{ block: "minecraft:iron_ore", priority: "primary", quantity: 3 }],
    hazards: [{ type: "lava", severity: "high", mitigation: ["place blocks"] }],
    tools: [{ item: "minecraft:diamond_pickaxe", count: 1 }],
    mitigations: ["carry water bucket"],
    statusDirectives: {
      hazards: [{ type: "lava", action: "pause" }]
    }
  }
};

test("support requests assign support tasks to idle allies", async () => {
  const bridge = new StubBridge();
  const engine = new NPCEngine({ bridge });

  engine.registerNPC("miner", "miner");
  engine.registerNPC("guard", "fighter");

  engine.assignTask(engine.npcs.get("miner"), { ...MINING_TASK });

  engine.handleHazardEvent(engine.npcs.get("miner"), {
    type: "hazard_detected",
    npcId: "miner",
    hazard: "lava",
    severity: "high",
    reason: "Lava pool ahead",
    directive: {
      action: "request_support",
      request: {
        items: [{ item: "minecraft:water_bucket", count: 1 }]
      }
    }
  });

  const guard = engine.npcs.get("guard");
  assert.equal(guard.state, "working");
  assert.ok(guard.task);
  assert.equal(guard.task.action, "support");
  assert.equal(guard.task.metadata.targetNpc, "miner");
  assert.deepEqual(guard.task.metadata.requests.items[0], {
    item: "minecraft:water_bucket",
    count: 1
  });
});

test("tool requests create delivery tasks", async () => {
  const bridge = new StubBridge();
  const engine = new NPCEngine({ bridge });

  engine.registerNPC("miner", "miner");
  engine.registerNPC("runner", "runner");

  engine.assignTask(engine.npcs.get("miner"), { ...MINING_TASK });

  engine.handleToolRequest(engine.npcs.get("miner"), {
    npcId: "miner",
    request: {
      items: [{ item: "minecraft:diamond_pickaxe", count: 1 }]
    },
    reason: "Replace broken pickaxe"
  });

  const runner = engine.npcs.get("runner");
  assert.equal(runner.state, "working");
  assert.ok(runner.task);
  assert.equal(runner.task.action, "deliver_items");
  assert.equal(runner.task.metadata.items[0].item, "minecraft:diamond_pickaxe");
});
