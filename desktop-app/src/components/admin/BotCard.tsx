import { Activity, Package, Play, Square, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { Bot } from "@/types/bot";

export interface BotCardProps {
  bot: Bot;
  onSpawn: (id: string) => void;
  onDespawn: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BotCard({ bot, onSpawn, onDespawn, onDelete }: BotCardProps) {
  const stateVariant = {
    active: "default",
    inactive: "secondary",
    error: "destructive",
  } as const;

  const stateIcon = {
    active: <Activity className="h-4 w-4 animate-pulse" />,
    inactive: <Square className="h-4 w-4" />,
    error: <Activity className="h-4 w-4 text-destructive" />,
  }[bot.state];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {stateIcon}
          <CardTitle className="text-base">{bot.id}</CardTitle>
        </div>
        <Badge variant={stateVariant[bot.state]}>{bot.state.toUpperCase()}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Package className="h-4 w-4" />
          <span>{bot.role}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">CPU</span>
            <span>{bot.cpu}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Memory</span>
            <span>{bot.memory}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tick</span>
            <span>{bot.tick}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onSpawn(bot.id)}
            disabled={bot.state === "active"}
          >
            <Play className="mr-1 h-3 w-3" />
            Spawn
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onDespawn(bot.id)}
            disabled={bot.state === "inactive"}
          >
            <Square className="mr-1 h-3 w-3" />
            Stop
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="w-full text-destructive"
          onClick={() => onDelete(bot.id)}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          Delete
        </Button>
      </CardContent>
    </Card>
  );
}
