import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function CommandInput({ onExecute }: { onExecute: (command: string) => void }) {
  const [command, setCommand] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    onExecute(command.trim());
    setCommand("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Command Input</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex items-center gap-2" onSubmit={handleSubmit}>
          <Input
            placeholder="type a server command"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
          />
          <Button type="submit" variant="outline">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
