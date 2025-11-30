// FGD Desktop Types

export interface BackendStatus {
  status: 'online' | 'offline' | 'starting' | 'error';
  uptime?: number;
  port: number;
  version: string;
}

export interface NPCBot {
  id: string;
  name: string;
  role: 'miner' | 'builder' | 'farmer' | 'guard' | 'explorer' | 'crafter';
  status: 'idle' | 'working' | 'moving' | 'offline';
  position?: {
    x: number;
    y: number;
    z: number;
  };
  health?: number;
  hunger?: number;
  inventory?: InventoryItem[];
  currentTask?: Task;
  stats?: BotStats;
}

export interface Task {
  id: string;
  type: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedBot?: string;
  description: string;
  progress?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItem {
  slot: number;
  name: string;
  count: number;
  metadata?: any;
}

export interface BotStats {
  tasksCompleted: number;
  blocksPlaced: number;
  blocksMined: number;
  itemsCrafted: number;
  distanceTraveled: number;
  uptime: number;
}

export interface BridgeStatus {
  rcon: {
    connected: boolean;
    host: string;
    port: number;
  };
  mineflayer: {
    connected: boolean;
    botCount: number;
  };
  plugin: {
    installed: boolean;
    version?: string;
    lastHeartbeat?: Date;
  };
}

export interface ProgressionPhase {
  current: number;
  name: string;
  description: string;
  objectives: PhaseObjective[];
}

export interface PhaseObjective {
  id: string;
  description: string;
  completed: boolean;
  progress?: number;
  target?: number;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  bots: {
    active: number;
    total: number;
    maxAllowed: number;
  };
}

export interface ConsoleLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: 'backend' | 'bridge' | 'bot' | 'system';
  message: string;
  details?: any;
}

export interface ServerSettings {
  backend: {
    port: number;
    autoStart: boolean;
  };
  minecraft: {
    host: string;
    port: number;
    rconPort: number;
    rconPassword: string;
  };
  bots: {
    maxCount: number;
    defaultRole: string;
    autoReconnect: boolean;
  };
  llm: {
    provider: 'openai' | 'anthropic' | 'grok';
    model: string;
    apiKey: string;
    autonomyEnabled: boolean;
  };
}

// Electron IPC Types
export interface ElectronAPI {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
    removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
    send: (channel: string, ...args: any[]) => void;
  };
}

declare global {
  interface Window {
    fgdDesktop: {
      getConfig: () => Promise<{ port: number; apiBaseUrl: string }>;
      onBackendExit: (callback: (data: { reason: string }) => void) => void;
      minecraft: {
        start: () => Promise<{ success: boolean; message: string }>;
        stop: () => Promise<{ success: boolean; message: string }>;
        getStatus: () => Promise<{ running: boolean; pid: number | null }>;
        sendCommand: (command: string) => Promise<{ success: boolean; message?: string }>;
        onLog: (callback: (data: { message: string; level: string }) => void) => () => void;
        onStarted: (callback: () => void) => () => void;
        onStopped: (callback: (data: { code: number }) => void) => () => void;
      };
      settings: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<{ success: boolean }>;
        getAll: () => Promise<Record<string, any>>;
      };
    };
    electron: ElectronAPI;
  }
}

export {};
