import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ClusterNode {
  name: string;
  status: "healthy" | "warning" | "offline";
  cpu: number;
  memory: number;
  tasks: number;
}

export function ClusterGrid({ nodes }: { nodes: ClusterNode[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {nodes.map((node) => (
        <Card key={node.name} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">{node.name}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge
              variant={
                node.status === "healthy"
                  ? "default"
                  : node.status === "warning"
                  ? "secondary"
                  : "destructive"
              }
            >
              {node.status.toUpperCase()}
            </Badge>
            <div className="space-y-2 text-sm">
              <Metric label="CPU" value={`${node.cpu}%`} />
              <Metric label="Memory" value={`${node.memory}%`} />
              <Metric label="Tasks" value={node.tasks.toString()} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}
