import { NavLink } from "react-router-dom";

import { navItems } from "@/lib/constants";
import { cn } from "@/lib/utils";

const SidebarNav = () => {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
      <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">
          PS
        </div>
        <div>
          <p className="text-base font-semibold">PixelSign Studio</p>
          <p className="text-xs text-muted-foreground">ESP8266 message hub</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-6 text-sm">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition hover:bg-sidebar-accent",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-muted-foreground"
                )
              }
              end={item.path === "/"}
            >
              {Icon ? <Icon className="size-4" /> : null}
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="px-6 py-6 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Phase 1</p>
        <p>Configure messages over local AP. Cloud sync arrives next.</p>
      </div>
    </aside>
  );
};

export default SidebarNav;

