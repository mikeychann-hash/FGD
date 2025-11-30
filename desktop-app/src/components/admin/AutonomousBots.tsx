import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Bot as BotIcon, Brain, MapPin } from "lucide-react";

import type { Bot } from "@/types/bot";

interface AutonomousBotsProps {
    bots: Bot[];
}

export const AutonomousBots: React.FC<AutonomousBotsProps> = ({ bots }) => {
    const { toast } = useToast();

    const toggleAutonomy = async (botId: string, currentStatus: boolean) => {
        try {
            await api.toggleBotAutonomy(botId, !currentStatus);
            toast({
                title: !currentStatus ? "Autonomy Enabled" : "Autonomy Disabled",
                description: `Bot ${botId} is now ${!currentStatus ? "autonomous" : "idle"}.`
            });
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Failed to update bot" });
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight">Autonomous Fleet</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bots.map((bot) => {
                    // Determine autonomy based on behaviorPreset if available, or status
                    const preset = bot.metadata?.behaviorPreset || bot.behaviorPreset;
                    const isAutonomous = preset ? preset !== 'idle' : bot.status !== 'inactive';

                    return (
                        <Card key={bot.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {bot.role} <span className="text-xs text-muted-foreground">({bot.id.substring(0, 6)})</span>
                                </CardTitle>
                                <BotIcon className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Badge variant={bot.status === 'active' || bot.state === 'active' ? 'default' : 'secondary'}>
                                            {bot.status || bot.state}
                                        </Badge>
                                        {bot.position && (
                                            <span className="text-xs text-muted-foreground flex items-center">
                                                <MapPin className="h-3 w-3 mr-1" />
                                                {Math.round(bot.position.x)}, {Math.round(bot.position.y)}, {Math.round(bot.position.z)}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <span className="text-sm font-medium flex items-center">
                                            <Brain className={`h-4 w-4 mr-2 ${isAutonomous ? "text-purple-500" : "text-gray-400"}`} />
                                            Autonomy
                                        </span>
                                        <Button
                                            variant={isAutonomous ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => toggleAutonomy(bot.id, isAutonomous)}
                                        >
                                            {isAutonomous ? "On" : "Off"}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
                {bots.length === 0 && (
                    <div className="col-span-full text-center py-10 text-muted-foreground">
                        No bots found. Spawn some to get started.
                    </div>
                )}
            </div>
        </div>
    );
};
