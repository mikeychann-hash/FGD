import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/stores/authStore";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3000";

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { apiKey: storedKey } = useAuthStore();
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem("apiKey"));

  // Keep local apiKey in sync with auth store and storage changes
  useEffect(() => {
    setApiKey(storedKey ?? localStorage.getItem("apiKey"));

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "apiKey") {
        setApiKey(event.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storedKey]);

  useEffect(() => {
    // Disconnect if we lost auth
    if (!apiKey) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      return;
    }

    const socket = io(WS_URL, {
      auth: { apiKey },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("connect_error", () => setIsConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [apiKey]);

  const on = (event: string, callback: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, callback);
  };

  const off = (event: string) => {
    socketRef.current?.off(event);
  };

  const emit = (event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  };

  return { socket: socketRef.current, isConnected, on, off, emit };
}
