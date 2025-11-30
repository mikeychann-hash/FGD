export interface ServerStatus {
  isRunning: boolean;
  pid: number | null;
  rconConnected: boolean;
  uptime: number;
}

export interface ServerConfig {
  javaPath: string;
  serverJar: string;
  maxMemory: string;
  minMemory: string;
  serverDir: string;
  rcon: {
    port: number;
    password: string;
  };
}

export interface Player {
  name: string;
  uuid: string;
  health: number;
  hunger: number;
  level: number;
  dimension: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  inventory: InventoryItem[];
  isOnline: boolean;
  lastSeen: Date;
}

export interface InventoryItem {
  slot: number;
  type: string;
  count: number;
  name: string;
  lore?: string[];
  enchantments?: { [key: string]: number };
}

export interface Bot {
  id: string;
  name: string;
  type: 'miner' | 'lumberjack' | 'guard' | 'builder' | 'farmer';
  status: 'online' | 'offline' | 'error';
  health: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  target?: string;
  inventory: InventoryItem[];
  logs: string[];
}

export interface Plugin {
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  configFile?: string;
  dependencies: string[];
}

export interface ConsoleEntry {
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  source: string;
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
  tps: {
    current: number;
    average: number;
    history: { time: Date; value: number }[];
  };
}