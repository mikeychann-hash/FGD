// autonomic/policy_engine.js
// Manages adaptive policies for resource governance

import fs from "fs/promises";
import fsSync from "fs";

const DEFAULT_STATE = {
  learningRate: 1.0,
  delegationBias: 0.4,
  cooldown: 10000,
  lastAdjustment: null,
  adjustmentHistory: [],
  dynamicThresholds: {
    CRITICAL: 0.95,
    HIGH: 0.85,
    MEDIUM: 0.7,
    LOW: 0.5
  },
  recommendedScanInterval: null,
  thresholdHistory: []
};

const BOUNDS = {
  learningRate: { min: 0.1, max: 2.0 },
  delegationBias: { min: 0.1, max: 0.9 },
  cooldown: { min: 5000, max: 60000 }
};

const BASE_THRESHOLDS = {
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
    this.dynamicThresholds = { ...DEFAULT_STATE.dynamicThresholds };
    this.recommendations = { scanInterval: null };
    this.thresholdHistory = [];
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
      this.dynamicThresholds = {
        ...BASE_THRESHOLDS,
        ...(this.state.dynamicThresholds || {})
      };
      this.recommendations.scanInterval = this.state.recommendedScanInterval || null;
      this.thresholdHistory = Array.isArray(this.state.thresholdHistory)
        ? this.state.thresholdHistory
        : [];
    } catch (err) {
      console.error("❌ Error loading policy state:", err.message);
      this.state = { ...DEFAULT_STATE };
      this.dynamicThresholds = { ...BASE_THRESHOLDS };
      this.thresholdHistory = [];
      this.recommendations = { scanInterval: null };
    }
  }

  evaluate(metrics) {
    if (!this.validateMetrics(metrics)) {
      console.warn("⚠️  Invalid metrics provided to policy engine");
      return [];
    }

    const actions = [];
    const now = Date.now();
    const thresholds = this.getContextAwareThresholds(metrics?.context);
    const predictedCpu = metrics?.predicted?.cpu ?? metrics.cpu;
    const predictedMem = metrics?.predicted?.mem ?? metrics.mem;

    let hasRebalance = actions.some(action => action.type === "rebalance_node");
    if (!hasRebalance && predictedCpu >= thresholds.HIGH && (metrics.nodes || []).length > 0) {
      actions.push({
        type: "rebalance_node",
        priority: predictedCpu >= thresholds.CRITICAL ? "high" : "medium",
        description: "Forecasted CPU spike - preparing node rebalance",
        payload: {
          nodes: metrics.nodes
        }
      });
      hasRebalance = true;
    }

    // Critical CPU load
    if (metrics.cpu >= thresholds.CRITICAL) {
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
    else if (metrics.cpu >= thresholds.HIGH) {
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
    if (metrics.mem >= thresholds.CRITICAL || predictedMem >= thresholds.CRITICAL) {
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
    else if (metrics.mem >= thresholds.HIGH || predictedMem >= thresholds.HIGH) {
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
        n => n.load > thresholds.HIGH
      );
      if (overloadedNodes.length > 0 && !hasRebalance) {
        actions.push({
          type: "rebalance_node",
          priority: "medium",
          description: `Rebalancing ${overloadedNodes.length} overloaded node(s)`,
          payload: { nodes: overloadedNodes }
        });
        hasRebalance = true;
      }
    }

    // Filter out actions that are in cooldown
    const executable = actions.filter(action => this.canExecuteAction(action.type, now));
    if (executable.length === 0 && predictedCpu >= thresholds.CRITICAL) {
      executable.push({
        type: "scale_down",
        priority: "high",
        description: "Forecasted critical CPU load - scaling down non-critical tasks",
        payload: { reason: "forecast" }
      });
    }

    this.recordThresholdSnapshot();
    return executable;
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

  clampNormalized(value) {
    return Math.max(0, Math.min(1, value));
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
    return {
      ...this.state,
      dynamicThresholds: { ...this.dynamicThresholds },
      recommendedScanInterval: this.recommendations.scanInterval,
      thresholdHistory: [...this.thresholdHistory]
    };
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
          JSON.stringify(
            {
              ...this.state,
              dynamicThresholds: { ...this.dynamicThresholds },
              recommendedScanInterval: this.recommendations.scanInterval,
              thresholdHistory: this.thresholdHistory
            },
            null,
            2
          ),
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
    this.dynamicThresholds = { ...BASE_THRESHOLDS };
    this.recommendations = { scanInterval: null };
    this.thresholdHistory = [];
    this.save();
    console.log("🔄 Policy state reset to defaults");
  }

  ingestMetricsHistory(history, context = {}) {
    if (!Array.isArray(history) || history.length < 2) return;

    const window = history.slice(-Math.min(history.length, 20));
    const cpuValues = window.map(sample => sample.cpu).filter(v => typeof v === "number");
    const memValues = window.map(sample => sample.mem).filter(v => typeof v === "number");

    if (cpuValues.length === 0 || memValues.length === 0) return;

    const cpuAvg = cpuValues.reduce((sum, value) => sum + value, 0) / cpuValues.length;
    const cpuMax = Math.max(...cpuValues);
    const memMax = Math.max(...memValues);

    const smoothing = 0.25;
    const mediumTarget = this.clampNormalized(cpuAvg + 0.05);
    const highTarget = this.clampNormalized(Math.max(mediumTarget + 0.05, Math.max(cpuAvg + 0.1, memMax)));
    const criticalTarget = this.clampNormalized(Math.max(highTarget + 0.05, Math.max(cpuMax, memMax)));
    const lowTarget = this.clampNormalized(Math.min(mediumTarget - 0.15, 0.55));

    this.dynamicThresholds = {
      CRITICAL: this.interpolate(this.dynamicThresholds.CRITICAL, criticalTarget, smoothing),
      HIGH: this.interpolate(this.dynamicThresholds.HIGH, highTarget, smoothing),
      MEDIUM: this.interpolate(this.dynamicThresholds.MEDIUM, mediumTarget, smoothing),
      LOW: this.interpolate(this.dynamicThresholds.LOW, lowTarget, smoothing)
    };

    if (memMax > this.dynamicThresholds.CRITICAL) {
      this.dynamicThresholds.CRITICAL = this.interpolate(
        this.dynamicThresholds.CRITICAL,
        this.clampNormalized(memMax),
        smoothing
      );
    }

    this.state.dynamicThresholds = { ...this.dynamicThresholds };

    const activityBonus = context.minersActive ? 0.03 : 0;
    const idlePenalty = (context.activeTaskCount || 0) === 0 ? -0.03 : 0;
    const adjustment = activityBonus + idlePenalty;
    if (adjustment !== 0) {
      for (const key of Object.keys(this.dynamicThresholds)) {
        this.dynamicThresholds[key] = this.clampNormalized(
          this.dynamicThresholds[key] + adjustment * (key === "CRITICAL" ? 1 : key === "HIGH" ? 0.8 : key === "MEDIUM" ? 0.5 : 0.3)
        );
      }
    }

    this.dynamicThresholds.HIGH = Math.min(
      this.dynamicThresholds.HIGH,
      this.dynamicThresholds.CRITICAL - 0.02
    );
    this.dynamicThresholds.MEDIUM = Math.min(
      this.dynamicThresholds.MEDIUM,
      this.dynamicThresholds.HIGH - 0.05
    );
    this.dynamicThresholds.LOW = Math.min(
      this.dynamicThresholds.LOW,
      this.dynamicThresholds.MEDIUM - 0.1
    );
    this.dynamicThresholds.CRITICAL = Math.max(this.dynamicThresholds.CRITICAL, 0.8);
    this.dynamicThresholds.HIGH = Math.max(this.dynamicThresholds.HIGH, 0.6);
    this.dynamicThresholds.MEDIUM = Math.max(this.dynamicThresholds.MEDIUM, 0.45);
    this.dynamicThresholds.LOW = Math.max(this.dynamicThresholds.LOW, 0.1);

    this.state.dynamicThresholds = { ...this.dynamicThresholds };
  }

  ingestFusionStats(stats) {
    if (!stats || typeof stats !== "object") return;

    let recommended = this.recommendations.scanInterval || this.state.cooldown;
    if (typeof stats.averageInterval === "number" && stats.averageInterval > 0) {
      recommended = Math.max(4000, Math.min(45000, stats.averageInterval / 4));
    } else if (typeof stats.mergesPerHour === "number") {
      recommended = stats.mergesPerHour > 5 ? 6000 : 12000;
    }

    this.setRecommendedScanInterval(Math.round(recommended));
  }

  getContextAwareThresholds(context = {}) {
    const thresholds = { ...this.dynamicThresholds };
    const minersActive = Boolean(context.minersActive);
    const activeTaskCount = context.activeTaskCount ?? 0;
    const idle = activeTaskCount === 0 && !minersActive;

    const modifier = minersActive ? 0.04 : idle ? -0.04 : 0;

    if (modifier !== 0) {
      thresholds.CRITICAL = this.clampNormalized(thresholds.CRITICAL + modifier);
      thresholds.HIGH = this.clampNormalized(thresholds.HIGH + modifier * 0.8);
      thresholds.MEDIUM = this.clampNormalized(thresholds.MEDIUM + modifier * 0.5);
      thresholds.LOW = this.clampNormalized(thresholds.LOW + modifier * 0.3);
    }

    thresholds.HIGH = Math.min(thresholds.HIGH, thresholds.CRITICAL - 0.02);
    thresholds.MEDIUM = Math.min(thresholds.MEDIUM, thresholds.HIGH - 0.05);
    thresholds.LOW = Math.min(thresholds.LOW, thresholds.MEDIUM - 0.1);
    thresholds.LOW = Math.max(thresholds.LOW, 0.1);

    return thresholds;
  }

  interpolate(current, target, factor) {
    return current + (target - current) * factor;
  }

  setRecommendedScanInterval(value) {
    if (!value || Number.isNaN(value)) return;
    this.recommendations.scanInterval = Math.max(3000, Math.min(60000, value));
    this.state.recommendedScanInterval = this.recommendations.scanInterval;
  }

  getRecommendations() {
    return { ...this.recommendations };
  }

  recordThresholdSnapshot() {
    const snapshot = {
      timestamp: new Date().toISOString(),
      ...this.dynamicThresholds
    };
    this.thresholdHistory.push(snapshot);
    if (this.thresholdHistory.length > 120) {
      this.thresholdHistory = this.thresholdHistory.slice(-120);
    }
    this.state.thresholdHistory = this.thresholdHistory;
  }
}