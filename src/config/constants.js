import path from "path";
import { fileURLToPath } from "url";

// Directory constants
export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, "../..");
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const DATA_PATH = path.join(DATA_DIR, "fused_knowledge.json");
export const DEFAULT_PORT = 3000;

/**
 * Default fusion data structure returned when no data file exists
 */
export const DEFAULT_FUSION_DATA = {
  skills: {},
  dialogues: {},
  outcomes: [],
  metadata: {
    version: "2.0.0",
    lastMerge: null,
    mergeCount: 0,
    sources: []
  }
};

/**
 * Default system state
 */
export const DEFAULT_SYSTEM_STATE = {
  nodes: [],
  metrics: { cpu: 0, memory: 0 },
  fusionData: {},
  systemStats: {},
  logs: [],
  config: {
    maxWorkers: 8,
    logLevel: 'info',
    autoScaling: true,
    telemetry: true,
    learningRate: 1.0,
    delegationBias: 0.4,
    cooldown: 10000
  }
};
