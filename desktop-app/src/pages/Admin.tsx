import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { ActionLog, type ActionEntry } from "@/components/admin/ActionLog";
import { LiveMap } from "@/components/admin/LiveMap";
import { BotCreator } from "@/components/admin/BotCreator";
import { BotControls } from "@/components/admin/BotControls";
import { KeyboardControls } from "@/components/admin/KeyboardControls";
import { BotActions } from "@/components/admin/BotActions";
import { BotList } from "@/components/admin/BotList";
import type { BotCardProps } from "@/components/admin/BotCard";
import { ChestManager } from "@/components/admin/ChestManager";
import { CommandInput } from "@/components/admin/CommandInput";
import { ConsoleLog, type LogEntry } from "@/components/admin/ConsoleLog";
import { DeadLetterQueue } from "@/components/admin/DeadLetterQueue";
import type { DeadLetterItem } from "@/components/admin/DeadLetterQueue";
import { InventoryViewer } from "@/components/admin/InventoryViewer";
import { LoginDialog } from "@/components/admin/LoginDialog";
import { StatusBar, type ConnectivityStatus } from "@/components/admin/StatusBar";
import { useBotStore } from "@/stores/botStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useConnectivityStore } from "@/stores/connectivityStore";
import { api } from "@/lib/api";
import { ServerControl } from "@/components/admin/ServerControl";
import { AutonomousBots } from "@/components/admin/AutonomousBots";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";



export default function Admin() {
  const { isAuthenticated, login } = useAuthStore();
  const { bots, fetchBots, spawnBot, despawnBot, deleteBot, createBot, setBots } = useBotStore();
  const { on, off } = useWebSocket();
  const connectivity = useConnectivityStore();
  const [deadLetters, setDeadLetters] = useState<DeadLetterItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [manualBotId, setManualBotId] = useState<string>("");
  const healthPoll = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeBots = bots.filter(b => b.state === "active");

  const stopHealthPoll = () => {
    if (healthPoll.current) {
      clearTimeout(healthPoll.current);
      healthPoll.current = null;
    }
  };

  const fetchDeadLetters = async () => {
    try {
      const res = await api.getDeadLetters();
      const data = res.data?.queue ?? res.data ?? [];
      setDeadLetters(data);
    } catch (err) {
      console.error(err);
    }
  };

  const pollHealth = async () => {
    try {
      const res = await api.getHealth();
      const data = res.data;
      const apiOk = data?.success ?? true;
      const bridgeState = data?.bridge?.status ?? "unknown";
      const pluginAge = data?.bridge?.pluginAge ?? null;
      const wsOk = true;
      connectivity.setStatus({
        api: !!apiOk,
        ws: wsOk,
        bridge: bridgeState,
        pluginAge,
      });
    } catch (err) {
      connectivity.setStatus({ api: false });
    } finally {
      stopHealthPoll();
      if (!isAuthenticated) return;
      healthPoll.current = setTimeout(pollHealth, 10000);
    }
  };

  const retryDeadLetters = async () => {
    try {
      await api.retryDeadLetters();
      await fetchDeadLetters();
      logAction("retry-deadletters");
    } catch (err) {
      console.error(err);
    }
  };

  const executeCommand = async (command: string) => {
    try {
      await api.executeCommand(command);
      logAction(`command: ${command}`);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchBots();
      fetchDeadLetters();
      pollHealth();
    } else {
      stopHealthPoll();
    }
    return () => stopHealthPoll();
  }, [isAuthenticated, fetchBots]);

  useEffect(() => {
    on("bot:spawned", (data) => {
      const payload = data as { bot?: BotCardProps["bot"] };
      if (payload.bot) {
        setBots((prev) => [...prev, payload.bot!]);
      }
    });
    on("bot:deleted", (data) => {
      const payload = data as { botId?: string };
      if (payload.botId) {
        setBots((prev) => prev.filter((b) => b.id !== payload.botId));
      }
    });
    on("bot:updated", (data) => {
      const payload = data as { bot?: BotCardProps["bot"] };
      if (payload.bot) {
        setBots((prev) => prev.map((b) => (b.id === payload.bot!.id ? payload.bot! : b)));
      }
    });
    on("deadletter:update", (data) => {
      const payload = data as { queue?: DeadLetterItem[] };
      if (payload.queue) {
        setDeadLetters(payload.queue);
      }
    });
    on("system:status", (data) => {
      const payload = data as Partial<ConnectivityStatus>;
      connectivity.setStatus(payload);
    });
    on("system:log", (data) => {
      const payload = data as LogEntry;
      setLogs(prev => [payload, ...prev].slice(0, 50));
      if (payload.level === 'success' || payload.message.includes('Task completed')) {
        setActions(prev => [{
          id: `action-${Date.now()}`,
          action: payload.message,
          status: (payload.level === 'error' ? 'error' : 'ok') as "error" | "ok",
          timestamp: payload.timestamp
        }, ...prev].slice(0, 20));
      }
    });
    return () => {
      off("bot:spawned");
      off("bot:deleted");
      off("bot:updated");
      off("deadletter:update");
      off("system:status");
      off("system:log");
    };
  }, [on, off, setBots, connectivity]);

  if (!isAuthenticated) {
    return (
      <div className="flex justify-center">
        <LoginDialog onLogin={login} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StatusBar connectivity={connectivity} />
      <ServerControl />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Bots Management */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Swarm Control</h2>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Bot
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create New Agent</DialogTitle>
                </DialogHeader>
                <div className="pt-4">
                  <BotCreator
                    onSubmit={(data) => {
                      createBot(data);
                      setIsCreateOpen(false);
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {connectivity.api ? (
            <BotList
              bots={bots}
              onSpawn={(id) => spawnBot(id)}
              onDespawn={(id) => despawnBot(id)}
              onDelete={(id) => deleteBot(id)}
            />
          ) : (
            <Skeleton className="h-64 w-full" />
          )}

          <DeadLetterQueue
            queue={deadLetters}
            onRetry={retryDeadLetters}
          />
        </div>

        {/* Right Column: Monitoring & Tools */}
        <div className="lg:col-span-5">
          <Tabs defaultValue="monitor" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="monitor">Monitor</TabsTrigger>
              <TabsTrigger value="fleet">Fleet</TabsTrigger>
              <TabsTrigger value="tools">Tools</TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
            </TabsList>

            <TabsContent value="fleet" className="space-y-4 mt-4">
              <AutonomousBots bots={bots} />
            </TabsContent>

            <TabsContent value="monitor" className="space-y-4 mt-4">
              {connectivity.api ? (
                <LiveMap />
              ) : (
                <Skeleton className="h-[500px] w-full" />
              )}
              {connectivity.api ? (
                <ConsoleLog logs={logs} />
              ) : (
                <Skeleton className="h-40 w-full" />
              )}
              {connectivity.api ? (
                <ActionLog actions={actions} />
              ) : (
                <Skeleton className="h-32 w-full" />
              )}
            </TabsContent>

            <TabsContent value="tools" className="space-y-4 mt-4">
              <BotControls />
              <CommandInput onExecute={executeCommand} />
              <InventoryViewer items={[]} botId="miner_01" />
              <ChestManager
                items={[]}
                onDeposit={() => logAction("deposit")}
                onWithdraw={() => logAction("withdraw")}
              />
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 mt-4">
              <div className="flex items-center space-x-4 mb-4">
                <span className="text-sm font-medium">Select Bot to Control:</span>
                <Select value={manualBotId} onValueChange={setManualBotId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Bot" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeBots.length === 0 && <SelectItem value="none" disabled>No active bots</SelectItem>}
                    {activeBots.map(bot => (
                      <SelectItem key={bot.id} value={bot.id}>{bot.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {manualBotId ? (
                <>
                  <KeyboardControls botId={manualBotId} />
                  <BotActions botId={manualBotId} />
                </>
              ) : (
                <div className="text-center text-muted-foreground py-12 border rounded-lg bg-muted/10">
                  Please select an active bot to enable manual controls.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function logAction(action: string) {
  console.log(action);
}
