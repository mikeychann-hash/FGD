import { Activity, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type ConnectivityStatus = {
  api: boolean;
  ws: boolean;
  bridge: "ok" | "degraded" | "error" | "unknown";
  pluginAge: number | null;
};

export function StatusBar({ connectivity }: { connectivity: ConnectivityStatus }) {
  const isHealthy = connectivity.api && connectivity.ws && connectivity.bridge === "ok";
  const isDegraded = connectivity.api && connectivity.ws && connectivity.bridge === "degraded";
  const statusColor = isHealthy ? "text-green-500" : isDegraded ? "text-yellow-500" : "text-red-500";
  const StatusIcon = isHealthy ? Wifi : isDegraded ? Activity : connectivity.ws ? AlertCircle : WifiOff;

  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <StatusIcon className={`h-4 w-4 ${statusColor}`} />
        <span className="font-medium">
          {isHealthy ? "Connected" : isDegraded ? "Degraded" : "Disconnected"}
        </span>
        <Badge variant={connectivity.api ? "default" : "destructive"}>API</Badge>
        <Badge variant={connectivity.ws ? "default" : "destructive"}>WS</Badge>
        <Badge
          variant={
            connectivity.bridge === "ok"
              ? "default"
              : connectivity.bridge === "degraded"
              ? "secondary"
              : "destructive"
          }
        >
          Bridge
        </Badge>
      </div>
      {connectivity.pluginAge !== null && (
        <span className="text-xs text-muted-foreground">Heartbeat: {connectivity.pluginAge}s</span>
      )}
    </div>
  );
}
