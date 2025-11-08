import test from "node:test";
import assert from "node:assert/strict";
import { registerPlanner as registerCorePlanner, executePlanner } from "../tasks/planner_core.js";
import { planTask } from "../tasks/index.js";

const fixturePath = new URL("./fixtures/worker_planner.js", import.meta.url).href;

registerCorePlanner("worker-test", () => {
  throw new Error("main-thread planner should not execute");
}, { modulePath: fixturePath, exportName: "workerPlanner", parallel: true });

test("worker planners execute via worker thread", () => {
  const plan = executePlanner({ action: "worker-test" }, {});
  assert.equal(plan.steps[0].description, "run in worker");
});

test("planTask applies personality bias metadata", () => {
  const task = { action: "worker-test" };
  const plan = planTask(task, { npc: { personalityTraits: ["Brave"] } });
  assert.ok(plan.personalityBias);
  assert.equal(plan.personalityBias.score, 1);
});
