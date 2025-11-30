import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  apiKey: string | null;
  isAuthenticated: boolean;
  login: (key: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      apiKey: "open-mode",
      isAuthenticated: true, // Default to true for open access
      login: (key: string) => {
        localStorage.setItem("apiKey", key);
        set({ apiKey: key, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem("apiKey");
        set({ apiKey: null, isAuthenticated: false });
      },
    }),
    { name: "fgd-auth-storage" },
  ),
);
