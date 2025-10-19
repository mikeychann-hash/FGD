// autonomic/policy_engine.js
// Manages adaptive policies for resource governance

import fs from "fs/promises";
import fsSync from "fs";

const DEFAULT_STATE = {
  learningRate: 1.0,
  delegationBias: 0.4,
  cooldown: 10000,
  lastAdjustment: null,
  adjustmentHistory: []
};

const BOUNDS = {
  learningRate: { min: 0.1, max: 2.0 },
  delegationBias: { min: 0.1, max: 0.9 },
  cooldown: { min: 5000, max: 60000 }
};

const THRESHOLDS = {
  CRITICAL: 0.95,
  HIGH: 0.85,
  MEDIUM: 0.70,
  LOW: 0.50
};

export class PolicyEngine {
  constructor(path = "./data/policy_state.json") {
    this.path = path;
    this.state = { ...DEFAULT_STATE };
    this.saveQueue = null;
    this.lastActionTime = new Map();
    this.load();
  }

  load() {
    try {
      if (fsSync.existsSync(this.path)) {
        const data = fsSync.readFileSync(this.path, "utf-8");
        this.state = { ...DEFAULT_STATE, ...JSON.parse(data) };
        console.log("📋 Policy state loaded successfully");
      } else {
        console.log("📝 Starting with default policy state");
      }
    } catch (err) {
      console.error("❌ Error loading policy state:", err.message);
      this.state = { ...DEFAULT_STATE };
    }
  }

  evaluate(metrics) {
    if (!this.validateMetrics(metrics)) {
      console.warn("⚠️  Invalid metrics provided to policy engine");
      return [];
    }

    const actions = [];
    const now = Date.now();

    // Critical CPU load
    if (metrics.cpu >= THRESHOLDS.CRITICAL) {
      actions.push({
        type: "adjust_policy",
        priority: "critical",
        description: "Critical CPU load - emergency reduction",
        payload: {
          delegationBias: this.clamp(
            this.state.delegationBias - 0.2,
            BOUNDS.delegationBias
          ),
          learningRate: this.clamp(
            this.state.learningRate - 0.3,
            BOUNDS.learningRate
          )
        }
      });
    }
    // High CPU load
    else if (metrics.cpu >= THRESHOLDS.HIGH) {
      actions.push({
        type: "adjust_policy",
        priority: "high",
        description: "CPU load high - reducing delegation bias",
        payload: {
          delegationBias: this.clamp(
            this.state.delegationBias - 0.1,
            BOUNDS.delegationBias
          )
        }
      });
    }

    // Critical memory usage
    if (metrics.mem >= THRESHOLDS.CRITICAL) {
      actions.push({
        type: "adjust_policy",
        priority: "critical",
        description: "Critical memory usage - emergency cooldown increase",
        payload: {
          cooldown: this.clamp(
            this.state.cooldown + 15000,
            BOUNDS.cooldown
          )
        }
      });
    }
    // High memory usage
    else if (metrics.mem >= THRESHOLDS.HIGH) {
      actions.push({
        type: "adjust_policy",
        priority: "high",
        description: "Memory usage high - increasing cooldown",
        payload: {
          cooldown: this.clamp(
            this.state.cooldown + 5000,
            BOUNDS.cooldown
          )
        }
      });
    }

    // Node rebalancing for distributed load
    if (metrics.nodes && metrics.nodes.length > 1) {
      const overloadedNodes = metrics.nodes.filter(
        n => n.load > THRESHOLDS.HIGH
      );
      if (overloadedNodes.length > 0) {
        actions.push({
          type: "rebalance_node",
          priority: "medium",
          description: `Rebalancing ${overloadedNodes.length} overloaded node(s)`,
          payload: { nodes: overloadedNodes }
        });
      }
    }

    // Filter out actions that are in cooldown
    return actions.filter(action => this.canExecuteAction(action.type, now));
  }

  validateMetrics(metrics) {
    if (!metrics || typeof metrics !== "object") return false;
    if (typeof metrics.cpu !== "number" || metrics.cpu < 0) return false;
    if (typeof metrics.mem !== "number" || metrics.mem < 0) return false;
    return true;
  }

  clamp(value, bounds) {
    return Math.max(bounds.min, Math.min(bounds.max, value));
  }

  canExecuteAction(actionType, now = Date.now()) {
    const lastTime = this.lastActionTime.get(actionType);
    if (!lastTime) return true;

    const cooldowns = {
      adjust_policy: 30000,
      rebalance_node: 60000,
      scale_down: 45000
    };

    const cooldown = cooldowns[actionType] || 10000;
    return now - lastTime >= cooldown;
  }

  updatePolicy(patch) {
    if (!patch || typeof patch !== "object") {
      console.warn("⚠️  Invalid policy patch provided");
      return false;
    }

    // Validate and clamp all values
    const validatedPatch = {};
    for (const [key, value] of Object.entries(patch)) {
      if (BOUNDS[key]) {
        validatedPatch[key] = this.clamp(value, BOUNDS[key]);
      } else {
        validatedPatch[key] = value;
      }
    }

    // Record the adjustment
    const adjustment = {
      timestamp: new Date().toISOString(),
      changes: validatedPatch,
      previousState: { ...this.state }
    };

    Object.assign(this.state, validatedPatch);
    this.state.lastAdjustment = adjustment.timestamp;
    
    if (!this.state.adjustmentHistory) {
      this.state.adjustmentHistory = [];
    }
    this.state.adjustmentHistory.push(adjustment);

    // Keep only last 100 adjustments
    if (this.state.adjustmentHistory.length > 100) {
      this.state.adjustmentHistory = this.state.adjustmentHistory.slice(-100);
    }

    this.save();
    console.log("✅ Policy updated:", validatedPatch);
    return true;
  }

  recordAction(actionType) {
    this.lastActionTime.set(actionType, Date.now());
  }

  getState() {
    return { ...this.state };
  }

  async save() {
    // Debounce saves to prevent excessive I/O
    if (this.saveQueue) {
      clearTimeout(this.saveQueue);
    }

    this.saveQueue = setTimeout(async () => {
      try {
        await fs.mkdir("./data", { recursive: true });
        await fs.writeFile(
          this.path,
          JSON.stringify(this.state, null, 2),
          "utf-8"
        );
        console.log("💾 Policy state saved successfully");
      } catch (err) {
        console.error("❌ Error saving policy state:", err.message);
      }
    }, 500);
  }

  reset() {
    this.state = { ...DEFAULT_STATE };
    this.lastActionTime.clear();
    this.save();
    console.log("🔄 Policy state reset to defaults");
  }
}