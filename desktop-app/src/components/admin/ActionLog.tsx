import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export type ActionEntry = {
  id: string;
  action: string;
  status: "ok" | "error";
  timestamp: string;
};

export function ActionLog({ actions }: { actions: ActionEntry[] }) {
  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Action Log</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          <div className="space-y-2 text-sm">
            {actions.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-md border bg-card/40 p-2"
              >
                <div>
                  <p className="font-medium">{entry.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <span
                  className={
                    entry.status === "ok" ? "text-green-500 font-semibold" : "text-red-500 font-semibold"
                  }
                >
                  {entry.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
