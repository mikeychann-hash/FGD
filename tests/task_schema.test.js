import test from "node:test";
import assert from "node:assert/strict";

import { validateTask } from "../task_schema.js";

const baseTarget = { x: 1, y: 64, z: 1 };

test("support tasks require assistance details", () => {
  const good = validateTask({
    action: "support",
    details: "Assist miner under attack",
    target: baseTarget,
    metadata: {
      targetNpc: "miner_1",
      hazard: "lava",
      assistance: ["combat_cover"],
      level: "high",
      priority: "high",
      requests: {
        items: [{ item: "minecraft:water_bucket", count: 1 }]
      }
    }
  });

  assert.equal(good.valid, true, good.errors.join(", "));

  const missingAssistance = validateTask({
    action: "support",
    details: "Assist miner",
    target: baseTarget,
    metadata: {
      targetNpc: "miner_1"
    }
  });

  assert.equal(missingAssistance.valid, false);
  assert.ok(
    missingAssistance.errors.some(error =>
      error.includes("must include assistance")
    )
  );
});

test("deliver_items tasks validate items and actions", () => {
  const good = validateTask({
    action: "deliver_items",
    details: "Deliver backup pickaxe",
    target: baseTarget,
    metadata: {
      targetNpc: "miner_1",
      items: [{ item: "minecraft:diamond_pickaxe", count: 1 }],
      actions: ["deliver"],
      priority: "high"
    }
  });

  assert.equal(good.valid, true, good.errors.join(", "));

  const missingItems = validateTask({
    action: "deliver_items",
    details: "Bring nothing",
    target: baseTarget,
    metadata: {
      targetNpc: "miner_1",
      actions: ["deliver"]
    }
  });

  assert.equal(missingItems.valid, false);
  assert.ok(
    missingItems.errors.some(error =>
      error.includes("items must be a non-empty array")
    )
  );
});
