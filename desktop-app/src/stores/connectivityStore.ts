import { create } from "zustand";
import type { ConnectivityStatus } from "@/components/admin/StatusBar";

type ConnectivityState = ConnectivityStatus & {
  setStatus: (status: Partial<ConnectivityStatus>) => void;
};

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  api: false,
  ws: false,
  bridge: "unknown",
  pluginAge: null,
  setStatus: (status) => set((prev) => ({ ...prev, ...status })),
}));
