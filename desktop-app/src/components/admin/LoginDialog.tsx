import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function LoginDialog({ onLogin }: { onLogin: (apiKey: string) => void }) {
  const [apiKey, setApiKey] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Allow empty key for open mode
    onLogin(apiKey.trim() || "open-mode");
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Authenticate</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="apiKey">Admin API Key</Label>
            <Input
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Optional for open servers"
            />
          </div>
          <Button type="submit" className="w-full">
            {apiKey ? "Authenticate" : "Connect as Guest"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
