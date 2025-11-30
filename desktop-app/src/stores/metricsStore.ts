import { create } from "zustand";
import { api } from "@/lib/api";
import type { ClusterNode, MetricPoint } from "@/types/metrics";

type MetricsState = {
  nodes: ClusterNode[];
  metrics: MetricPoint[];
  loading: boolean;
  loadingCluster: boolean;
  loadingMetrics: boolean;
  error: string | null;
  errorCluster: string | null;
  errorMetrics: string | null;
  fetchCluster: () => Promise<void>;
  fetchMetrics: () => Promise<void>;
  setNodes: (nodes: ClusterNode[]) => void;
  setMetrics: (metrics: MetricPoint[]) => void;
};

export const useMetricsStore = create<MetricsState>((set) => ({
  nodes: [],
  metrics: [],
  loading: false,
  loadingCluster: false,
  loadingMetrics: false,
  error: null,
  errorCluster: null,
  errorMetrics: null,
  setNodes: (nodes) => set({ nodes }),
  setMetrics: (metrics) => set({ metrics }),
  fetchCluster: async () => {
    set((state) => ({
      loading: true,
      loadingCluster: true,
      errorCluster: null,
      error: state.errorMetrics ?? null,
    }));

    try {
      const res = await api.getClusterStatus();
      const data = res.data;
      const nodes: ClusterNode[] =
        data?.nodes ??
        data?.cluster ??
        (Array.isArray(data) ? data : []) ??
        [];

      set((state) => ({
        nodes,
        loadingCluster: false,
        loading: state.loadingMetrics,
        errorCluster: null,
        error: state.errorMetrics,
      }));
    } catch (err: any) {
      const message = err?.message ?? "Failed to load cluster";
      set((state) => ({
        errorCluster: message,
        error: message,
        nodes: [],
        loadingCluster: false,
        loading: state.loadingMetrics,
      }));
    }
  },
  fetchMetrics: async () => {
    set((state) => ({
      loading: true,
      loadingMetrics: true,
      errorMetrics: null,
      error: state.errorCluster ?? null,
    }));

    try {
      const res = await api.getMetrics();
      const data = res.data;
      let metrics: MetricPoint[] =
        data?.metrics ??
        data ??
        [];

      // If API returns current snapshot, derive an array with timestamps
      if (!Array.isArray(metrics) && data?.cpu !== undefined) {
        const now = new Date().toLocaleTimeString();
        metrics = [
          {
            time: now,
            cpu: data.cpu ?? 0,
            memory: data.memory ?? 0,
            queue: data.queue ?? 0,
            latency: data.latency ?? 0,
          },
        ];
      }

      // Always ensure at least one data point so charts render, even if server returns empty
      if (!Array.isArray(metrics) || metrics.length === 0) {
        const now = new Date().toLocaleTimeString();
        metrics = [{ time: now, cpu: 0, memory: 0, queue: 0, latency: 0 }];
      }

      set((state) => ({
        metrics,
        loadingMetrics: false,
        loading: state.loadingCluster,
        errorMetrics: null,
        error: state.errorCluster,
      }));
    } catch (err: any) {
      const message = err?.message ?? "Failed to load metrics";
      set((state) => ({
        errorMetrics: message,
        error: state.errorCluster ?? message,
        metrics: [
          { time: new Date().toLocaleTimeString(), cpu: 0, memory: 0, queue: 0, latency: 0 },
        ],
        loadingMetrics: false,
        loading: state.loadingCluster,
      }));
    }
  },
}));
