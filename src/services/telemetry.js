import fs from "fs/promises";
import { watch } from "fs";
import path from "path";
import os from "os";
import { DATA_DIR } from "../config/constants.js";
import { logger } from "../../logger.js";

const telemetryWatchers = [];
const telemetryIntervals = [];

/**
 * Debounce utility function
 */
function debounce(fn, delay = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Watch a telemetry file and call handler when it changes
 */
function watchTelemetryFile(fileName, handler) {
  const filePath = path.join(DATA_DIR, fileName);

  const load = async () => {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(content);
      handler(parsed);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('Failed to load telemetry file', { file: fileName, error: error.message });
      }
    }
  };

  const debouncedLoad = debounce(load, 150);
  load();

  try {
    const watcher = watch(filePath, { persistent: false }, () => debouncedLoad());
    telemetryWatchers.push(watcher);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const directoryWatcher = watch(DATA_DIR, { persistent: false }, (_, changedFile) => {
        if (changedFile === fileName) {
          debouncedLoad();
        }
      });
      telemetryWatchers.push(directoryWatcher);
    } else {
      logger.warn('Failed to watch telemetry file', { file: fileName, error: error.message });
    }
  }
}

/**
 * Sample CPU times for metrics calculation
 */
function sampleCpuTimes() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times)) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }

  return { idle, total };
}

/**
 * Creates a host metrics sampler function
 */
function createHostMetricsSampler(systemState, io, recomputeStatsCallback) {
  let previous = sampleCpuTimes();

  return () => {
    const current = sampleCpuTimes();
    const idleDiff = current.idle - previous.idle;
    const totalDiff = current.total - previous.total;
    previous = current;

    const cpuPercent = totalDiff > 0
      ? Math.max(0, Math.min(100, Math.round(100 - (idleDiff / totalDiff) * 100)))
      : 0;

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryPercent = Math.max(0, Math.min(100, Math.round(((totalMemory - freeMemory) / totalMemory) * 100)));

    const hostMetrics = {
      cpuPercent,
      memoryPercent,
      loadAverage: os.loadavg?.()[0] ?? null,
      totalMemoryBytes: totalMemory,
      freeMemoryBytes: freeMemory,
      processMemoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024))
    };

    systemState.metrics = {
      ...systemState.metrics,
      cpu: cpuPercent,
      memory: memoryPercent,
      timestamp: new Date().toISOString(),
      host: hostMetrics
    };

    io.emit('metrics:update', systemState.metrics);
    recomputeStatsCallback();
  };
}

/**
 * Start the telemetry pipeline
 */
export function startTelemetryPipeline(systemState, io, recomputeStatsCallback) {
  watchTelemetryFile('cluster_status.json', payload => {
    if (Array.isArray(payload?.nodes)) {
      systemState.nodes = payload.nodes;
      recomputeStatsCallback();
      io.emit('nodes:update', systemState.nodes);
    }
  });

  watchTelemetryFile('metrics.json', payload => {
    if (payload && typeof payload === 'object') {
      systemState.metrics = {
        ...systemState.metrics,
        cluster: payload,
        clusterTimestamp: payload.timestamp || new Date().toISOString()
      };
      io.emit('metrics:update', systemState.metrics);
    }
  });

  watchTelemetryFile('system_stats.json', payload => {
    if (payload && typeof payload === 'object') {
      systemState.systemStats = { ...systemState.systemStats, ...payload };
      io.emit('stats:update', systemState.systemStats);
    }
  });

  watchTelemetryFile('system_logs.json', payload => {
    const logs = Array.isArray(payload?.logs) ? payload.logs.slice(-100) : [];
    systemState.logs = logs;
    io.emit('logs:update', systemState.logs);
  });

  const sampleHostMetrics = createHostMetricsSampler(systemState, io, recomputeStatsCallback);
  sampleHostMetrics();
  telemetryIntervals.push(setInterval(sampleHostMetrics, 5000));
}

/**
 * Cleanup telemetry watchers and intervals
 */
export function cleanupTelemetry() {
  telemetryIntervals.forEach(interval => clearInterval(interval));
  telemetryWatchers.forEach(watcher => {
    if (typeof watcher.close === 'function') {
      watcher.close();
    }
  });
}

/**
 * Attach NPC engine telemetry listeners
 */
export function attachNpcEngineTelemetry(npcEngine, systemState, io, recomputeStatsCallback, appendLogCallback) {
  if (!npcEngine || typeof npcEngine.on !== 'function') {
    return;
  }

  const updateStats = () => {
    systemState.systemStats.activeBots = npcEngine.npcs instanceof Map ? npcEngine.npcs.size : 0;
    recomputeStatsCallback();
  };

  npcEngine.on('npc_registered', updateStats);
  npcEngine.on('npc_unregistered', updateStats);
  npcEngine.on('npc_status', updateStats);

  npcEngine.on('npc_task_completed', payload => {
    appendLogCallback({
      level: 'success',
      message: `Task completed by ${payload?.npcId || payload?.id || 'unknown'}`
    });
    updateStats();
  });

  npcEngine.on('npc_error', payload => {
    const details = payload?.payload?.message || payload?.error || payload?.message || 'Unknown error';
    appendLogCallback({
      level: 'error',
      message: `NPC ${payload?.npcId || payload?.id || 'unknown'} error: ${details}`
    });
  });

  npcEngine.on('npc_scan', payload => {
    appendLogCallback({
      level: 'info',
      message: `Scan received from ${payload?.npcId || payload?.botId || 'unknown'}`
    });
  });
}
