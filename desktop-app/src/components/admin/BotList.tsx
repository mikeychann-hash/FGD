import { BotCard, type BotCardProps } from "./BotCard";
import { ScrollArea } from "@/components/ui/scroll-area";

export function BotList({
  bots,
  onSpawn,
  onDespawn,
  onDelete,
}: {
  bots: BotCardProps["bot"][];
  onSpawn: (id: string) => void;
  onDespawn: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ScrollArea className="h-[650px] pr-2">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {bots.map((bot) => (
          <BotCard
            key={bot.id}
            bot={bot}
            onSpawn={onSpawn}
            onDespawn={onDespawn}
            onDelete={onDelete}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
