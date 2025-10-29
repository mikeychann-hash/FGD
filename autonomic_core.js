// autonomic/autonomic_core.js
// Self-monitoring and self-healing system for AICraft infrastructure

import os from "os";
import { PolicyEngine } from "./policy_engine.js";
import fs from "fs/promises";

// Constants
const DEFAULT_CONFIG = {
  scanInterval: 10000,
  cpuThreshold: 0.85,
  memThreshold: 0.85,
  diskThreshold: 0.90,
  enabled: true
};

const MAX_HISTORY_SIZE = 100;
const MAX_CONSECUTIVE_FAILURES = 5;
const STATUS_INTERVAL_MS = 30000;
const MIN_SCAN_INTERVAL_MS = 1000;
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * AutonomicCore - Self-monitoring and self-healing system
 * Monitors system metrics and enforces governance policies
 */
export class AutonomicCore {
  constructor(configPath = "./autonomic/governance_config.json") {
    this.configPath = configPath;
    this.policy = new PolicyEngine();
    this.config = { ...DEFAULT_CONFIG };
    this.metrics = {
      cpu: 0,
      mem: 0,
      uptime: 0,
      nodes: [],
      timestamp: null
    };
    this.monitoringInterval = null;
    this.statusInterval = null;
    this.isRunning = false;
    this.isInitialized = false;
    this.metricsHistory = [];
    this.consecutiveFailures = 0;
  }

  /**
   * Initialize the autonomic core by loading configuration
   * Must be called before start()
   * @returns {Promise<AutonomicCore>} this instance for chaining
   */
  async init() {
    if (this.isInitialized) {
      console.warn("⚠️  Autonomic core already initialized");
      return this;
    }

    await this.loadConfig();
    this.isInitialized = true;
    return this;
  }

  /**
   * Load configuration from file asynchronously
   * Falls back to default config on error
   * @returns {Promise<void>}
   */
  async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      const loadedConfig = JSON.parse(data);
      this.config = { ...DEFAULT_CONFIG, ...loadedConfig };
      console.log("⚙️  Autonomic configuration loaded");
    } catch (err) {
      if (err.code === "ENOENT") {
        console.log("📝 Using default autonomic configuration");
      } else {
        console.error("❌ Error loading config:", err.message);
      }
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Start the autonomic monitoring loop
   * Requires init() to be called first
   * @throws {Error} if not initialized
   */
  start() {
    if (!this.isInitialized) {
      throw new Error("AutonomicCore must be initialized before starting. Call init() first.");
    }

    if (this.isRunning) {
      console.warn("⚠️  Autonomic core is already running");
      return;
    }

    this.isRunning = true;
    this.consecutiveFailures = 0;
    const interval = this.config.scanInterval || DEFAULT_CONFIG.scanInterval;

    this.monitoringInterval = setInterval(() => {
      this.selfCheck().catch(err => {
        console.error("❌ Self-check failed:", err.message);

        // Circuit breaker: stop after too many consecutive failures
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error(
            `🚨 CRITICAL: ${MAX_CONSECUTIVE_FAILURES} consecutive failures detected. ` +
            `Stopping autonomic core to prevent further issues.`
          );
          this.stop();
        }
      });
    }, interval);

    console.log(`🚀 Autonomic core started (scan interval: ${interval}ms)`);
  }

  /**
   * Stop the autonomic monitoring loop
   * Cleans up all intervals and resets state
   */
  stop() {
    if (!this.isRunning) {
      console.warn("⚠️  Autonomic core is not running");
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    this.isRunning = false;
    console.log("🛑 Autonomic core stopped");
  }

  /**
   * Gather current system metrics
   * Note: CPU metric uses 1-minute load average, not instantaneous usage
   * @returns {Object|null} Current metrics or null on error
   */
  gatherMetrics() {
    try {
      // CPU load average (normalized to 0-1)
      // Note: Uses 1-minute average, not current instantaneous CPU usage
      const cpus = os.cpus();
      const loadAvg = os.loadavg()[0];
      // Normalize by number of cores, cap at 1.0
      this.metrics.cpu = Math.min(loadAvg / cpus.length, 1.0);

      // Memory usage (0-1)
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      this.metrics.mem = (totalMem - freeMem) / totalMem;

      // System uptime
      this.metrics.uptime = os.uptime();

      // Timestamp
      this.metrics.timestamp = new Date().toISOString();

      // Record in history (keep last MAX_HISTORY_SIZE samples)
      // Defensive: trim before adding to prevent unbounded growth
      if (this.metricsHistory.length >= MAX_HISTORY_SIZE) {
        this.metricsHistory.shift();
      }
      this.metricsHistory.push({ ...this.metrics });

      return this.metrics;
    } catch (err) {
      console.error("❌ Error gathering metrics:", err.message);
      return null;
    }
  }

  /**
   * Perform a self-check cycle: gather metrics and enforce policies
   * Resets failure counter on success
   * @returns {Promise<void>}
   */
  async selfCheck() {
    if (!this.config.enabled) {
      return;
    }

    const metrics = this.gatherMetrics();
    if (!metrics) {
      console.warn("⚠️  Failed to gather metrics, skipping self-check");
      return;
    }

    console.log(
      `🩺 Autonomic metrics: CPU=${(metrics.cpu * 100).toFixed(1)}%, ` +
      `MEM=${(metrics.mem * 100).toFixed(1)}%, ` +
      `Uptime=${Math.floor(metrics.uptime / 3600)}h`
    );

    const actions = this.policy.evaluate(metrics);

    if (actions.length > 0) {
      console.log(`⚡ ${actions.length} governance action(s) triggered`);
      await this.enforce(actions);
    }

    // Reset failure counter on successful check
    this.consecutiveFailures = 0;
  }

  /**
   * Enforce governance actions sorted by priority
   * @param {Array} actions - Array of actions to enforce
   * @returns {Promise<Object>} Summary of successful and failed actions
   */
  async enforce(actions) {
    const results = { success: [], failed: [] };

    // Sort by priority using constant (critical > high > medium > low)
    actions.sort((a, b) => {
      const aPriority = PRIORITY_ORDER[a.priority] ?? 99;
      const bPriority = PRIORITY_ORDER[b.priority] ?? 99;
      return aPriority - bPriority;
    });

    for (const action of actions) {
      try {
        console.log(
          `⚙️  [${action.priority?.toUpperCase() || 'NORMAL'}] ` +
          `${action.description}`
        );

        if (action.type === "adjust_policy") {
          const success = this.policy.updatePolicy(action.payload);
          if (success) {
            this.policy.recordAction(action.type);
            results.success.push(action);
          } else {
            results.failed.push({ action, error: "Policy update returned false" });
          }
        } else if (action.type === "rebalance_node") {
          await this.rebalanceNode(action.payload);
          this.policy.recordAction(action.type);
          results.success.push(action);
        } else if (action.type === "scale_down") {
          await this.scaleDown(action.payload);
          this.policy.recordAction(action.type);
          results.success.push(action);
        } else {
          console.warn(`⚠️  Unknown action type: ${action.type}`);
          results.failed.push({ action, error: `Unknown action type: ${action.type}` });
        }
      } catch (err) {
        console.error(`❌ Error enforcing action (${action.type}):`, err.message);
        results.failed.push({ action, error: err.message });
      }
    }

    return results;
  }

  /**
   * Rebalance node workload (stub implementation)
   * @param {Object} payload - Payload containing nodes to rebalance
   * @returns {Promise<void>}
   * @todo Integrate with Cluster NodeSyncManager for workload redistribution
   */
  async rebalanceNode(payload) {
    if (!payload || !payload.nodes) {
      throw new Error("No nodes specified for rebalancing");
    }

    console.log(`🔄 Rebalancing ${payload.nodes.length} node(s)...`);
    console.warn("⚠️  rebalanceNode is a stub - actual rebalancing not implemented");

    // Future: integrate with Cluster NodeSyncManager for workload redistribution
    // For now, just log the action
    for (const node of payload.nodes) {
      console.log(`  ↻ Node ${node.id || node.name}: ${(node.load * 100).toFixed(1)}% load`);
    }
  }

  /**
   * Scale down resources (stub implementation)
   * @param {Object} payload - Payload containing scale-down parameters
   * @returns {Promise<void>}
   * @todo Implement resource scaling: reduce task allocation, pause non-critical processes
   */
  async scaleDown(payload) {
    console.log("📉 Scaling down resources...");
    console.warn("⚠️  scaleDown is a stub - actual scaling not implemented");
    // Future implementation: reduce task allocation, pause non-critical processes
  }

  /**
   * Get current metrics snapshot
   * @returns {Object} Copy of current metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Get metrics history
   * @param {number} limit - Maximum number of entries to return (default: MAX_HISTORY_SIZE)
   * @returns {Array} Array of historical metrics
   */
  getMetricsHistory(limit = MAX_HISTORY_SIZE) {
    return this.metricsHistory.slice(-limit);
  }

  /**
   * Get complete status of autonomic core
   * @returns {Object} Status including config, metrics, and policy state
   */
  getStatus() {
    return {
      running: this.isRunning,
      initialized: this.isInitialized,
      config: { ...this.config },
      currentMetrics: { ...this.metrics },
      policyState: this.policy.getState(),
      historySize: this.metricsHistory.length,
      consecutiveFailures: this.consecutiveFailures
    };
  }

  /**
   * Validate configuration updates
   * @param {Object} updates - Configuration updates to validate
   * @throws {Error} if validation fails
   * @private
   */
  _validateConfigUpdates(updates) {
    if (updates.scanInterval !== undefined) {
      if (typeof updates.scanInterval !== "number" || updates.scanInterval < MIN_SCAN_INTERVAL_MS) {
        throw new Error(`scanInterval must be a number >= ${MIN_SCAN_INTERVAL_MS}ms`);
      }
    }

    if (updates.cpuThreshold !== undefined) {
      if (typeof updates.cpuThreshold !== "number" ||
          updates.cpuThreshold < 0 ||
          updates.cpuThreshold > 1) {
        throw new Error("cpuThreshold must be a number between 0 and 1");
      }
    }

    if (updates.memThreshold !== undefined) {
      if (typeof updates.memThreshold !== "number" ||
          updates.memThreshold < 0 ||
          updates.memThreshold > 1) {
        throw new Error("memThreshold must be a number between 0 and 1");
      }
    }

    if (updates.diskThreshold !== undefined) {
      if (typeof updates.diskThreshold !== "number" ||
          updates.diskThreshold < 0 ||
          updates.diskThreshold > 1) {
        throw new Error("diskThreshold must be a number between 0 and 1");
      }
    }

    if (updates.enabled !== undefined) {
      if (typeof updates.enabled !== "boolean") {
        throw new Error("enabled must be a boolean");
      }
    }
  }

  /**
   * Update configuration with validation
   * @param {Object} updates - Configuration updates to apply
   * @returns {Promise<boolean>} true if successful, false otherwise
   */
  async updateConfig(updates) {
    try {
      // Validate updates before applying
      this._validateConfigUpdates(updates);

      this.config = { ...this.config, ...updates };
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        "utf-8"
      );
      console.log("✅ Configuration updated");
      return true;
    } catch (err) {
      console.error("❌ Error updating config:", err.message);
      return false;
    }
  }
}

// Example usage
if (process.argv[1].includes("autonomic_core.js")) {
  const core = new AutonomicCore();
  let statusInterval = null;

  // Initialize and start
  core.init()
    .then(() => {
      core.start();

      // Show status periodically
      statusInterval = setInterval(() => {
        console.log("\n📊 Status:", core.getStatus());
      }, STATUS_INTERVAL_MS);
    })
    .catch(err => {
      console.error("Failed to initialize autonomic core:", err);
      process.exit(1);
    });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down autonomic core...");
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
    core.stop();
    process.exit(0);
  });
}