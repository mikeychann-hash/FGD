import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type ChestItem = {
  id: string;
  name: string;
  count: number;
};

export function ChestManager({
  items,
  onDeposit,
  onWithdraw,
}: {
  items: ChestItem[];
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Chest Manager</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onDeposit}>
            Deposit
          </Button>
          <Button size="sm" variant="outline" onClick={onWithdraw}>
            Withdraw
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 text-sm">
        {items.map((item) => (
          <div key={item.id} className="rounded-md border bg-card/40 p-2 flex justify-between">
            <span>{item.name}</span>
            <span className="font-mono">{item.count}x</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
