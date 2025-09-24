import { Menu } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/constants";
import { cn } from "@/lib/utils";

const MobileNav = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button
        variant="outline"
        size="icon"
        aria-label="Toggle navigation"
        onClick={() => setOpen((value) => !value)}
      >
        <Menu className="size-5" />
      </Button>
      {open ? (
        <div className="absolute left-0 right-0 top-16 z-30 border-b border-border bg-background/95 backdrop-blur">
          <nav className="flex flex-col gap-1 px-4 py-3 text-sm">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 font-medium",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
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
        </div>
      ) : null}
    </div>
  );
};

export default MobileNav;

