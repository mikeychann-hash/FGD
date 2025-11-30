import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Info, Terminal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";

export type LogEntry = {
  id: string;
  message: string;
  timestamp: string;
  level: "info" | "success" | "error" | "warning";
};

export function ConsoleLog({ logs }: { logs: LogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  const levelConfig = {
    info: { icon: Info, color: "text-blue-400", variant: "secondary" as const },
    success: { icon: CheckCircle, color: "text-green-400", variant: "default" as const },
    error: { icon: AlertCircle, color: "text-red-400", variant: "destructive" as const },
    warning: { icon: AlertCircle, color: "text-yellow-400", variant: "secondary" as const },
  };

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Terminal className="h-4 w-4" />
          Console Log
        </CardTitle>
        <Badge variant="secondary">{logs.length} entries</Badge>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea ref={scrollRef} className="h-full px-4 pb-4">
          <div className="space-y-2 font-mono text-xs">
            <AnimatePresence initial={false}>
              {logs.map((log) => {
                const cfg = levelConfig[log.level];
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start gap-2 rounded-md border bg-card/40 p-2"
                  >
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                    <span className="text-muted-foreground min-w-[80px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <p className="text-foreground flex-1 break-all">{log.message}</p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
