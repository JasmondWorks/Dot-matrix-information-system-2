import { BrowserRouter, Route, Routes } from "react-router-dom";

import AppLayout from "@/components/layout/AppLayout";
import { routes } from "@/lib/constants";
import type { RouteDefinition } from "@/lib/types";
import { AppDataProvider } from "@/state/AppDataContext";

export default function App() {
  return (
    <BrowserRouter>
      <AppDataProvider>
        <Routes>
          {routes.map((route: RouteDefinition) => (
            <Route
              key={route.path}
              path={route.path}
              element={<AppLayout>{route.page}</AppLayout>}
            />
          ))}
        </Routes>
      </AppDataProvider>
    </BrowserRouter>
  );
}

