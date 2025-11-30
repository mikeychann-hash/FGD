import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/admin", label: "Admin" },
  { to: "/fusion", label: "Fusion" },
];

export function Navigation() {
  return (
    <nav className="flex items-center gap-4">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            cn(
              "text-sm font-medium text-muted-foreground transition hover:text-foreground",
              isActive && "text-foreground",
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
