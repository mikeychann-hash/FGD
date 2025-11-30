import { useState } from "react";
import { useBotStore } from "@/stores/botStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { Move, MessageSquare, Pickaxe, Hand, Sword, Hammer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function BotControls() {
  const { bots } = useBotStore();
  const { toast } = useToast();
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  
  // Action states
  const [chatMessage, setChatMessage] = useState("");
  const [mineBlock, setMineBlock] = useState("stone");
  const [coords, setCoords] = useState({ x: "", y: "", z: "" });
  const [entityType, setEntityType] = useState("zombie");
  const [craftItem, setCraftItem] = useState("stick");

  const activeBots = bots.filter(b => b.state === "active");

  const handleAction = async (actionFn: () => Promise<any>, successMessage: string) => {
    if (!selectedBotId) {
      toast({ title: "No bot selected", variant: "destructive" });
      return;
    }
    try {
      await actionFn();
      toast({ title: "Success", description: successMessage });
    } catch (err: any) {
      toast({ 
        title: "Action Failed", 
        description: err.response?.data?.error || err.message, 
        variant: "destructive" 
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span>Direct Controls</span>
          <Select value={selectedBotId} onValueChange={setSelectedBotId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Bot" />
            </SelectTrigger>
            <SelectContent>
              {activeBots.length === 0 && <SelectItem value="none" disabled>No active bots</SelectItem>}
              {activeBots.map(bot => (
                <SelectItem key={bot.id} value={bot.id}>{bot.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="move">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="move"><Move className="h-4 w-4"/></TabsTrigger>
            <TabsTrigger value="mine"><Pickaxe className="h-4 w-4"/></TabsTrigger>
            <TabsTrigger value="combat"><Sword className="h-4 w-4"/></TabsTrigger>
            <TabsTrigger value="craft"><Hammer className="h-4 w-4"/></TabsTrigger>
            <TabsTrigger value="chat"><MessageSquare className="h-4 w-4"/></TabsTrigger>
            <TabsTrigger value="interact"><Hand className="h-4 w-4"/></TabsTrigger>
          </TabsList>

          <TabsContent value="move" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>X</Label>
                <Input value={coords.x} onChange={e => setCoords({...coords, x: e.target.value})} />
              </div>
              <div>
                <Label>Y</Label>
                <Input value={coords.y} onChange={e => setCoords({...coords, y: e.target.value})} />
              </div>
              <div>
                <Label>Z</Label>
                <Input value={coords.z} onChange={e => setCoords({...coords, z: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                className="flex-1" 
                onClick={() => handleAction(
                  () => api.moveBot(selectedBotId, { 
                    x: Number(coords.x), 
                    y: Number(coords.y), 
                    z: Number(coords.z) 
                  }),
                  `Moving ${selectedBotId} to ${coords.x}, ${coords.y}, ${coords.z}`
                )}
              >
                Go to Coords
              </Button>
              <Button variant="secondary" onClick={() => handleAction(
                  () => api.combatBot(selectedBotId, "target", { entityType: "player", range: 64 }),
                  `Following player`
                )}>
                Follow Me
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="mine" className="space-y-4 mt-4">
            <div>
              <Label>Block Type</Label>
              <Input value={mineBlock} onChange={e => setMineBlock(e.target.value)} placeholder="diamond_ore" />
            </div>
            <Button 
              className="w-full" 
              onClick={() => handleAction(
                () => api.mineBot(selectedBotId, mineBlock),
                `Ordered ${selectedBotId} to mine ${mineBlock}`
              )}
            >
              Start Mining
            </Button>
          </TabsContent>

          <TabsContent value="combat" className="space-y-4 mt-4">
            <div>
              <Label>Target Entity</Label>
              <Input value={entityType} onChange={e => setEntityType(e.target.value)} placeholder="zombie" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="destructive" onClick={() => handleAction(
                () => api.combatBot(selectedBotId, "attack", { entityType }),
                `Attacking ${entityType}`
              )}>
                Attack
              </Button>
              <Button variant="outline" onClick={() => handleAction(
                () => api.combatBot(selectedBotId, "defend", {}),
                `Defending`
              )}>
                Defend
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="craft" className="space-y-4 mt-4">
            <div>
              <Label>Item Name</Label>
              <Input value={craftItem} onChange={e => setCraftItem(e.target.value)} placeholder="stick" />
            </div>
            <Button className="w-full" onClick={() => handleAction(
                () => api.craftBot(selectedBotId, craftItem),
                `Crafting ${craftItem}`
              )}>
              Craft Item
            </Button>
          </TabsContent>

          <TabsContent value="chat" className="space-y-4 mt-4">
            <div>
              <Label>Message</Label>
              <Input value={chatMessage} onChange={e => setChatMessage(e.target.value)} placeholder="Hello world" />
            </div>
            <Button 
              className="w-full" 
              onClick={() => handleAction(
                () => api.chatBot(selectedBotId, chatMessage),
                `Sent chat as ${selectedBotId}`
              )}
            >
              Send Message
            </Button>
          </TabsContent>

          <TabsContent value="interact" className="space-y-4 mt-4">
             <div className="grid grid-cols-2 gap-2">
               <Button variant="outline" onClick={() => handleAction(
                 () => api.actionBot(selectedBotId, "stop"), "Stopped"
               )}>
                 Stop All
               </Button>
               <Button variant="outline" onClick={() => handleAction(
                 () => api.actionBot(selectedBotId, "drop_all"), "Dropped inventory"
               )}>
                 Drop Inventory
               </Button>
             </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
