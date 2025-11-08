import test from "node:test";
import assert from "node:assert/strict";
import { MinecraftBridge } from "../minecraft_bridge.js";

test("sendCommand sanitizes input", async () => {
  const bridge = new MinecraftBridge({});
  bridge.connected = true;
  bridge.rcon = {
    sent: null,
    async send(command) {
      this.sent = command;
      return "ok";
    }
  };

  const result = await bridge.sendCommand("say hello");
  assert.equal(result, "ok");
  assert.equal(bridge.rcon.sent, "say hello");

  await assert.rejects(() => bridge.sendCommand("say hello; rm -rf /"));
});

test("recordHeartbeat updates timestamp", () => {
  const bridge = new MinecraftBridge({});
  assert.equal(bridge.getHeartbeatAgeSeconds(), null);
  bridge.recordHeartbeat();
  const age = bridge.getHeartbeatAgeSeconds();
  assert.ok(age !== null && age >= 0);
});
