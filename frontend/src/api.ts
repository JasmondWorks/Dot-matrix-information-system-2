// src/api.ts

export const api = {
  async status() {
    const res = await fetch("/api/status");
    if (!res.ok) throw new Error("status failed");
    return res.json();
  },
  async relay(on: boolean) {
    const res = await fetch("/api/relay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on }),
    });
    if (!res.ok) throw new Error("relay failed");
    return res.json();
  },
  async saveConfig(payload: unknown) {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("save failed");
    return res.json();
  },
  async wifiScan() {
    const res = await fetch("/api/wifi/scan");
    if (!res.ok) throw new Error("wifi scan failed");
    return res.json(); // { ok, list: [{ssid,rssi,ch,enc}] }
  },
  async wifiConnect(ssid: string, pass: string) {
    const res = await fetch("/api/wifi/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ssid, pass }),
    });
    if (!res.ok) throw new Error("wifi connection failed");
    return res.json();
  },
  async wifiDisconnect() {
    const res = await fetch("/api/wifi/disconnect", {
      method: "POST",
    });
    if (!res.ok) throw new Error("wifi disconnection failed");
    return res.json();
  },
};
