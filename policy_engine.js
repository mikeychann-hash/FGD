// autonomic/policy_engine.js
// Manages adaptive policies for resource governance

import fs from "fs/promises";
import fsSync from "fs";
import { resolve, normalize } from "path";

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

const ACTION_COOLDOWNS = {
  adjust_policy: 30000,
  rebalance_node: 60000,
  scale_down: 45000,
  default: 10000
};

const MAX_ADJUSTMENT_HISTORY = 100;

/**
 * PolicyEngine manages adaptive policies for resource governance
 * @class PolicyEngine
 */
export class PolicyEngine {
  /**
   * Creates a new PolicyEngine instance
   * @param {string} path - Path to the policy state file
   * @param {object} logger - Optional logger interface with log/warn/error methods
   */
  constructor(path = "./data/policy_state.json", logger = console) {
    // Validate and sanitize path to prevent path traversal attacks
    const normalized = normalize(path);
    if (normalized.includes('..')) {
      throw new Error('Invalid path: path traversal detected');
    }
    this.path = resolve(normalized);

    this.state = { ...DEFAULT_STATE };
    this.saveQueue = null;
    this.lastActionTime = new Map();
    this.logger = logger;
    this.load();
  }

  /**
   * Loads policy state from disk
   * @private
   */
  load() {
    try {
      if (fsSync.existsSync(this.path)) {
        const data = fsSync.readFileSync(this.path, "utf-8");
        this.state = { ...DEFAULT_STATE, ...JSON.parse(data) };
        this.logger.log("Policy state loaded successfully");
      } else {
        this.logger.log("Starting with default policy state");
      }
    } catch (err) {
      this.logger.error("Error loading policy state:", err.message);
      this.state = { ...DEFAULT_STATE };
    }
  }

  /**
   * Evaluates system metrics and generates policy actions
   * @param {object} metrics - System metrics object with cpu, mem, and optional nodes array
   * @returns {Array} Array of action objects. Caller must call recordAction() after executing each action.
   */
  evaluate(metrics) {
    if (!this.validateMetrics(metrics)) {
      this.logger.warn("Invalid metrics provided to policy engine");
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

  /**
   * Validates that metrics object has required properties
   * @param {object} metrics - Metrics object to validate
   * @returns {boolean} True if metrics are valid
   * @private
   */
  validateMetrics(metrics) {
    if (!metrics || typeof metrics !== "object") return false;
    if (typeof metrics.cpu !== "number" || metrics.cpu < 0) return false;
    if (typeof metrics.mem !== "number" || metrics.mem < 0) return false;
    return true;
  }

  /**
   * Clamps a value between min and max bounds
   * @param {number} value - Value to clamp
   * @param {object} bounds - Object with min and max properties
   * @returns {number} Clamped value
   * @private
   */
  clamp(value, bounds) {
    return Math.max(bounds.min, Math.min(bounds.max, value));
  }

  /**
   * Checks if an action type can be executed based on cooldown period
   * @param {string} actionType - Type of action to check
   * @param {number} now - Current timestamp (defaults to Date.now())
   * @returns {boolean} True if action can be executed
   */
  canExecuteAction(actionType, now = Date.now()) {
    const lastTime = this.lastActionTime.get(actionType);
    if (!lastTime) return true;

    const cooldown = ACTION_COOLDOWNS[actionType] || ACTION_COOLDOWNS.default;
    return now - lastTime >= cooldown;
  }

  /**
   * Updates policy state with validated patch
   * @param {object} patch - Object containing policy values to update
   * @returns {boolean} True if update was successful
   */
  updatePolicy(patch) {
    if (!patch || typeof patch !== "object") {
      this.logger.warn("Invalid policy patch provided");
      return false;
    }

    // Validate and clamp all values
    const validatedPatch = {};
    for (const [key, value] of Object.entries(patch)) {
      if (BOUNDS[key]) {
        // Type validation: ensure value is a number before clamping
        if (typeof value !== 'number' || !isFinite(value)) {
          this.logger.warn(`Invalid value for ${key}: ${value} (must be a finite number)`);
          continue;
        }
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

    // Keep only last MAX_ADJUSTMENT_HISTORY adjustments (check before pushing)
    if (this.state.adjustmentHistory.length >= MAX_ADJUSTMENT_HISTORY) {
      this.state.adjustmentHistory = this.state.adjustmentHistory.slice(-(MAX_ADJUSTMENT_HISTORY - 1));
    }
    this.state.adjustmentHistory.push(adjustment);

    this.save();
    this.logger.log("Policy updated:", validatedPatch);
    return true;
  }

  /**
   * Records that an action was executed to enforce cooldown periods
   * @param {string} actionType - Type of action that was executed
   */
  recordAction(actionType) {
    this.lastActionTime.set(actionType, Date.now());
  }

  /**
   * Returns a deep copy of the current policy state
   * @returns {object} Deep copy of the policy state
   */
  getState() {
    // Deep clone to prevent external mutations of nested objects/arrays
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Saves policy state to disk with debouncing
   * @private
   */
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
        this.logger.log("Policy state saved successfully");
      } catch (err) {
        this.logger.error("Error saving policy state:", err.message);
      }
    }, 500);
  }

  /**
   * Resets policy state to defaults
   */
  reset() {
    // Clear any pending save to prevent race condition
    if (this.saveQueue) {
      clearTimeout(this.saveQueue);
      this.saveQueue = null;
    }

    this.state = { ...DEFAULT_STATE };
    this.lastActionTime.clear();
    this.save();
    this.logger.log("Policy state reset to defaults");
  }

  /**
   * Cleanup method to clear pending saves and resources
   * Call this before destroying the instance
   */
  destroy() {
    if (this.saveQueue) {
      clearTimeout(this.saveQueue);
      this.saveQueue = null;
    }
    this.lastActionTime.clear();
  }
}