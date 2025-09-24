import type { ReactNode } from "react";

import SidebarNav from "@/components/layout/SidebarNav";
import TopBar from "@/components/layout/TopBar";

const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-screen bg-muted/40 text-foreground">
      <SidebarNav />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-background px-4 py-6 md:px-10 md:py-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;

