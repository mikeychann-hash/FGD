import { create } from "zustand";
import { api } from "@/lib/api";
import type { Bot, CreateBotRequest } from "@/types/bot";

type BotStore = {
  bots: Bot[];
  loading: boolean;
  error: string | null;
  fetchBots: () => Promise<void>;
  createBot: (data: CreateBotRequest) => Promise<void>;
  deleteBot: (id: string) => Promise<void>;
  spawnBot: (id: string) => Promise<void>;
  despawnBot: (id: string) => Promise<void>;
  setBots: (updater: Bot[] | ((prev: Bot[]) => Bot[])) => void;
};

export const useBotStore = create<BotStore>((set, get) => ({
  bots: [],
  loading: false,
  error: null,
  setBots: (updater) =>
    set((state) => ({
      bots: typeof updater === "function" ? (updater as (prev: Bot[]) => Bot[])(state.bots) : updater,
    })),
  fetchBots: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.getBots();
      set({ bots: res.data?.bots ?? res.data ?? [], loading: false });
    } catch (err: any) {
      set({ error: err?.message ?? "Failed to load bots", loading: false });
    }
  },
  createBot: async (data: CreateBotRequest) => {
    await api.createBot(data);
    await get().fetchBots();
  },
  deleteBot: async (id: string) => {
    await api.deleteBot(id);
    set({ bots: get().bots.filter((b) => b.id !== id) });
  },
  spawnBot: async (id: string) => {
    await api.spawnBot(id);
  },
  despawnBot: async (id: string) => {
    await api.despawnBot(id);
  },
}));
