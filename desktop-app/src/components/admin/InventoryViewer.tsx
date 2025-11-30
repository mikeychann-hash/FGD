import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export type InventoryItem = {
  slot: number;
  name: string;
  count: number;
};

export function InventoryViewer({
  items,
  botId,
}: {
  items: InventoryItem[];
  botId?: string;
}) {
  return (
    <Card className="h-[260px]">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          Inventory {botId ? `(${botId})` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[200px] px-4 pb-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {items.map((item) => (
              <div
                key={item.slot}
                className="rounded-md border bg-card/40 p-2 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Slot {item.slot}</p>
                </div>
                <span className="font-mono text-sm">{item.count}x</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
