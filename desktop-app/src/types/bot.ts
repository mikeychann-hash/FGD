export type BotState = "active" | "inactive" | "error";

export interface Bot {
  id: string;
  role: string;
  state: BotState;
  status?: string;
  cpu?: number;
  memory?: number;
  tick?: number;
  position?: { x: number; y: number; z: number };
  metadata?: {
    behaviorPreset?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface CreateBotRequest {
  name: string;
  role: string;
  description?: string;
  type?: string;
  personality?: string;
  appearance?: string;
  position?: { x: number; y: number; z: number };
  taskParameters?: any;
  behaviorPreset?: string;
  autoSpawn?: boolean;
}
