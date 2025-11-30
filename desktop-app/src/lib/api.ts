import axios from "axios";

const API_BASE = import.meta.env.DEV
  ? "http://localhost:3000" // Force explicit port in dev
  : import.meta.env.VITE_API_BASE || "http://localhost:3000";

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("apiKey");
  if (token) {
    config.headers["X-API-Key"] = token;
  }
  return config;
});

export const api = {
  // Bots
  getBots: () => apiClient.get("/api/bots"),
  createBot: (data: unknown) => apiClient.post("/api/bots", data),
  deleteBot: (id: string) => apiClient.delete(`/api/bots/${id}`),
  spawnBot: (id: string) => apiClient.post(`/api/bots/${id}/spawn`),
  despawnBot: (id: string) => apiClient.post(`/api/bots/${id}/despawn`),
  actionBot: (id: string, action: string) => apiClient.post(`/api/bots/${id}/action`, { action }),

  // System
  getHealth: () => apiClient.get("/api/health"),
  getSystemStats: () => apiClient.get("/api/system/stats"),

  // Cluster
  getClusterStatus: () => apiClient.get("/api/cluster"),
  getMetrics: () => apiClient.get("/api/metrics"),

  // Fusion
  getFusionData: () => apiClient.get("/api/fusion/data"),

  // Dead letter
  getDeadLetters: () => apiClient.get("/api/bots/dead-letter"),
  retryDeadLetters: () => apiClient.post("/api/bots/dead-letter/retry"),

  // Mineflayer specific controls
  moveBot: (id: string, position: { x: number; y: number; z: number }) =>
    apiClient.post(`/api/mineflayer/${id}/move`, position),
  mineBot: (id: string, blockType: string, count: number = 1) =>
    apiClient.post(`/api/mineflayer/${id}/mine`, { blockType, count }),
  chatBot: (id: string, message: string) =>
    apiClient.post(`/api/mineflayer/${id}/chat`, { message }),

  // New combat/craft controls
  combatBot: (id: string, subAction: string, params: object) =>
    apiClient.post(`/api/mineflayer/${id}/combat`, { subAction, ...params }),
  craftBot: (id: string, recipe: string, count: number = 1) =>
    apiClient.post(`/api/mineflayer/${id}/craft`, { recipe, count }),

  // Commands
  executeCommand: (command: string) => apiClient.post("/api/command", { command }),

  // Control
  startControlSession: (id: string) => apiClient.post(`/api/control/${id}/session/start`),
  stopControlSession: (id: string) => apiClient.post(`/api/control/${id}/session/stop`),
  getControlState: (id: string) => apiClient.get(`/api/control/${id}/state`),

  // Server Control
  restartServer: () => apiClient.post("/api/server/restart"),
  stopServer: () => apiClient.post("/api/server/stop"),
  getServerStatus: () => apiClient.get("/api/server/status"),

  // Autonomy
  toggleBotAutonomy: (id: string, enabled: boolean) =>
    apiClient.put(`/api/bots/${id}`, {
      behaviorPreset: enabled ? 'default' : 'idle',
      taskParameters: { autonomy: enabled }
    }),
};
