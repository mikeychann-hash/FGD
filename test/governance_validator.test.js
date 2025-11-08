import test from "node:test";
import assert from "node:assert/strict";
import { validateGovernanceFairness } from "../security/governance_validator.js";

const validConfig = {
  thresholds: { low: 0.2, medium: 0.5, high: 0.8, critical: 0.95 },
  governanceActions: [
    { type: "adjust_policy", priority: "high", cooldown: 1000 },
    { type: "scale_down", priority: "medium", cooldown: 2000 }
  ],
  alerts: { levels: ["critical", "high"] }
};

test("validateGovernanceFairness passes for valid configuration", () => {
  const result = validateGovernanceFairness(validConfig);
  assert.equal(result.ok, true);
});

test("validateGovernanceFairness detects invalid thresholds", () => {
  const config = { ...validConfig, thresholds: { low: 0.5, medium: 0.4, high: 0.9, critical: 0.8 } };
  const result = validateGovernanceFairness(config);
  assert.equal(result.ok, false);
  assert.ok(result.issues.length > 0);
});
