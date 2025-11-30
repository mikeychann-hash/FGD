import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Layers, MessageCircle, Sparkles } from "lucide-react";

export type FusionRecord = {
  id: string;
  category: "skill" | "dialogue" | "outcome";
  detail: string;
  timestamp?: string;
  confidence?: number;
};

export function FusionDataViewer({ items }: { items: FusionRecord[] }) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "skill" | "dialogue" | "outcome">("all");

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.detail.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === "all" || item.category === activeTab;
    return matchesSearch && matchesTab;
  });

  const skillCount = items.filter((i) => i.category === "skill").length;
  const dialogueCount = items.filter((i) => i.category === "dialogue").length;
  const outcomeCount = items.filter((i) => i.category === "outcome").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fusion data..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            All ({items.length})
          </TabsTrigger>
          <TabsTrigger value="skill">
            <Layers className="mr-1 h-3 w-3" />
            Skills ({skillCount})
          </TabsTrigger>
          <TabsTrigger value="dialogue">
            <MessageCircle className="mr-1 h-3 w-3" />
            Dialogues ({dialogueCount})
          </TabsTrigger>
          <TabsTrigger value="outcome">
            <Sparkles className="mr-1 h-3 w-3" />
            Outcomes ({outcomeCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                {activeTab === "all" ? "All Fusion Data" : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}s`}
                <span className="ml-2 text-muted-foreground">({filteredItems.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px] px-4 pb-4">
                {filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <p className="text-sm">No fusion data found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredItems.map((item) => (
                      <FusionCard key={item.id} record={item} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FusionCard({ record }: { record: FusionRecord }) {
  const categoryColors = {
    skill: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    dialogue: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    outcome: "bg-green-500/10 text-green-500 border-green-500/20",
  };

  const categoryIcons = {
    skill: <Layers className="h-3 w-3" />,
    dialogue: <MessageCircle className="h-3 w-3" />,
    outcome: <Sparkles className="h-3 w-3" />,
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2 hover:bg-accent/50 transition-colors">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className={`${categoryColors[record.category]} flex items-center gap-1`}>
          {categoryIcons[record.category]}
          {record.category}
        </Badge>
        {record.confidence && (
          <span className="text-xs text-muted-foreground">
            {Math.round(record.confidence * 100)}% confidence
          </span>
        )}
      </div>
      <p className="text-sm text-foreground leading-relaxed">{record.detail}</p>
      {record.timestamp && (
        <p className="text-xs text-muted-foreground">
          {new Date(record.timestamp).toLocaleString()}
        </p>
      )}
    </div>
  );
}
