import { create } from "zustand";
import { api } from "@/lib/api";
import type { FusionRecord } from "@/components/fusion/FusionDataViewer";
import type { FusionStatsData } from "@/components/fusion/FusionStats";

type FusionState = {
  records: FusionRecord[];
  stats: FusionStatsData;
  loading: boolean;
  error: string | null;
  fetchFusion: () => Promise<void>;
  setRecords: (records: FusionRecord[] | ((prev: FusionRecord[]) => FusionRecord[])) => void;
  setStats: (stats: FusionStatsData) => void;
};

const normalizeRecord = (record: any, idx: number): FusionRecord | null => {
  const category = record?.category;
  if (category !== "skill" && category !== "dialogue" && category !== "outcome") {
    return null;
  }

  return {
    id: record?.id ?? `fusion-${idx}`,
    category,
    detail: record?.detail ?? JSON.stringify(record),
    timestamp: record?.timestamp ?? new Date().toISOString(),
    confidence: record?.confidence,
  };
};

const normalizeStats = (data: any): FusionStatsData => ({
  skills: data?.skills ?? 0,
  dialogues: data?.dialogues ?? 0,
  outcomes: data?.outcomes ?? 0,
  totalInteractions: data?.totalInteractions ?? data?.total_interactions ?? data?.total ?? 0,
  learningRate: data?.learningRate ?? data?.learning_rate ?? data?.rate,
});

export const useFusionStore = create<FusionState>((set) => ({
  records: [],
  stats: { skills: 0, dialogues: 0, outcomes: 0, totalInteractions: 0, learningRate: 0 },
  loading: false,
  error: null,
  setRecords: (records) =>
    set((state) => ({
      records: typeof records === "function" ? records(state.records) : records,
    })),
  setStats: (stats) => set({ stats }),
  fetchFusion: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.getFusionData();
      const data = res.data;
      const rawRecords =
        data?.records ??
        data?.fused_knowledge ??
        data?.items ??
        (Array.isArray(data) ? data : []);

      const normalizedRecords = (Array.isArray(rawRecords) ? rawRecords : []).map(normalizeRecord).filter(Boolean) as FusionRecord[];

      const statsSource =
        data?.stats ??
        data?.summary ??
        {
          skills: data?.skills ?? 0,
          dialogues: data?.dialogues ?? 0,
          outcomes: data?.outcomes ?? 0,
          totalInteractions: data?.totalInteractions ?? data?.total_interactions ?? data?.total ?? 0,
          learningRate: data?.learningRate ?? data?.learning_rate ?? data?.rate,
        };

      set({
        records: normalizedRecords,
        stats: normalizeStats(statsSource),
        loading: false,
      });
    } catch (err: any) {
      set({ error: err?.message ?? "Failed to load fusion data", loading: false });
    }
  },
}));
