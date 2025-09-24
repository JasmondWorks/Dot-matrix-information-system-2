#include <ArduinoJson.h>
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>
#include <LittleFS.h>
#include <WebSocketsServer.h>

// ===== Pins / device state (example) =====
#define RELAY_PIN D1 // adjust for your board
bool relayOn = false;

// ===== Networking =====
const char *AP_SSID = "ESP8266-UI";
const char *AP_PASS = "esp8266pass"; // 8+ chars recommended
const IPAddress AP_IP(192, 168, 4, 1);
const IPAddress AP_GW(192, 168, 4, 1);
const IPAddress AP_MASK(255, 255, 255, 0);
// SoftAP tuning
const uint8_t AP_CHANNEL = 1;  // choose 1, 6 or 11 to avoid overlap
const uint8_t AP_MAX_CONN = 4; // max stations

// Optional STA creds (non-blocking join). Leave as empty strings to disable.
const char *STA_SSID = "HOME_SSID";
const char *STA_PASS = "HOME_PASS";

// ===== Servers =====
ESP8266WebServer server(80);
WebSocketsServer ws(81);
DNSServer dns;

// ===== Wi-Fi credential storage =====
const char *WIFI_CONFIG_PATH = "/wifi.json";
String staSsid;
String staPass;
bool staPersist = false;

// ===== Helpers =====
void addCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods",
                    "GET,POST,PUT,DELETE,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}
void addCache(long secs) {
  server.sendHeader("Cache-Control", "public, max-age=" + String(secs));
}

bool endsWith(const String &str, const String &suffix) {
  if (suffix.length() > str.length())
    return false;
  return str.substring(str.length() - suffix.length()) == suffix;
}

// Serve file (gz first), with SPA fallback handled by caller
bool serveStaticFile(String path) {
  if (endsWith(path, "/"))
    path += "index.html";
  String gz = path + ".gz";
  if (LittleFS.exists(gz))
    path = gz;
  else if (!LittleFS.exists(path))
    return false;

  String type = "text/plain";
  if (endsWith(path, ".html") || endsWith(path, ".html.gz"))
    type = "text/html";
  else if (endsWith(path, ".js") || endsWith(path, ".js.gz"))
    type = "application/javascript";
  else if (endsWith(path, ".css") || endsWith(path, ".css.gz"))
    type = "text/css";
  else if (endsWith(path, ".json") || endsWith(path, ".json.gz"))
    type = "application/json";
  else if (endsWith(path, ".png") || endsWith(path, ".png.gz"))
    type = "image/png";
  else if (endsWith(path, ".svg") || endsWith(path, ".svg.gz"))
    type = "image/svg+xml";
  else if (endsWith(path, ".ico") || endsWith(path, ".ico.gz"))
    type = "image/x-icon";

  File f = LittleFS.open(path, "r");
  if (!f)
    return false;

  addCORS();
  if (type == "text/html")
    addCache(5); // keep index.html fresh
  else
    addCache(31536000); // long cache for hashed assets

  server.streamFile(f, type);
  f.close();
  return true;
}

void sendJson(int code, const String &body) {
  addCORS();
  server.send(code, "application/json", body);
}

void pushState() {
  StaticJsonDocument<256> doc;
  doc["type"] = "state";
  doc["uptime"] = millis() / 1000;
  doc["relay"] = relayOn;
  String out;
  serializeJson(doc, out);
  ws.broadcastTXT(out);
}

// SoftAP helpers keep AP settings consistent whenever the mode flips.
void ensureSoftAP() {
  WiFi.softAPConfig(AP_IP, AP_GW, AP_MASK);
  WiFi.softAP(AP_SSID, AP_PASS, AP_CHANNEL, false, AP_MAX_CONN);
}

void ensureApMode() {
  if (WiFi.getMode() != WIFI_AP) {
    WiFi.mode(WIFI_AP);
  }
  ensureSoftAP();
}

void ensureApStaMode() {
  if (WiFi.getMode() != WIFI_AP_STA) {
    WiFi.mode(WIFI_AP_STA);
  }
  ensureSoftAP();
}

void beginSta(const String &ssid, const String &pass) {
  ensureApStaMode();
  WiFi.setAutoConnect(true);
  WiFi.setAutoReconnect(true);
  const char *passPtr = pass.length() ? pass.c_str() : nullptr;
  WiFi.begin(ssid.c_str(), passPtr);
}

wl_status_t waitForSta(uint32_t timeoutMs) {
  return static_cast<wl_status_t>(WiFi.waitForConnectResult(timeoutMs));
}

String wlStatusToString(wl_status_t status) {
  switch (status) {
  case WL_CONNECTED:
    return "connected";
  case WL_IDLE_STATUS:
    return "idle";
  case WL_NO_SSID_AVAIL:
    return "no_ssid";
  case WL_CONNECT_FAILED:
    return "connect_failed";
  case WL_CONNECTION_LOST:
    return "connection_lost";
  case WL_DISCONNECTED:
    return "disconnected";
  default:
    return String(static_cast<int>(status));
  }
}

String wifiModeToString(WiFiMode_t mode) {
  switch (mode) {
  case WIFI_OFF:
    return "off";
  case WIFI_STA:
    return "sta";
  case WIFI_AP:
    return "ap";
  case WIFI_AP_STA:
    return "ap_sta";
  default:
    return String(static_cast<int>(mode));
  }
}

bool loadStaCredentialsFromFile() {
  File f = LittleFS.open(WIFI_CONFIG_PATH, "r");
  if (!f)
    return false;
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, f);
  f.close();
  if (err)
    return false;
  const char *ssid = doc["ssid"] | "";
  if (!ssid[0])
    return false;
  const char *pass = doc["pass"] | "";
  staSsid = ssid;
  staPass = pass;
  staPersist = true;
  return true;
}

bool saveStaCredentialsToFile(const String &ssid, const String &pass) {
  StaticJsonDocument<256> doc;
  doc["ssid"] = ssid;
  doc["pass"] = pass;
  File f = LittleFS.open(WIFI_CONFIG_PATH, "w");
  if (!f)
    return false;
  if (serializeJson(doc, f) == 0) {
    f.close();
    LittleFS.remove(WIFI_CONFIG_PATH);
    return false;
  }
  f.close();
  staSsid = ssid;
  staPass = pass;
  staPersist = true;
  return true;
}

void clearStaState(bool removeFile) {
  staSsid = "";
  staPass = "";
  staPersist = false;
  if (removeFile && LittleFS.exists(WIFI_CONFIG_PATH)) {
    LittleFS.remove(WIFI_CONFIG_PATH);
  }
}

void buildWifiStatusJson(String &out) {
  StaticJsonDocument<384> doc;
  wl_status_t status = WiFi.status();
  WiFiMode_t mode = WiFi.getMode();

  doc["ok"] = true;
  doc["mode"] = wifiModeToString(mode);
  doc["status"] = wlStatusToString(status);
  bool connected = status == WL_CONNECTED;
  doc["connected"] = connected;
  doc["ssid"] = connected ? WiFi.SSID() : staSsid;
  doc["bssid"] = connected ? WiFi.BSSIDstr() : "";
  doc["ip"] = connected ? WiFi.localIP().toString() : "";
  doc["rssi"] = connected ? WiFi.RSSI() : 0;
  doc["channel"] = connected ? WiFi.channel() : 0;
  doc["apIp"] = WiFi.softAPIP().toString();
  doc["apClients"] = WiFi.softAPgetStationNum();
  doc["hasCreds"] = staSsid.length() > 0;
  doc["persisted"] = staPersist;

  serializeJson(doc, out);
}

// ===== Wi-Fi scan utilities =====
String encToStr(uint8_t e) {
  switch (e) {
  case ENC_TYPE_NONE:
    return "open";
  case ENC_TYPE_WEP:
    return "wep";
  case ENC_TYPE_TKIP:
    return "wpa";
  case ENC_TYPE_CCMP:
    return "wpa2";
  case ENC_TYPE_AUTO:
    return "auto";
  default:
    return String(e);
  }
}

// Build JSON array string of available networks
void buildWifiListJson(String &arrOut) {
  arrOut = "[";
  bool first = true;
  int n = WiFi.scanComplete();
  if (n == WIFI_SCAN_RUNNING || n < 0) {
    n = WiFi.scanNetworks(); // blocking
  }
  for (int i = 0; i < n; i++) {
    if (!first)
      arrOut += ",";
    first = false;
    StaticJsonDocument<256> item;
    item["ssid"] = WiFi.SSID(i);
    item["rssi"] = WiFi.RSSI(i);
    item["ch"] = WiFi.channel(i);
    item["enc"] = encToStr(WiFi.encryptionType(i));
    String it;
    serializeJson(item, it);
    arrOut += it;
  }
  WiFi.scanDelete();
  arrOut += "]";
}

// Run a scan. If we were AP-only, temporarily enable STA then restore.
void runWifiScan(String &listArrayJson) {
  WiFiMode_t mode = WiFi.getMode();
  bool wasAPOnly = (mode == WIFI_AP);
  if (wasAPOnly) {
    ensureApStaMode();
  }
  WiFi.disconnect();
  delay(100);
  WiFi.scanNetworks();
  buildWifiListJson(listArrayJson);
  if (wasAPOnly) {
    ensureApMode();
  }
}

// ===== API & captive portal routes =====
void setupRoutes() {
  // Common captive-portal probes (improves auto-popup)
  server.on("/generate_204", HTTP_ANY, []() {
    server.sendHeader("Location", "http://192.168.4.1/");
    server.send(302, "text/plain", "");
  });
  server.on("/redirect", HTTP_ANY, []() {
    server.sendHeader("Location", "http://192.168.4.1/");
    server.send(302, "text/plain", "");
  });
  server.on("/hotspot-detect.html", HTTP_ANY, []() {
    server.send(200, "text/html",
                "<html><head><meta http-equiv='refresh' content='0; "
                "url=/'/></head></html>");
  });

  // API
  server.on("/api/status", HTTP_GET, []() {
    String sta = WiFi.localIP().toString();
    String ap = WiFi.softAPIP().toString();
    StaticJsonDocument<256> doc;
    doc["ok"] = true;
    doc["staIP"] = sta;
    doc["apIP"] = ap;
    doc["uptime"] = millis() / 1000;
    doc["relay"] = relayOn;
    String out;
    serializeJson(doc, out);
    sendJson(200, out);
  });

  server.on("/api/relay", HTTP_POST, []() {
    // Expect:{"on": true/false}
    String body = server.arg("plain");
    StaticJsonDocument<128> doc;
    auto err = deserializeJson(doc, body);
    if (err) {
      sendJson(400, "{\"error\":\"bad_json\"}");
      return;
    }
    bool on = doc["on"] | false;
    relayOn = on;
    digitalWrite(RELAY_PIN, relayOn ? LOW : HIGH);
    sendJson(200, "{\"ok\":true}");
    pushState();
  });

  server.on("/api/wifi/status", HTTP_GET, []() {
    String out;
    buildWifiStatusJson(out);
    sendJson(200, out);
  });

  // Wi-Fi scan endpoint (blocking; may momentarily disrupt AP)
  server.on("/api/wifi/scan", HTTP_GET, []() {
    String list;
    runWifiScan(list);
    String out = String("{\"ok\":true,\"list\":") + list + "}";
    sendJson(200, out);
  });

  server.on("/api/wifi/connect", HTTP_POST, []() {
    String body = server.arg("plain");
    StaticJsonDocument<256> doc;
    auto err = deserializeJson(doc, body);
    if (err) {
      sendJson(400, "{\"error\":\"bad_json\"}");
      return;
    }
    const char *ssid = doc["ssid"] | "";
    const char *pass = doc["pass"] | "";
    if (!ssid[0]) {
      sendJson(400, "{\"error\":\"missing_ssid\"}");
      return;
    }

    staSsid = ssid;
    staPass = pass;
    staPersist = false;

    beginSta(staSsid, staPass);
    wl_status_t res = waitForSta(15000);
    if (res != WL_CONNECTED) {
      WiFi.setAutoReconnect(false);
    }

    StaticJsonDocument<256> reply;
    reply["ok"] = res == WL_CONNECTED;
    reply["status"] = wlStatusToString(res);
    reply["ssid"] = WiFi.SSID();
    reply["ip"] = WiFi.localIP().toString();
    if (res == WL_CONNECTED) {
      reply["rssi"] = WiFi.RSSI();
    }
    String out;
    serializeJson(reply, out);
    sendJson(res == WL_CONNECTED ? 200 : 500, out);
  });

  server.on("/api/wifi/disconnect", HTTP_POST, []() {
    WiFi.setAutoReconnect(false);
    WiFi.disconnect(false);
    ensureApMode();

    StaticJsonDocument<160> reply;
    reply["ok"] = true;
    reply["status"] = wlStatusToString(WiFi.status());
    String out;
    serializeJson(reply, out);
    sendJson(200, out);
  });

  server.on("/api/wifi/forget", HTTP_POST, []() {
    WiFi.setAutoReconnect(false);
    WiFi.setAutoConnect(false);
    WiFi.disconnect(true);
    clearStaState(true);
    ensureApMode();
    sendJson(200, "{\"ok\":true}");
  });

  server.on("/api/wifi/save", HTTP_POST, []() {
    String body = server.arg("plain");
    StaticJsonDocument<256> doc;
    auto err = deserializeJson(doc, body);
    if (err) {
      sendJson(400, "{\"error\":\"bad_json\"}");
      return;
    }
    const char *ssid = doc["ssid"] | "";
    const char *pass = doc["pass"] | "";
    bool connectNow = doc["connect"] | false;
    if (!ssid[0]) {
      sendJson(400, "{\"error\":\"missing_ssid\"}");
      return;
    }

    bool saved = saveStaCredentialsToFile(String(ssid), String(pass));
    if (!saved) {
      sendJson(500, "{\"error\":\"save_failed\"}");
      return;
    }

    StaticJsonDocument<256> reply;
    reply["ok"] = true;
    reply["saved"] = true;

    if (connectNow) {
      beginSta(staSsid, staPass);
      wl_status_t res = waitForSta(15000);
      reply["connected"] = res == WL_CONNECTED;
      reply["status"] = wlStatusToString(res);
      reply["ip"] = WiFi.localIP().toString();
      if (res == WL_CONNECTED) {
        reply["rssi"] = WiFi.RSSI();
      } else {
        WiFi.setAutoReconnect(true); // keep retrying with saved creds
      }
    }

    String out;
    serializeJson(reply, out);
    sendJson(200, out);
  });

  // Static + SPA fallback + CORS preflight
  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      addCORS();
      server.send(204);
      return;
    }
    if (serveStaticFile(server.uri()))
      return;
    // SPA fallback to /
    if (serveStaticFile("/index.html"))
      return;
    addCORS();
    server.send(404, "text/plain", "Not found");
  });
}

// ===== WebSocket =====
uint32_t lastPush = 0;

void onWsEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t len) {
  if (type == WStype_CONNECTED) {
    ws.sendTXT(num, "{\"type\":\"hello\"}");
    pushState();
  } else if (type == WStype_TEXT) {
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, payload, len);
    if (err)
      return;

    const char *t = doc["type"] | "";
    if (!strcmp(t, "ping")) {
      ws.sendTXT(num, "{\"type\":\"pong\"}");
      return;
    }
    if (!strcmp(t, "setRelay")) {
      bool on = doc["on"] | false;
      relayOn = on;
      digitalWrite(RELAY_PIN, relayOn ? LOW : HIGH);
      pushState();
      return;
    }
    if (!strcmp(t, "wifiScan")) {
      ws.sendTXT(num, "{\"type\":\"wifiScanStart\"}");
      String list;
      runWifiScan(list);
      String out = String("{\"type\":\"wifiList\",\"list\":") + list + "}";
      ws.sendTXT(num, out);
      return;
    }
  }
}

// ===== Setup / loop =====
void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); // relay off (depending on module logic)

  Serial.begin(115200);
  delay(200);

  if (!LittleFS.begin()) {
    Serial.println("LittleFS mount failed");
  } else {
    loadStaCredentialsFromFile();
  }

  // WiFi radio stability tweaks
  WiFi.setSleepMode(WIFI_NONE_SLEEP); // keep radio awake for AP stability
  WiFi.setOutputPower(20.5f);         // max TX power for ESP8266
  WiFi.setPhyMode(WIFI_PHY_MODE_11N); // better throughput / stability

  if (staSsid.length() == 0) {
    bool hasDefault =
        strlen(STA_SSID) > 0 && strcmp(STA_SSID, "HOME_SSID") != 0;
    if (hasDefault) {
      staSsid = STA_SSID;
      staPass = STA_PASS;
      staPersist = false;
    }
  }

  if (staSsid.length() > 0) {
    beginSta(staSsid, staPass);
  } else {
    ensureApMode();
    WiFi.setAutoConnect(false);
    WiFi.setAutoReconnect(false);
  }

  // Captive DNS
  dns.start(53, "*", AP_IP);

  // HTTP + WS
  setupRoutes();
  server.begin();
  ws.begin();
  ws.onEvent(onWsEvent);
  // Detect dead peers and recover quicker
  ws.enableHeartbeat(15000, 3000, 2); // ping interval, timeout, max misses

  Serial.println("Ready:");
  Serial.print("  AP SSID: ");
  Serial.println(AP_SSID);
  Serial.print("  AP IP:   ");
  Serial.println(WiFi.softAPIP());
  Serial.println("  HTTP:    http://192.168.4.1/");
  Serial.println("  WS:      ws://192.168.4.1:81");
}

void loop() {
  dns.processNextRequest();
  server.handleClient();
  ws.loop();

  // periodic broadcast
  if (millis() - lastPush > 1000) {
    lastPush = millis();
    pushState();
  }
}
