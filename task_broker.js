// ctn/task_broker.js
// Routes and delegates tasks across cognitive network nodes

import { CognitiveLink } from "./cognitive_link.js";
import { validateTask } from "./task_schema.js";
import { planTask } from "./tasks/index.js";
import fs from "fs/promises";
import fsSync from "fs";
import EventEmitter from "events";

const DEFAULT_MANIFEST = {
  nodeName: "Node_A",
  nodeId: "node-a-001",
  role: "general",
  specialization: [],
  peers: [],
  taskRouting: {
    strategy: "best-fit",
    fallbackToLocal: true,
    retryAttempts: 3,
    retryDelay: 1000,
    taskTimeout: 30000
  }
};

export class TaskBroker extends EventEmitter {
  constructor(configPath = "./ctn/node_manifest.json") {
    super();
    this.configPath = configPath;
    this.manifest = { ...DEFAULT_MANIFEST };
    this.links = new Map();
    this.metrics = {
      tasksReceived: 0,
      tasksDelegated: 0,
      tasksLocal: 0,
      tasksFailed: 0,
      totalLatency: 0
    };
    this.loadManifest();
    this.initializePeers();
  }

  loadManifest() {
    try {
      if (fsSync.existsSync(this.configPath)) {
        const data = fsSync.readFileSync(this.configPath, "utf-8");
        this.manifest = { ...DEFAULT_MANIFEST, ...JSON.parse(data) };
        console.log(`📋 Loaded manifest for ${this.manifest.nodeName}`);
      }
    } catch (err) {
      console.error("❌ Error loading manifest:", err.message);
    }
  }

  initializePeers() {
    if (!this.manifest.peers || this.manifest.peers.length === 0) return;
    console.log(`🔗 Initializing ${this.manifest.peers.length} cognitive peer(s)`);

    for (const peerConfig of this.manifest.peers) {
      try {
        const link = new CognitiveLink(peerConfig, {
          taskTimeout: this.manifest.taskRouting?.taskTimeout || 30000
        });
        link.on("connected", (name) => this.emit("peer_connected", name));
        link.on("disconnected", (name, reason) => this.emit("peer_disconnected", name, reason));
        this.links.set(link.name, link);
      } catch (err) {
        console.error("❌ Failed to create link:", err.message);
      }
    }
  }

  async delegateTask(task, options = {}) {
    const validation = validateTask(task);
    if (!validation.valid) {
      this.metrics.tasksFailed++;
      const error = `Invalid task payload: ${validation.errors.join("; ")}`;
      this.emit("task_failed", { task, error });
      return { error, from: "broker" };
    }

    this.metrics.tasksReceived++;
    const startTime = Date.now();

    try {
      const target = this.findBestNode(task);
      
      if (!target) {
        console.log(`ℹ️  No suitable peer, handling locally`);
        this.metrics.tasksLocal++;
        return await this.executeLocally(task);
      }

      console.log(`🧩 Delegating "${task.action}" to ${target.name}`);
      
      const retryAttempts = options.retryAttempts || this.manifest.taskRouting?.retryAttempts || 3;
      const retryDelay = options.retryDelay || this.manifest.taskRouting?.retryDelay || 1000;
      
      let lastError;
      for (let attempt = 0; attempt < retryAttempts; attempt++) {
        try {
          const result = await target.sendTask(task);
          this.metrics.tasksDelegated++;
          this.metrics.totalLatency += (Date.now() - startTime);
          this.emit("task_completed", { task, target: target.name, duration: Date.now() - startTime });
          return { result, from: target.name, local: false };
        } catch (err) {
          lastError = err;
          if (attempt < retryAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          }
        }
      }

      if (this.manifest.taskRouting?.fallbackToLocal) {
        this.metrics.tasksLocal++;
        return await this.executeLocally(task);
      }
      throw lastError;
    } catch (err) {
      this.metrics.tasksFailed++;
      this.emit("task_failed", { task, error: err.message });
      return { error: err.message, from: "broker" };
    }
  }

  findBestNode(task) {
    const strategy = this.manifest.taskRouting?.strategy || "best-fit";
    const capable = Array.from(this.links.values()).filter(link => 
      link.enabled && link.isConnected && link.canHandle(task.action)
    );

    if (capable.length === 0) return null;

    switch (strategy) {
      case "least-connections":
        return capable.reduce((best, current) => 
          current.getLoad() < best.getLoad() ? current : best
        );
      case "priority":
        return capable.sort((a, b) => a.priority - b.priority)[0];
      case "weighted":
        return this.selectWeighted(capable);
      default:
        return capable.reduce((best, current) => {
          const cs = this.calculateFitScore(current, task);
          const bs = this.calculateFitScore(best, task);
          return cs > bs ? current : best;
        });
    }
  }

  calculateFitScore(link, task) {
    let score = link.specialization.includes(task.action) ? 10 : 0;
    score += Math.max(0, 10 - link.getLoad());
    const total = link.completedTasks + link.failedTasks;
    score += total > 0 ? (link.completedTasks / total) * 10 : 5;
    return score;
  }

  selectWeighted(capable) {
    const total = capable.reduce((sum, link) => sum + link.weight, 0);
    let random = Math.random() * total;
    for (const link of capable) {
      random -= link.weight;
      if (random <= 0) return link;
    }
    return capable[0];
  }

  async executeLocally(task) {
    console.log(`🏠 Executing locally: ${task.action}`);
    const plan = planTask(task);
    this.emit("local_execution", { task, plan });

    const result = plan
      ? { summary: plan.summary, plan }
      : { summary: `Task "${task.action}" executed locally` };

    return { result, from: this.manifest.nodeName, local: true };
  }

  getStatus() {
    const peerStatus = {};
    for (const [name, link] of this.links.entries()) {
      peerStatus[name] = link.getStatus();
    }
    const avgLatency = this.metrics.tasksDelegated > 0 
      ? Math.round(this.metrics.totalLatency / this.metrics.tasksDelegated) 
      : 0;

    return {
      nodeName: this.manifest.nodeName,
      nodeId: this.manifest.nodeId,
      role: this.manifest.role,
      specialization: this.manifest.specialization,
      peers: peerStatus,
      metrics: { ...this.metrics, averageLatency: avgLatency }
    };
  }

  destroy() {
    for (const link of this.links.values()) link.destroy();
    this.links.clear();
    this.removeAllListeners();
  }
}