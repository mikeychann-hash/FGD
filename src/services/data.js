import fs from "fs/promises";
import { watch } from "fs";
import path from "path";
import { DATA_PATH, DATA_DIR, DEFAULT_FUSION_DATA } from "../config/constants.js";

// Cache for fusion data
let cachedData = null;
let lastModified = null;

/**
 * Ensures the data directory exists
 * @returns {Promise<void>}
 */
export async function ensureDataDirectory() {
  try {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    console.log("✅ Data directory verified");
  } catch (err) {
    console.error("❌ Failed to create data directory:", err);
    throw err;
  }
}

/**
 * Loads fusion data from disk with caching
 * @returns {Promise<Object>} The fusion data
 */
export async function loadFusionData() {
  try {
    const stats = await fs.stat(DATA_PATH);
    const currentModified = stats.mtime.getTime();

    // Return cached data if file hasn't changed
    if (cachedData && lastModified === currentModified) {
      return cachedData;
    }

    // Read and parse the file
    const rawData = await fs.readFile(DATA_PATH, "utf-8");
    const data = JSON.parse(rawData);

    // Update cache
    cachedData = data;
    lastModified = currentModified;

    return data;
  } catch (err) {
    if (err.code === "ENOENT") {
      // File doesn't exist, return default data
      return DEFAULT_FUSION_DATA;
    }
    // Re-throw other errors to be handled by caller
    throw err;
  }
}

/**
 * Sets up file watcher to invalidate cache when data changes
 */
export function setupFileWatcher() {
  try {
    watch(DATA_PATH, (eventType) => {
      if (eventType === "change" || eventType === "rename") {
        console.log("📝 Data file changed, invalidating cache");
        cachedData = null;
        lastModified = null;
      }
    });
    console.log("👁️  File watcher active for fusion data");
  } catch (err) {
    console.warn("⚠️  Could not set up file watcher:", err.message);
  }
}

/**
 * Loads system initialization data from files
 * @returns {Promise<Object>} System state data
 */
export async function loadSystemData() {
  try {
    const clusterData = await fs.readFile(path.join(DATA_DIR, 'cluster_status.json'), 'utf8');
    const metricsData = await fs.readFile(path.join(DATA_DIR, 'metrics.json'), 'utf8');
    const fusionData = await fs.readFile(path.join(DATA_DIR, 'fused_knowledge.json'), 'utf8');
    const statsData = await fs.readFile(path.join(DATA_DIR, 'system_stats.json'), 'utf8');
    const logsData = await fs.readFile(path.join(DATA_DIR, 'system_logs.json'), 'utf8');

    const parsedMetrics = JSON.parse(metricsData);
    const parsedLogs = JSON.parse(logsData).logs;

    return {
      nodes: JSON.parse(clusterData).nodes,
      metrics: {
        cluster: parsedMetrics,
        cpu: parsedMetrics.cpu ?? 0,
        memory: parsedMetrics.memory ?? 0,
        timestamp: parsedMetrics.timestamp || new Date().toISOString()
      },
      fusionData: JSON.parse(fusionData),
      systemStats: JSON.parse(statsData),
      logs: Array.isArray(parsedLogs) ? parsedLogs.slice(-100) : []
    };
  } catch (err) {
    console.warn("⚠️ Failed to load some data files:", err.message);
    return null;
  }
}
