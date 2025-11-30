import { useEffect, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronsUp, Footprints } from "lucide-react";

interface KeyboardControlsProps {
    botId: string;
}

export function KeyboardControls({ botId }: KeyboardControlsProps) {
    const { emit, on, off, isConnected } = useWebSocket();
    const [activeControls, setActiveControls] = useState<Record<string, boolean>>({});
    const [botState, setBotState] = useState<any>(null);

    const getControlFromKey = (key: string) => {
        switch (key.toLowerCase()) {
            case "w": case "arrowup": return "forward";
            case "s": case "arrowdown": return "back";
            case "a": case "arrowleft": return "left";
            case "d": case "arrowright": return "right";
            case " ": return "jump";
            case "shift": return "sneak";
            case "control": return "sprint";
            default: return null;
        }
    };

    // Handle key events
    useEffect(() => {
        if (!botId) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const control = getControlFromKey(e.key);
            if (control) {
                if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
                    e.preventDefault();
                }
                if (!activeControls[control]) {
                    emit("control:set", { botId, control, state: true });
                    setActiveControls(prev => ({ ...prev, [control]: true }));
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const control = getControlFromKey(e.key);
            if (control) {
                emit("control:set", { botId, control, state: false });
                setActiveControls(prev => ({ ...prev, [control]: false }));
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [botId, activeControls, emit]);

    // Handle session start/stop and state updates
    useEffect(() => {
        if (!botId || !isConnected) return;

        emit("control:session:start", { botId });

        const handleStateUpdate = (data: any) => {
            if (data.botId === botId) {
                setBotState(data);
            }
        };

        on("bot:state_update", handleStateUpdate);

        return () => {
            emit("control:session:stop", { botId });
            off("bot:state_update");
        };
    }, [botId, isConnected, emit, on, off]);

    const ControlKey = ({ label, control, icon: Icon }: any) => (
        <div className={`flex flex-col items-center justify-center w-16 h-16 border rounded-md transition-colors ${activeControls[control] ? "bg-primary text-primary-foreground" : "bg-secondary"
            }`}>
            {Icon && <Icon className="w-6 h-6 mb-1" />}
            <span className="text-xs font-bold">{label}</span>
        </div>
    );

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-sm font-semibold">
                    Manual Control (WASD)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {!botId ? (
                    <div className="text-center text-muted-foreground py-8">
                        Select a bot to enable keyboard controls
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col items-center gap-2 select-none">
                            <ControlKey label="W" control="forward" icon={ArrowUp} />
                            <div className="flex gap-2">
                                <ControlKey label="A" control="left" icon={ArrowLeft} />
                                <ControlKey label="S" control="back" icon={ArrowDown} />
                                <ControlKey label="D" control="right" icon={ArrowRight} />
                            </div>
                            <div className="flex gap-2 mt-2">
                                <ControlKey label="Space" control="jump" icon={ChevronsUp} />
                                <ControlKey label="Shift" control="sneak" icon={Footprints} />
                            </div>
                        </div>

                        {botState && (
                            <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
                                <div>
                                    <span className="text-muted-foreground">Position:</span>
                                    <div className="font-mono">
                                        X: {botState.position.x.toFixed(1)}<br />
                                        Y: {botState.position.y.toFixed(1)}<br />
                                        Z: {botState.position.z.toFixed(1)}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Status:</span>
                                    <div className="flex gap-2 mt-1">
                                        <Badge variant={botState.health > 10 ? "default" : "destructive"}>
                                            Health: {Math.round(botState.health)}
                                        </Badge>
                                        <Badge variant="secondary">
                                            Food: {Math.round(botState.food)}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="text-xs text-center text-muted-foreground">
                            Click anywhere in the window to use controls.
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
