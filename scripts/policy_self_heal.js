#!/usr/bin/env node
import path from "path";
import { fileURLToPath } from "url";
import { PolicyEngine } from "../policy_engine.js";
import { loadAndValidateGovernanceConfig } from "../security/governance_validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runScenario(engine, metrics) {
  const actions = engine.evaluate(metrics);
  return { metrics, actions };
}

async function main() {
  const engine = new PolicyEngine(path.join(__dirname, "../data/policy_state.test.json"));
  const scenarios = [
    { cpu: 0.96, mem: 0.82 },
    { cpu: 0.72, mem: 0.88 },
    { cpu: 0.40, mem: 0.35, nodes: [{ load: 0.9 }, { load: 0.4 }] }
  ];

  const outcomes = [];
  for (const metrics of scenarios) {
    outcomes.push(await runScenario(engine, metrics));
  }

  const fairness = await loadAndValidateGovernanceConfig();
  const failed = outcomes.some(outcome => outcome.actions.length === 0) || !fairness.ok;

  outcomes.forEach(outcome => {
    console.log("Scenario", outcome.metrics, "=>", outcome.actions.map(action => action.type));
  });

  if (fairness.issues?.length) {
    fairness.issues.forEach(issue => console.warn(`Governance issue: ${issue}`));
  }

  if (failed) {
    console.error("❌ Policy self-healing harness detected issues");
    process.exit(1);
  }

  console.log("✅ Policy self-healing harness passed");
}

main().catch(err => {
  console.error("❌ Policy self-healing harness failed:", err);
  process.exit(1);
});
