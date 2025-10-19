// autonomic/autonomic_core.js
// Self-monitoring and self-healing system for AICraft infrastructure

import os from "os";
import { PolicyEngine } from "./policy_engine.js";
import fs from "fs/promises";
import fsSync from "fs";

const DEFAULT_CONFIG = {
  scanInterval: 10000,
  cpuThreshold: 0.85,
  memThreshold: 0.85,
  diskThreshold: 0.90,
  enabled: true
};

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
    this.isRunning = false;
    this.metricsHistory = [];
    
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fsSync.existsSync(this.configPath)) {
        const data = fsSync.readFileSync(this.configPath, "utf-8");
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
        console.log("⚙️  Autonomic configuration loaded");
      } else {
        console.log("📝 Using default autonomic configuration");
      }
    } catch (err) {
      console.error("❌ Error loading config:", err.message);
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  start() {
    if (this.isRunning) {
      console.warn("⚠️  Autonomic core is already running");
      return;
    }

    this.isRunning = true;
    const interval = this.config.scanInterval || 10000;
    
    this.monitoringInterval = setInterval(() => {
      this.selfCheck().catch(err => {
        console.error("❌ Self-check failed:", err.message);
      });
    }, interval);

    console.log(`🚀 Autonomic core started (scan interval: ${interval}ms)`);
  }

  stop() {
    if (!this.isRunning) {
      console.warn("⚠️  Autonomic core is not running");
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isRunning = false;
    console.log("🛑 Autonomic core stopped");
  }

  gatherMetrics() {
    try {
      // CPU load average (normalized to 0-1)
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

      // Record in history (keep last 100 samples)
      this.metricsHistory.push({ ...this.metrics });
      if (this.metricsHistory.length > 100) {
        this.metricsHistory.shift();
      }

      return this.metrics;
    } catch (err) {
      console.error("❌ Error gathering metrics:", err.message);
      return null;
    }
  }

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
  }

  async enforce(actions) {
    // Sort by priority (critical > high > medium > low)
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    actions.sort((a, b) => {
      const aPriority = priorityOrder[a.priority] || 99;
      const bPriority = priorityOrder[b.priority] || 99;
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
          }
        } else if (action.type === "rebalance_node") {
          await this.rebalanceNode(action.payload);
          this.policy.recordAction(action.type);
        } else if (action.type === "scale_down") {
          await this.scaleDown(action.payload);
          this.policy.recordAction(action.type);
        } else {
          console.warn(`⚠️  Unknown action type: ${action.type}`);
        }
      } catch (err) {
        console.error(`❌ Error enforcing action (${action.type}):`, err.message);
      }
    }
  }

  async rebalanceNode(payload) {
    if (!payload || !payload.nodes) {
      console.warn("⚠️  No nodes specified for rebalancing");
      return;
    }

    console.log(`🔄 Rebalancing ${payload.nodes.length} node(s)...`);
    
    // Future: integrate with Cluster NodeSyncManager for workload redistribution
    // For now, just log the action
    for (const node of payload.nodes) {
      console.log(`  ↻ Node ${node.id || node.name}: ${(node.load * 100).toFixed(1)}% load`);
    }
  }

  async scaleDown(payload) {
    console.log("📉 Scaling down resources...");
    // Future implementation: reduce task allocation, pause non-critical processes
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getMetricsHistory(limit = 100) {
    return this.metricsHistory.slice(-limit);
  }

  getStatus() {
    return {
      running: this.isRunning,
      config: { ...this.config },
      currentMetrics: { ...this.metrics },
      policyState: this.policy.getState(),
      historySize: this.metricsHistory.length
    };
  }

  async updateConfig(updates) {
    try {
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
  core.start();

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down autonomic core...");
    core.stop();
    process.exit(0);
  });

  // Show status every 30 seconds
  setInterval(() => {
    console.log("\n📊 Status:", core.getStatus());
  }, 30000);
}