import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface CreateBotData {
  name: string;
  role: string;
  description?: string;
}

export function BotCreator({ onSubmit }: { onSubmit: (data: CreateBotData) => void }) {
  const [form, setForm] = useState<CreateBotData>({ name: "", role: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    onSubmit(form);
    setSubmitting(false);
    setForm({ name: "", role: "", description: "" });
  };

  return (
    <div className="grid gap-4 py-4">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="name">Bot Name</Label>
          <Input
            id="name"
            required
            value={form.name}
            placeholder="miner_01"
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Input
            id="role"
            required
            value={form.role}
            placeholder="miner / builder / explorer"
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            placeholder="Describe purpose..."
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creating..." : "Create Bot"}
        </Button>
      </form>
    </div>
  );
}
