import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Power, Activity } from "lucide-react";

export const ServerControl: React.FC = () => {
    const { toast } = useToast();
    const [status, setStatus] = useState<"running" | "stopped" | "unknown">("unknown");
    const [uptime, setUptime] = useState<number>(0);
    const [loading, setLoading] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await api.getServerStatus();
            setStatus(res.data.status);
            setUptime(res.data.uptime);
        } catch (e) {
            setStatus("stopped"); // Assume stopped if unreachable
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleRestart = async () => {
        setLoading(true);
        try {
            await api.restartServer();
            toast({ title: "Server Restarting", description: "The backend server is restarting..." });
            setStatus("unknown");
            // Wait a bit before polling again
            setTimeout(fetchStatus, 3000);
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Failed to restart server" });
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async () => {
        if (!confirm("Are you sure you want to stop the server? You will lose connection.")) return;
        setLoading(true);
        try {
            await api.stopServer();
            toast({ title: "Server Stopping", description: "The backend server is shutting down." });
            setStatus("stopped");
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Failed to stop server" });
        } finally {
            setLoading(false);
        }
    };

    const formatUptime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h}h ${m}m ${s}s`;
    };

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Server Status</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <div className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-2">
                            <span className="text-2xl font-bold">
                                {status === "running" ? "Online" : status === "stopped" ? "Offline" : "Unknown"}
                            </span>
                            <Badge variant={status === "running" ? "default" : "destructive"}>
                                {status}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Uptime: {status === "running" ? formatUptime(uptime) : "N/A"}
                        </p>
                    </div>
                    <div className="flex space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRestart}
                            disabled={loading || status === "stopped"}
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            Restart
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleStop}
                            disabled={loading || status === "stopped"}
                        >
                            <Power className="mr-2 h-4 w-4" />
                            Stop
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
