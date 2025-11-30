import { Navigation } from "./Navigation";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

export function Header() {
  const { isAuthenticated, logout } = useAuthStore();

  return (
    <header className="flex items-center justify-between border-b bg-card px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          FGD
        </div>
        <div>
          <p className="text-sm font-semibold">Federation Governance Dashboard</p>
          <p className="text-xs text-muted-foreground">React + Electron</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Navigation />
        <ThemeToggle />
        {isAuthenticated && (
          <Button variant="ghost" size="icon" onClick={logout} title="Disconnect">
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
