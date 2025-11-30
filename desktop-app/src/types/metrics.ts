export interface ClusterNode {
  name: string;
  status: "healthy" | "warning" | "offline";
  cpu: number;
  memory: number;
  tasks: number;
}

export interface MetricPoint {
  time: string;
  cpu: number;
  memory: number;
  queue: number;
  latency: number;
}
