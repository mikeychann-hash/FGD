import { DEFAULT_SYSTEM_STATE } from "../config/constants.js";

/**
 * System state manager
 */
export class SystemStateManager {
  constructor(io) {
    this.io = io;
    this.state = { ...DEFAULT_SYSTEM_STATE };
  }

  /**
   * Append a log entry to system logs
   */
  appendSystemLog(entry) {
    const now = new Date();
    const logEntry = {
      time: entry.time || now.toTimeString().split(' ')[0],
      level: entry.level || 'info',
      message: entry.message || ''
    };

    this.state.logs.push(logEntry);
    if (this.state.logs.length > 100) {
      this.state.logs.shift();
    }

    this.io.emit('log:new', logEntry);
    this.io.emit('logs:update', this.state.logs);
  }

  /**
   * Recompute system statistics
   */
  recomputeSystemStats(npcEngine) {
    const nodes = Array.isArray(this.state.nodes) ? this.state.nodes : [];
    const healthyNodes = nodes.filter(node => node && node.status === 'healthy');

    const sumCpu = healthyNodes.reduce((sum, node) => sum + (Number(node.cpu) || 0), 0);
    const sumMemory = healthyNodes.reduce((sum, node) => sum + (Number(node.memory) || 0), 0);
    const sumTasks = healthyNodes.reduce((sum, node) => sum + (Number(node.tasks) || 0), 0);

    const avgCpu = healthyNodes.length ? Math.round(sumCpu / healthyNodes.length) : 0;
    const avgMemory = healthyNodes.length ? Math.round(sumMemory / healthyNodes.length) : 0;

    const activeBots = npcEngine?.npcs instanceof Map ? npcEngine.npcs.size : this.state.systemStats.activeBots || 0;

    this.state.systemStats = {
      ...this.state.systemStats,
      nodeCount: nodes.length,
      healthyNodes: healthyNodes.length,
      avgCpu,
      avgMemory,
      activeTasks: sumTasks,
      activeBots,
      lastUpdated: new Date().toISOString()
    };

    this.io.emit('stats:update', this.state.systemStats);
  }

  /**
   * Load initial system data
   */
  async loadInitialData(loadedData) {
    if (!loadedData) return;

    this.state.nodes = loadedData.nodes;
    this.state.metrics = { ...this.state.metrics, ...loadedData.metrics };
    this.state.fusionData = loadedData.fusionData;
    this.state.systemStats = { ...loadedData.systemStats };
    this.state.logs = loadedData.logs;
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Update config
   */
  updateConfig(newConfig) {
    this.state.config = { ...this.state.config, ...newConfig };
    this.io.emit('config:update', this.state.config);
    return this.state.config;
  }

  /**
   * Update policy
   */
  updatePolicy({ learningRate, delegationBias, cooldown }) {
    this.state.config.learningRate = learningRate;
    this.state.config.delegationBias = delegationBias;
    this.state.config.cooldown = cooldown;
    this.io.emit('policy:update', { learningRate, delegationBias, cooldown });
  }
}
