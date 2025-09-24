// vite.config.ts
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const ESP_HTTP = "http://192.168.4.1";
const ESP_WS = "ws://192.168.4.1:81";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Forward REST calls to the ESP as-is (ESP serves /api/* routes)
      "/api": { target: ESP_HTTP, changeOrigin: true },
      // Forward WS to ESP:81 and strip the /ws prefix since ESP listens at root
      "/ws": {
        target: ESP_WS,
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ws/, ""),
      },
    },
  },
});
