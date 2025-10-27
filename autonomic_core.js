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
    this.forecastHistory = [];
    this.latestForecast = null;
    this.actionLog = [];
    this.currentScanInterval = this.config.scanInterval;
    this.snapshotPath = "./data/autonomic_snapshot.json";
    this.activityContext = {
      minersActive: false,
      activeTaskCount: 0,
      activeTasks: [],
      lastActiveAt: null,
      lastUpdated: null
    };
    this.activityContextSource = "./data/task_activity.json";
    this.fusionInsights = null;

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
    this.scheduleSelfCheck(interval);

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

  scheduleSelfCheck(interval) {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    const effectiveInterval = Math.max(1000, Math.floor(interval));
    this.currentScanInterval = effectiveInterval;

    this.monitoringInterval = setInterval(() => {
      this.selfCheck().catch(err => {
        console.error("❌ Self-check failed:", err.message);
      });
    }, effectiveInterval);
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
      const historySample = {
        cpu: this.metrics.cpu,
        mem: this.metrics.mem,
        uptime: this.metrics.uptime,
        timestamp: this.metrics.timestamp,
        context: this.getContextSnapshot()
      };
      this.metricsHistory.push(historySample);
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

    await Promise.all([
      this.refreshActivityContext(),
      this.updateFusionInsights()
    ]);

    const metrics = this.gatherMetrics();
    if (!metrics) {
      console.warn("⚠️  Failed to gather metrics, skipping self-check");
      return;
    }

    const context = this.getContextSnapshot();
    metrics.context = context;

    const forecast = this.forecastLoad();
    metrics.predicted = forecast;
    this.latestForecast = forecast;

    this.policy.ingestMetricsHistory(this.metricsHistory, context);
    this.policy.ingestFusionStats(this.fusionInsights);

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

    this.applyPolicyRecommendations();
    await this.persistSnapshot();
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
            this.recordGovernanceAction(action, true);
          }
        } else if (action.type === "rebalance_node") {
          await this.rebalanceNode(action.payload);
          this.policy.recordAction(action.type);
          this.recordGovernanceAction(action, true);
        } else if (action.type === "scale_down") {
          await this.scaleDown(action.payload);
          this.policy.recordAction(action.type);
          this.recordGovernanceAction(action, true);
        } else {
          console.warn(`⚠️  Unknown action type: ${action.type}`);
          this.recordGovernanceAction(action, false);
        }
      } catch (err) {
        console.error(`❌ Error enforcing action (${action.type}):`, err.message);
        this.recordGovernanceAction(action, false, err.message);
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
      forecast: this.latestForecast,
      context: this.getContextSnapshot(),
      historySize: this.metricsHistory.length
    };
  }

  getContextSnapshot() {
    return {
      minersActive: this.activityContext.minersActive,
      activeTaskCount: this.activityContext.activeTaskCount,
      activeTasks: [...(this.activityContext.activeTasks || [])],
      lastActiveAt: this.activityContext.lastActiveAt,
      lastUpdated: this.activityContext.lastUpdated
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

  forecastLoad(windowSize = 6) {
    const history = this.metricsHistory.slice(-windowSize);
    if (history.length === 0) {
      return {
        cpu: this.metrics.cpu,
        mem: this.metrics.mem,
        timestamp: new Date().toISOString()
      };
    }

    const weights = history.map((_, idx) => idx + 1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const weightedAvg = history.reduce(
      (acc, sample, idx) => {
        acc.cpu += sample.cpu * weights[idx];
        acc.mem += sample.mem * weights[idx];
        return acc;
      },
      { cpu: 0, mem: 0 }
    );

    const avgCpu = weightedAvg.cpu / totalWeight;
    const avgMem = weightedAvg.mem / totalWeight;
    const first = history[0];
    const last = history[history.length - 1];

    const cpuTrend = (last.cpu - first.cpu) / Math.max(history.length - 1, 1);
    const memTrend = (last.mem - first.mem) / Math.max(history.length - 1, 1);

    const forecast = {
      cpu: this.clamp01(last.cpu + cpuTrend),
      mem: this.clamp01(last.mem + memTrend),
      avgCpu: this.clamp01(avgCpu),
      avgMem: this.clamp01(avgMem),
      timestamp: new Date().toISOString()
    };

    this.forecastHistory.push(forecast);
    if (this.forecastHistory.length > 100) {
      this.forecastHistory.shift();
    }

    return forecast;
  }

  clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  async refreshActivityContext() {
    try {
      if (!fsSync.existsSync(this.activityContextSource)) {
        this.markActivityIdle();
        return;
      }

      const raw = await fs.readFile(this.activityContextSource, "utf-8");
      const payload = JSON.parse(raw);
      const activeTasks = Array.isArray(payload.activeTasks)
        ? payload.activeTasks
        : [];
      const minersActive = payload.minersActive !== undefined
        ? Boolean(payload.minersActive)
        : activeTasks.some(task => /mine/i.test(task?.type || task?.action || ""));

      const activeTaskCount = payload.activeTaskCount !== undefined
        ? payload.activeTaskCount
        : activeTasks.length;

      const lastActiveAt = payload.lastActiveAt
        ? payload.lastActiveAt
        : (minersActive || activeTaskCount > 0
          ? new Date().toISOString()
          : this.activityContext.lastActiveAt);

      this.activityContext = {
        minersActive,
        activeTaskCount,
        activeTasks,
        lastActiveAt,
        lastUpdated: new Date().toISOString()
      };
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.warn("⚠️  Unable to refresh activity context:", err.message);
      }
      this.markActivityIdle();
    }
  }

  markActivityIdle() {
    const nowIso = new Date().toISOString();
    const lastActiveAt = this.activityContext.lastActiveAt || nowIso;
    const inactiveDuration = Date.now() - new Date(lastActiveAt).getTime();
    const isIdle = inactiveDuration > 5 * 60 * 1000;

    this.activityContext = {
      minersActive: false,
      activeTaskCount: 0,
      activeTasks: [],
      lastActiveAt: isIdle ? lastActiveAt : nowIso,
      lastUpdated: nowIso
    };
  }

  updateActivityContext(patch = {}) {
    const nowIso = new Date().toISOString();
    const activeTasks = Array.isArray(patch.activeTasks)
      ? patch.activeTasks
      : (this.activityContext.activeTasks || []);

    const minersActive =
      patch.minersActive !== undefined
        ? Boolean(patch.minersActive)
        : activeTasks.some(task => /mine/i.test(task?.type || task?.action || ""));

    const activeTaskCount =
      patch.activeTaskCount !== undefined
        ? patch.activeTaskCount
        : activeTasks.length;

    const lastActiveAt =
      patch.lastActiveAt ||
      (minersActive || activeTaskCount > 0
        ? nowIso
        : this.activityContext.lastActiveAt);

    this.activityContext = {
      minersActive,
      activeTaskCount,
      activeTasks,
      lastActiveAt,
      lastUpdated: nowIso
    };
  }

  async updateFusionInsights() {
    try {
      if (!fsSync.existsSync("./data/fused_knowledge.json")) {
        return;
      }

      const raw = await fs.readFile("./data/fused_knowledge.json", "utf-8");
      const data = JSON.parse(raw);
      const metadata = data.metadata || {};
      const now = Date.now();
      const lastMergeTimestamp = metadata.lastMerge
        ? new Date(metadata.lastMerge).getTime()
        : null;
      const lastDuration = metadata.lastMergeDuration || null;
      const durationSamples = Array.isArray(metadata.mergeDurations)
        ? metadata.mergeDurations
        : [];
      const avgDuration = durationSamples.length > 0
        ? durationSamples.reduce((sum, value) => sum + value, 0) / durationSamples.length
        : lastDuration;

      let averageInterval = this.fusionInsights?.averageInterval || null;
      if (
        lastMergeTimestamp &&
        this.fusionInsights?.lastMergeTimestamp &&
        lastMergeTimestamp > this.fusionInsights.lastMergeTimestamp
      ) {
        const delta = lastMergeTimestamp - this.fusionInsights.lastMergeTimestamp;
        const smoothing = 0.3;
        const previous = averageInterval || delta;
        averageInterval = previous + (delta - previous) * smoothing;
      }

      let mergesPerHour = this.fusionInsights?.mergesPerHour || 0;
      if (
        typeof metadata.mergeCount === "number" &&
        typeof this.fusionInsights?.mergeCount === "number" &&
        metadata.mergeCount >= this.fusionInsights.mergeCount
      ) {
        const deltaCount = metadata.mergeCount - this.fusionInsights.mergeCount;
        const deltaTime = Math.max(1, now - (this.fusionInsights.collectedAt || now));
        const perHour = deltaCount > 0 ? (deltaCount / deltaTime) * 3600000 : 0;
        mergesPerHour = (mergesPerHour * 0.5) + perHour * 0.5;
      }

      this.fusionInsights = {
        mergeCount: metadata.mergeCount || 0,
        lastMergeTimestamp,
        lastMergeDuration: lastDuration,
        averageDuration: avgDuration || null,
        averageInterval,
        mergesPerHour,
        collectedAt: now
      };
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.warn("⚠️  Unable to update fusion insights:", err.message);
      }
    }
  }

  applyPolicyRecommendations() {
    const recommendations = this.policy.getRecommendations();
    if (!recommendations) return;

    const { scanInterval } = recommendations;
    if (
      scanInterval &&
      Math.abs(scanInterval - this.currentScanInterval) > 500
    ) {
      console.log(`⏱️  Adjusting autonomic scan interval to ${scanInterval}ms`);
      this.config.scanInterval = scanInterval;
      this.scheduleSelfCheck(scanInterval);
    }
  }

  recordGovernanceAction(action, success, error = null) {
    const entry = {
      ...action,
      success,
      error,
      forecast: this.latestForecast,
      timestamp: new Date().toISOString()
    };
    this.actionLog.push(entry);
    if (this.actionLog.length > 100) {
      this.actionLog.shift();
    }
  }

  async persistSnapshot() {
    try {
      const snapshot = {
        timestamp: new Date().toISOString(),
        metrics: { ...this.metrics },
        metricsHistory: this.getMetricsHistory(),
        forecastHistory: this.forecastHistory.slice(-100),
        context: this.getContextSnapshot(),
        policyState: this.policy.getState(),
        recommendations: this.policy.getRecommendations(),
        actionLog: this.actionLog.slice(-50),
        scanInterval: this.currentScanInterval
      };

      await fs.mkdir("./data", { recursive: true });
      await fs.writeFile(
        this.snapshotPath,
        JSON.stringify(snapshot, null, 2),
        "utf-8"
      );
    } catch (err) {
      console.warn("⚠️  Unable to persist autonomic snapshot:", err.message);
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