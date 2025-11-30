import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type DeadLetterItem = {
  id: string;
  reason: string;
  createdAt: string;
};

export function DeadLetterQueue({
  queue,
  onRetry,
}: {
  queue: DeadLetterItem[];
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Dead Letter Queue</CardTitle>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry All
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {queue.length === 0 ? (
          <p className="text-muted-foreground">No dead letters. Great job!</p>
        ) : (
          queue.map((item) => (
            <div
              key={item.id}
              className="rounded-md border bg-card/40 p-2 text-xs flex justify-between gap-2"
            >
              <div>
                <p className="font-medium text-foreground">{item.id}</p>
                <p className="text-muted-foreground">{item.reason}</p>
              </div>
              <span className="text-muted-foreground whitespace-nowrap">
                {new Date(item.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
