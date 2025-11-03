// test/npc_microcore.test.js
// Placeholder test suite for the NPC microcore runtime.
// TODO: integrate with chosen test runner (Jest, Vitest, etc.)
// and assert tick-based behaviors once infrastructure is ready.

import { NPCMicrocore, startLoop, stopLoop } from "../core/npc_microcore.js";

if (typeof describe === "function") {
  describe("NPCMicrocore", () => {
    it("initializes with default state", () => {
      const bot = { id: "test_bot", runtime: { position: { x: 0, y: 64, z: 0 } } };
      const microcore = new NPCMicrocore(bot, { bridge: null, tickRateMs: 250 });
      expect(microcore).toBeDefined();
      stopLoop(bot.id);
    });

    it("supports startLoop helper", () => {
      const bot = { id: "loop_bot", runtime: { position: { x: 0, y: 64, z: 0 } } };
      const loop = startLoop(bot, { bridge: null, tickRateMs: 500 });
      expect(loop).toBeInstanceOf(NPCMicrocore);
      stopLoop(bot.id);
    });
  });
} else {
  console.warn("NPC microcore tests are placeholders; integrate with a test runner to execute them.");
}
