import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import { MindcraftCEClient } from "../mindcraft_ce_client.js";
import { MindcraftCERuntime } from "../mindcraft_ce_runtime.js";

test("Mindcraft CE client relays runtime events with npc context", async () => {
  const runtime = new MindcraftCERuntime({ eventDelay: 5, minimumDelay: 5 });
  const client = new MindcraftCEClient({ runtimeFallback: runtime, autoConnect: false });

  const envelope = {
    id: "miner:demo",
    npc: "miner",
    action: "mine",
    target: { x: 0, y: 64, z: 0 },
    metadata: {
      watchers: [
        {
          hazard: "lava",
          severity: "high",
          response: { action: "pause" }
        }
      ]
    },
    issuedAt: Date.now()
  };

  client.observeEnvelope(envelope);

  const planPromise = once(client, "plan");
  const eventPromise = once(client, "event");

  await client.simulateEnvelope(envelope);

  const [plan] = await planPromise;
  assert.equal(plan.npcId, "miner");

  const [event] = await eventPromise;
  assert.equal(event.npcId, "miner");
  assert.equal(event.type, "hazard_detected");
  assert.equal(event.envelopeId, envelope.id);

  client.close();
});
