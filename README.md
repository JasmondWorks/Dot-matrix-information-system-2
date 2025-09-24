ESP8266 Webserver with React UI

This project hosts a simple control UI on an ESP8266. The ESP provides:

- HTTP server that serves the built React app from LittleFS
- WebSocket server on port 81 for real‑time updates
- Access Point (AP) mode by default, with optional STA mode

The frontend is auto‑built and packed into the filesystem before flashing.

Requirements
- PlatformIO (VS Code extension or CLI)
- Node.js 18+ and npm (for building the frontend)

First‑time setup
- Install frontend dependencies:
  - `cd frontend && npm ci`
- Connect the ESP8266 (NodeMCU v2 by default) via USB

Build and upload
- Upload filesystem (serves the UI):
  - `pio run -t uploadfs -e nodemcuv2`
- Upload firmware:
  - `pio run -t upload -e nodemcuv2`
- Combined workflow (filesystem is auto‑rebuilt before either command):
  - The script at `scripts/build_frontend.py` runs `npm run build` in `frontend/`, then gzips files from `frontend/dist` into `data/`.
  - Set `SKIP_FRONTEND=1` to skip rebuilding the UI during firmware iterations.

Example (PowerShell):
- Skip frontend while iterating on C++: `$env:SKIP_FRONTEND=1; pio run -t upload -e nodemcuv2`

Using the app
- Default AP SSID: `ESP8266-UI`  |  Password: `esp8266pass`
- Connect your PC to the AP, then open: `http://192.168.4.1/`
- The UI connects to WebSocket `ws://192.168.4.1:81` automatically when served from the ESP.

Dev mode (Vite)
- Keep your PC connected to the ESP AP
- In `frontend/`: `npm run dev` and open `http://localhost:5173/`
- Vite proxy (see `frontend/vite.config.ts`) forwards:
  - `/api/*` → `http://192.168.4.1`
  - `/ws` → `ws://192.168.4.1:81`

If you switch your PC off the ESP AP, the proxy cannot reach the ESP and you will see 500s and closed WebSocket warnings. Reconnect to the ESP AP.

Wi‑Fi stability notes
- AP only unless real STA credentials are configured. STA scanning can disrupt AP beacons and cause disconnects.
- Wi‑Fi sleep disabled, max TX power, 11n mode for better link stability.
- Fixed AP channel (default 1). Change `AP_CHANNEL` to 6 or 11 if your area is noisy.
- WebSocket heartbeat is enabled to drop dead peers quickly and reconnect.

To enable STA+AP
- Edit `STA_SSID` and `STA_PASS` in `src/main.cpp:26` (replace placeholders). The firmware will enable `WIFI_AP_STA` and auto‑reconnect.

Project layout
- Firmware: `src/main.cpp`
- Frontend app: `frontend/`
- Build script (pre‑build): `scripts/build_frontend.py`
- Filesystem content (generated): `data/` (gzipped assets)

Troubleshooting
- Dev proxy errors (`/api/status 500`, `WS closed`): ensure your PC remains connected to the ESP AP.
- Nothing served at `http://192.168.4.1/`: upload filesystem image (`pio run -t uploadfs -e nodemcuv2`).
- Filesystem too large: gzipping is already enabled; remove large assets or simplify the UI.
- Weak Wi‑Fi: change `AP_CHANNEL`, keep device away from interference, or power via a stable 5V supply/USB port.

License
This project contains third‑party libraries as declared in `platformio.ini`. Add your preferred license here if needed.
# Dot-matrix-information-system-2
