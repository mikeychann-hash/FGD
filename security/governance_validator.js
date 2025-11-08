import fs from "fs/promises";
import path from "path";
import { ROOT_DIR } from "../src/config/constants.js";
import { logger } from "../logger.js";

export function validateGovernanceFairness(config) {
  const issues = [];
  if (!config || typeof config !== "object") {
    return { ok: false, issues: ["Configuration missing or invalid"] };
  }

  const thresholds = config.thresholds || {};
  if (!(thresholds.low < thresholds.medium && thresholds.medium < thresholds.high && thresholds.high < thresholds.critical)) {
    issues.push("Thresholds must be strictly increasing (low < medium < high < critical)");
  }

  const priorities = new Set(["low", "medium", "high", "critical"]);
  for (const action of config.governanceActions || []) {
    if (!priorities.has(action.priority)) {
      issues.push(`Unknown priority level for action ${action.type}`);
    }
    if (typeof action.cooldown !== "number" || action.cooldown <= 0) {
      issues.push(`Cooldown must be positive for action ${action.type}`);
    }
  }

  if (Array.isArray(config.alerts?.levels)) {
    const invalidLevels = config.alerts.levels.filter(level => !priorities.has(level));
    if (invalidLevels.length > 0) {
      issues.push(`Alerts configured with invalid levels: ${invalidLevels.join(", ")}`);
    }
  }

  return { ok: issues.length === 0, issues };
}

export async function loadAndValidateGovernanceConfig(configPath = path.join(ROOT_DIR, "governance_config.json")) {
  try {
    const file = await fs.readFile(configPath, "utf8");
    const config = JSON.parse(file);
    const result = validateGovernanceFairness(config);
    if (!result.ok) {
      result.issues.forEach(issue => logger.warn(`Governance fairness validation: ${issue}`));
    } else {
      logger.info("Governance fairness checks passed");
    }
    return result;
  } catch (err) {
    logger.error("Failed to validate governance config", { error: err.message });
    return { ok: false, issues: [err.message] };
  }
}

export default {
  validateGovernanceFairness,
  loadAndValidateGovernanceConfig
};
