ESP8266 React Frontend

This folder contains the React UI that is served by the ESP8266 from LittleFS once built.

Quick start
- Install deps: `npm ci`
- Dev server: `npm run dev` then open `http://localhost:5173/`
  - Keep your PC connected to the ESP AP so the proxy can reach `192.168.4.1`.
- Production build: `npm run build` (normally invoked automatically by PlatformIO pre-build script)

Vite proxy
- REST: requests to `/api/*` are forwarded to `http://192.168.4.1`
- WebSocket: connections to `/ws` are forwarded to `ws://192.168.4.1:81`

Deploying to the ESP
- PlatformIO runs `scripts/build_frontend.py` which builds into `dist/`, gzips files, and places them in the project `data/` folder.
- Flash with `pio run -t uploadfs -e nodemcuv2`.

WebSocket URL selection
- When served from `http://192.168.4.1/`, the app connects directly to `ws://192.168.4.1:81`.
- When served by Vite on `localhost`, it connects to `/ws` (proxied to the ESP).

Troubleshooting
- If you see 500s or `WebSocket is closed`, ensure your PC is connected to the ESP AP; otherwise the proxy cannot reach the ESP.
