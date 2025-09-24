#include <ArduinoJson.h>
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>
#include <ESP.h>
#include <LittleFS.h>
#include <WebSocketsServer.h>
#include <algorithm>
#include <time.h>
#include <vector>

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

struct DeviceSettingsData {
  bool dateDisplayEnabled = true;
  bool calendarVisible = true;
  String ledColor = "#FF5A5F";
  String font = "Orbitron";
  bool soundEnabled = true;
};

struct MessageRecord {
  String id;
  String title;
  String body;
  String soundFileId;
  bool soundEnabled = false;
  String scrollSpeed;
  String animation;
  int durationSec = 0;
  int numScrolls = 0;
  bool muted = true;
  String createdAt;
  String updatedAt;
  std::vector<String> tags;
};

struct ScheduleRecord {
  String id;
  String messageId;
  std::vector<String> days;
  std::vector<String> specificDates;
  String time;
  String timezone;
  String nextRunAt;
  bool enabled = true;
  String recurrenceSummary;
};

struct LogEntry {
  String id;
  String messageId;
  String title;
  String body;
  String status;
  String createdAt;
};

DeviceSettingsData deviceSettings;
std::vector<MessageRecord> messageStore;
std::vector<ScheduleRecord> scheduleStore;
std::vector<LogEntry> logEntries;

MessageRecord currentMessage;
bool hasCurrentMessage = false;
int currentScrollsDone = 0;
int currentTimeLeftSec = 0;

const size_t MAX_LOG_ENTRIES = 20;
const size_t MAX_MESSAGES = 20;
const size_t MAX_SCHEDULES = 20;

const int CAP_MAX_CHARS = 32;
const bool CAP_SUPPORTS_SOUND = true;
const bool CAP_SUPPORTS_MULTI = false;

String deviceName = "PixelSign-01";
int batteryPercentage = 78;

uint64_t rtcEpochBaseMs = 0;
uint32_t rtcBaseMillis = 0;

String lastPairingChallenge;
String deviceToken;
String claimedUserId;

String deviceId = String(ESP.getChipId(), HEX);

// ===== Helpers =====
template <typename T>
void clampVectorSize(std::vector<T> &vec, size_t maxSize) {
  if (vec.size() <= maxSize) {
    return;
  }
  vec.erase(vec.begin(), vec.begin() + (vec.size() - maxSize));
}

int weekdayIndexFromString(const String &day) {
  if (day.equalsIgnoreCase("Sun")) return 0;
  if (day.equalsIgnoreCase("Mon")) return 1;
  if (day.equalsIgnoreCase("Tue")) return 2;
  if (day.equalsIgnoreCase("Wed")) return 3;
  if (day.equalsIgnoreCase("Thu")) return 4;
  if (day.equalsIgnoreCase("Fri")) return 5;
  if (day.equalsIgnoreCase("Sat")) return 6;
  return -1;
}

bool timeStringToParts(const String &value, int &hour, int &minute) {
  if (!value.length()) {
    hour = 0;
    minute = 0;
    return false;
  }
  int sep = value.indexOf(':');
  if (sep < 0) {
    return false;
  }
  hour = value.substring(0, sep).toInt();
  minute = value.substring(sep + 1).toInt();
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return false;
  }
  return true;
}

String joinStrings(const std::vector<String> &values, const char *delimiter) {
  String result;
  for (size_t i = 0; i < values.size(); ++i) {
    if (i > 0) {
      result += delimiter;
    }
    result += values[i];
  }
  return result;
}

uint64_t currentEpochMs() {
  if (rtcEpochBaseMs == 0) {
    return static_cast<uint64_t>(millis());
  }
  uint32_t elapsed = millis() - rtcBaseMillis;
  return rtcEpochBaseMs + static_cast<uint64_t>(elapsed);
}

String isoFromEpoch(uint64_t epochMs) {
  time_t seconds = epochMs / 1000ULL;
  struct tm *info = gmtime(&seconds);
  if (!info) {
    char fallback[24];
    snprintf(fallback, sizeof(fallback), "%llu", static_cast<unsigned long long>(epochMs));
    return String(fallback);
  }
  char buffer[32];
  snprintf(buffer, sizeof(buffer), "%04d-%02d-%02dT%02d:%02d:%02dZ",
           info->tm_year + 1900, info->tm_mon + 1, info->tm_mday,
           info->tm_hour, info->tm_min, info->tm_sec);
  return String(buffer);
}

String isoNow() {
  return isoFromEpoch(currentEpochMs());
}

String generateId(const char *prefix) {
  char buffer[40];
  unsigned long now = millis();
  uint16_t entropy = static_cast<uint16_t>(random(0xFFFF));
  snprintf(buffer, sizeof(buffer), "%s-%lu-%04u", prefix, now, entropy);
  return String(buffer);
}

String excerptFromBody(const String &body) {
  if (body.length() <= 64) {
    return body;
  }
  return body.substring(0, 64);
}

void ensureTagPresent(std::vector<String> &tags, const String &tag) {
  if (std::find(tags.begin(), tags.end(), tag) == tags.end()) {
    tags.push_back(tag);
  }
}

void removeTag(std::vector<String> &tags, const String &tag) {
  auto it = std::remove_if(tags.begin(), tags.end(), [&](const String &entry) {
    return entry.equalsIgnoreCase(tag);
  });
  tags.erase(it, tags.end());
}

void messageToJson(const MessageRecord &msg, JsonObject obj) {
  obj["id"] = msg.id;
  obj["title"] = msg.title;
  obj["body"] = msg.body;
  if (msg.soundFileId.length()) {
    obj["soundFileId"] = msg.soundFileId;
  }
  obj["soundEnabled"] = msg.soundEnabled;
  obj["scrollSpeed"] = msg.scrollSpeed;
  obj["animation"] = msg.animation;
  if (msg.durationSec > 0) {
    obj["durationSec"] = msg.durationSec;
  }
  if (msg.numScrolls > 0) {
    obj["numScrolls"] = msg.numScrolls;
  }
  obj["muted"] = msg.muted;
  obj["createdAt"] = msg.createdAt;
  obj["updatedAt"] = msg.updatedAt;
  JsonArray tagsArray = obj.createNestedArray("tags");
  for (const auto &tag : msg.tags) {
    tagsArray.add(tag);
  }
}

void scheduleToJson(const ScheduleRecord &schedule, JsonObject obj) {
  obj["id"] = schedule.id;
  obj["messageId"] = schedule.messageId;
  if (!schedule.days.empty()) {
    JsonArray daysArray = obj.createNestedArray("days");
    for (const auto &day : schedule.days) {
      daysArray.add(day);
    }
  }
  if (!schedule.specificDates.empty()) {
    JsonArray datesArray = obj.createNestedArray("specificDates");
    for (const auto &date : schedule.specificDates) {
      datesArray.add(date);
    }
  }
  if (schedule.time.length()) {
    obj["time"] = schedule.time;
  }
  if (schedule.timezone.length()) {
    obj["timezone"] = schedule.timezone;
  }
  if (schedule.nextRunAt.length()) {
    obj["nextRunAt"] = schedule.nextRunAt;
  }
  obj["enabled"] = schedule.enabled;
  if (schedule.recurrenceSummary.length()) {
    obj["recurrenceSummary"] = schedule.recurrenceSummary;
  }
}

void settingsToJson(JsonObject obj) {
  obj["dateDisplayEnabled"] = deviceSettings.dateDisplayEnabled;
  obj["calendarVisible"] = deviceSettings.calendarVisible;
  obj["ledColor"] = deviceSettings.ledColor;
  obj["font"] = deviceSettings.font;
  obj["soundEnabled"] = deviceSettings.soundEnabled;
}

String computeRecurrenceSummary(const ScheduleRecord &schedule) {
  if (!schedule.specificDates.empty()) {
    String summary = joinStrings(schedule.specificDates, ", ");
    if (schedule.time.length()) {
      summary += " at ";
      summary += schedule.time;
    }
    return summary;
  }
  if (!schedule.days.empty()) {
    String summary = joinStrings(schedule.days, ", ");
    if (schedule.time.length()) {
      summary += " at ";
      summary += schedule.time;
    }
    return summary;
  }
  if (schedule.time.length()) {
    return String("Daily at ") + schedule.time;
  }
  return String("Custom schedule");
}

String computeNextRunAtApprox(ScheduleRecord &schedule) {
  if (!schedule.specificDates.empty()) {
    String earliest = schedule.specificDates[0];
    for (const auto &candidate : schedule.specificDates) {
      if (candidate < earliest) {
        earliest = candidate;
      }
    }
    String timePart = schedule.time.length() ? schedule.time : String("00:00");
    schedule.nextRunAt = earliest + "T" + timePart + ":00Z";
    return schedule.nextRunAt;
  }
  if (!schedule.days.empty() && rtcEpochBaseMs != 0) {
    uint64_t nowMs = currentEpochMs();
    time_t nowSec = nowMs / 1000ULL;
    struct tm *info = gmtime(&nowSec);
    if (info) {
      int currentDow = info->tm_wday;
      int hour = 0;
      int minute = 0;
      timeStringToParts(schedule.time, hour, minute);
      int targetSeconds = hour * 3600 + minute * 60;
      int bestDiff = 8;
      for (const auto &day : schedule.days) {
        int idx = weekdayIndexFromString(day);
        if (idx < 0) {
          continue;
        }
        int diff = (idx - currentDow + 7) % 7;
        if (diff == 0) {
          int nowSeconds = info->tm_hour * 3600 + info->tm_min * 60 + info->tm_sec;
          if (targetSeconds <= nowSeconds) {
            diff = 7;
          }
        }
        if (diff < bestDiff) {
          bestDiff = diff;
        }
      }
      if (bestDiff <= 7) {
        uint64_t baseSeconds = (nowSec - (info->tm_hour * 3600 + info->tm_min * 60 + info->tm_sec));
        uint64_t candidateSeconds = baseSeconds + static_cast<uint64_t>(bestDiff) * 86400ULL + targetSeconds;
        schedule.nextRunAt = isoFromEpoch(candidateSeconds * 1000ULL);
        return schedule.nextRunAt;
      }
    }
  }
  if (schedule.time.length() && rtcEpochBaseMs != 0) {
    uint64_t nowMs = currentEpochMs();
    time_t nowSec = nowMs / 1000ULL;
    struct tm *info = gmtime(&nowSec);
    if (info) {
      int hour = 0;
      int minute = 0;
      timeStringToParts(schedule.time, hour, minute);
      uint64_t midnight = nowSec - (info->tm_hour * 3600 + info->tm_min * 60 + info->tm_sec);
      uint64_t candidateSeconds = midnight + static_cast<uint64_t>(hour) * 3600ULL + static_cast<uint64_t>(minute) * 60ULL;
      if (candidateSeconds <= nowSec) {
        candidateSeconds += 86400ULL;
      }
      schedule.nextRunAt = isoFromEpoch(candidateSeconds * 1000ULL);
      return schedule.nextRunAt;
    }
  }
  schedule.nextRunAt = "";
  return schedule.nextRunAt;
}

void appendLogEntry(const MessageRecord &msg, const String &status) {
  LogEntry entry;
  entry.id = generateId("log");
  entry.messageId = msg.id;
  entry.title = msg.title;
  entry.body = msg.body;
  entry.status = status;
  entry.createdAt = msg.updatedAt.length() ? msg.updatedAt : isoNow();
  logEntries.push_back(entry);
  clampVectorSize(logEntries, MAX_LOG_ENTRIES);
}

void upsertMessage(const MessageRecord &msg) {
  auto it = std::find_if(messageStore.begin(), messageStore.end(), [&](const MessageRecord &existing) {
    return existing.id == msg.id;
  });
  if (it != messageStore.end()) {
    *it = msg;
  } else {
    messageStore.push_back(msg);
    clampVectorSize(messageStore, MAX_MESSAGES);
  }
}

void upsertSchedule(const ScheduleRecord &schedule) {
  auto it = std::find_if(scheduleStore.begin(), scheduleStore.end(), [&](const ScheduleRecord &existing) {
    return existing.id == schedule.id;
  });
  if (it != scheduleStore.end()) {
    *it = schedule;
  } else {
    scheduleStore.push_back(schedule);
    clampVectorSize(scheduleStore, MAX_SCHEDULES);
  }
}

void markMessageScheduled(const String &messageId, bool scheduled) {
  auto it = std::find_if(messageStore.begin(), messageStore.end(), [&](const MessageRecord &existing) {
    return existing.id == messageId;
  });
  if (it == messageStore.end()) {
    return;
  }
  if (scheduled) {
    ensureTagPresent(it->tags, "scheduled");
  } else {
    removeTag(it->tags, "scheduled");
  }
}

MessageRecord buildMessageFromJson(JsonVariantConst source, bool &ok, String &error) {
  MessageRecord msg;
  ok = false;
  if (source.isNull() || !source.is<JsonObjectConst>()) {
    error = "invalid_message";
    return msg;
  }
  JsonObjectConst obj = source.as<JsonObjectConst>();
  const char *title = obj["title"] | "";
  const char *body = obj["body"] | "";
  if (strlen(title) == 0 || strlen(body) == 0) {
    error = "missing_fields";
    return msg;
  }
  const char *id = obj["id"] | "";
  msg.id = strlen(id) ? String(id) : generateId("msg");
  msg.title = title;
  msg.body = body;
  const char *soundId = obj["soundFileId"] | "";
  msg.soundFileId = soundId;
  msg.soundEnabled = obj["soundEnabled"] | false;
  msg.scrollSpeed = String(obj["scrollSpeed"] | "normal");
  msg.animation = String(obj["animation"] | "slide");
  msg.durationSec = obj["durationSec"].isNull() ? 0 : obj["durationSec"].as<int>();
  msg.numScrolls = obj["numScrolls"].isNull() ? 0 : obj["numScrolls"].as<int>();
  msg.muted = !msg.soundEnabled;
  msg.createdAt = isoNow();
  msg.updatedAt = msg.createdAt;
  if (obj.containsKey("tags")) {
    JsonArrayConst tags = obj["tags"].as<JsonArrayConst>();
    for (JsonVariantConst tag : tags) {
      const char *value = tag.as<const char *>();
      if (value && strlen(value) > 0) {
        ensureTagPresent(msg.tags, String(value));
      }
    }
  }
  ensureTagPresent(msg.tags, "saved");
  ok = true;
  return msg;
}

ScheduleRecord buildScheduleFromJson(JsonVariantConst source, bool &ok, String &error) {
  ScheduleRecord schedule;
  ok = false;
  if (source.isNull() || !source.is<JsonObjectConst>()) {
    error = "invalid_schedule";
    return schedule;
  }
  JsonObjectConst obj = source.as<JsonObjectConst>();
  const char *messageId = obj["messageId"] | "";
  if (strlen(messageId) == 0) {
    error = "missing_message_id";
    return schedule;
  }
  const char *id = obj["id"] | "";
  schedule.id = strlen(id) ? String(id) : generateId("sch");
  schedule.messageId = messageId;
  schedule.time = String(obj["time"] | "");
  schedule.timezone = String(obj["timezone"] | "UTC");
  schedule.enabled = obj.containsKey("enabled") ? obj["enabled"].as<bool>() : true;
  if (obj.containsKey("days")) {
    JsonArrayConst days = obj["days"].as<JsonArrayConst>();
    for (JsonVariantConst item : days) {
      const char *value = item.as<const char *>();
      if (value && strlen(value) > 0) {
        schedule.days.push_back(String(value));
      }
    }
  }
  if (obj.containsKey("specificDates")) {
    JsonArrayConst dates = obj["specificDates"].as<JsonArrayConst>();
    for (JsonVariantConst item : dates) {
      const char *value = item.as<const char *>();
      if (value && strlen(value) > 0) {
        schedule.specificDates.push_back(String(value));
      }
    }
  }
  schedule.recurrenceSummary = computeRecurrenceSummary(schedule);
  computeNextRunAtApprox(schedule);
  ok = true;
  return schedule;
}

MessageRecord prepareSendMessage(MessageRecord msg) {
  msg.updatedAt = isoNow();
  ensureTagPresent(msg.tags, "saved");
  upsertMessage(msg);
  currentMessage = msg;
  hasCurrentMessage = true;
  currentScrollsDone = 0;
  currentTimeLeftSec = msg.durationSec;
  appendLogEntry(msg, "sent");
  return msg;
}

ScheduleRecord registerSchedule(ScheduleRecord schedule) {
  computeNextRunAtApprox(schedule);
  schedule.recurrenceSummary = computeRecurrenceSummary(schedule);
  upsertSchedule(schedule);
  markMessageScheduled(schedule.messageId, true);
  return schedule;
}


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

  server.on("/api/device/state", HTTP_GET, []() {
    StaticJsonDocument<768> doc;
    bool wifiConnected = WiFi.status() == WL_CONNECTED;
    doc["ok"] = true;
    JsonObject device = doc.createNestedObject("device");
    device["connected"] = wifiConnected;
    device["ip"] = wifiConnected ? WiFi.localIP().toString() : String("");
    device["name"] = deviceName;
    device["isOn"] = !relayOn;
    if (hasCurrentMessage) {
      device["currentMessageId"] = currentMessage.id;
      device["currentMessageExcerpt"] = excerptFromBody(currentMessage.body);
    }
    device["scrollsDone"] = currentScrollsDone;
    if (currentTimeLeftSec > 0) {
      device["timeLeftSec"] = currentTimeLeftSec;
    }
    device["ledColor"] = deviceSettings.ledColor;
    device["font"] = deviceSettings.font;
    device["rtcTime"] = isoNow();
    device["batteryPct"] = batteryPercentage;

    JsonObject capabilities = doc.createNestedObject("capabilities");
    capabilities["maxCharsPerFrame"] = CAP_MAX_CHARS;
    capabilities["supportsSound"] = CAP_SUPPORTS_SOUND;
    capabilities["supportsMultiMessageBatch"] = CAP_SUPPORTS_MULTI;

    JsonObject settings = doc.createNestedObject("settings");
    settingsToJson(settings);

    if (hasCurrentMessage) {
      JsonObject current = doc.createNestedObject("currentMessage");
      messageToJson(currentMessage, current);
    }

    String out;
    serializeJson(doc, out);
    sendJson(200, out);
  });

  server.on("/api/device/rtc", HTTP_POST, []() {
    String body = server.arg("plain");
    StaticJsonDocument<256> doc;
    auto err = deserializeJson(doc, body);
    if (err || doc["epochMs"].isNull()) {
      sendJson(400, "{\"error\":\"bad_json\"}");
      return;
    }
    uint64_t epochMs = doc["epochMs"].as<uint64_t>();
    rtcEpochBaseMs = epochMs;
    rtcBaseMillis = millis();

    StaticJsonDocument<192> reply;
    reply["ok"] = true;
    reply["rtcTime"] = isoFromEpoch(epochMs);
    String out;
    serializeJson(reply, out);
    sendJson(200, out);
  });

  server.on("/api/device/messages/current", HTTP_GET, []() {
    StaticJsonDocument<768> doc;
    doc["ok"] = true;
    if (hasCurrentMessage) {
      JsonObject message = doc.createNestedObject("message");
      messageToJson(currentMessage, message);
      doc["scrollsDone"] = currentScrollsDone;
      if (currentTimeLeftSec > 0) {
        doc["timeLeftSec"] = currentTimeLeftSec;
      }
    }
    String out;
    serializeJson(doc, out);
    sendJson(200, out);
  });

  server.on("/api/device/messages/send", HTTP_POST, []() {
    String body = server.arg("plain");
    StaticJsonDocument<3072> doc;
    auto err = deserializeJson(doc, body);
    if (err) {
      sendJson(400, "{\"error\":\"bad_json\"}");
      return;
    }

    StaticJsonDocument<2048> reply;
    reply["ok"] = true;
    bool processed = false;

    if (doc.containsKey("messages")) {
      JsonArray arr = doc["messages"].as<JsonArray>();
      JsonArray outArr = reply.createNestedArray("messages");
      for (JsonVariant item : arr) {
        bool ok;
        String parseError;
        MessageRecord msg = buildMessageFromJson(item, ok, parseError);
        if (!ok) {
          sendJson(400, String("{\"error\":\"") + parseError + "\"}");
          return;
        }
        MessageRecord delivered = prepareSendMessage(msg);
        JsonObject dest = outArr.createNestedObject();
        messageToJson(delivered, dest);
        processed = true;
      }
    } else if (doc.containsKey("message")) {
      bool ok;
      String parseError;
      MessageRecord msg = buildMessageFromJson(doc["message"], ok, parseError);
      if (!ok) {
        sendJson(400, String("{\"error\":\"") + parseError + "\"}");
        return;
      }
      MessageRecord delivered = prepareSendMessage(msg);
      JsonObject dest = reply.createNestedObject("message");
      messageToJson(delivered, dest);
      processed = true;
    } else {
      sendJson(400, "{\"error\":\"missing_message\"}");
      return;
    }

    if (!processed) {
      sendJson(400, "{\"error\":\"no_messages\"}");
      return;
    }

    String out;
    serializeJson(reply, out);
    sendJson(200, out);
  });

  server.on("/api/device/messages/schedule", HTTP_POST, []() {
    String body = server.arg("plain");
    StaticJsonDocument<2048> doc;
    auto err = deserializeJson(doc, body);
    if (err || doc["schedule"].isNull()) {
      sendJson(400, "{\"error\":\"bad_json\"}");
      return;
    }
    bool ok;
    String parseError;
    ScheduleRecord schedule = buildScheduleFromJson(doc["schedule"], ok, parseError);
    if (!ok) {
      sendJson(400, String("{\"error\":\"") + parseError + "\"}");
      return;
    }
    ScheduleRecord stored = registerSchedule(schedule);

    StaticJsonDocument<1024> reply;
    reply["ok"] = true;
    JsonObject sch = reply.createNestedObject("schedule");
    scheduleToJson(stored, sch);
    String out;
    serializeJson(reply, out);
    sendJson(200, out);
  });

  server.on("/api/device/logs/recent", HTTP_GET, []() {
    StaticJsonDocument<2048> doc;
    doc["ok"] = true;
    JsonArray logs = doc.createNestedArray("logs");
    for (const auto &entry : logEntries) {
      JsonObject item = logs.createNestedObject();
      item["id"] = entry.id;
      item["messageId"] = entry.messageId;
      item["title"] = entry.title;
      item["status"] = entry.status;
      item["createdAt"] = entry.createdAt;
      item["excerpt"] = excerptFromBody(entry.body);
    }
    String out;
    serializeJson(doc, out);
    sendJson(200, out);
  });

  server.on("/api/device/settings", HTTP_GET, []() {
    StaticJsonDocument<512> doc;
    doc["ok"] = true;
    JsonObject settings = doc.createNestedObject("settings");
    settingsToJson(settings);
    String out;
    serializeJson(doc, out);
    sendJson(200, out);
  });

  server.on("/api/device/settings", HTTP_POST, []() {
    String body = server.arg("plain");
    StaticJsonDocument<512> doc;
    auto err = deserializeJson(doc, body);
    if (err) {
      sendJson(400, "{\"error\":\"bad_json\"}");
      return;
    }
    if (doc.containsKey("dateDisplayEnabled")) {
      deviceSettings.dateDisplayEnabled = doc["dateDisplayEnabled"].as<bool>();
    }
    if (doc.containsKey("calendarVisible")) {
      deviceSettings.calendarVisible = doc["calendarVisible"].as<bool>();
    }
    if (doc.containsKey("ledColor")) {
      deviceSettings.ledColor = String(doc["ledColor"].as<const char *>());
    }
    if (doc.containsKey("font")) {
      deviceSettings.font = String(doc["font"].as<const char *>());
    }
    if (doc.containsKey("soundEnabled")) {
      deviceSettings.soundEnabled = doc["soundEnabled"].as<bool>();
    }
    StaticJsonDocument<512> reply;
    reply["ok"] = true;
    JsonObject settings = reply.createNestedObject("settings");
    settingsToJson(settings);
    String out;
    serializeJson(reply, out);
    sendJson(200, out);
  });

  server.on("/api/device/pairing-challenge", HTTP_GET, []() {
    lastPairingChallenge = generateId("challenge");
    StaticJsonDocument<256> doc;
    doc["challenge"] = lastPairingChallenge;
    doc["deviceId"] = deviceId;
    String out;
    serializeJson(doc, out);
    sendJson(200, out);
  });

  server.on("/api/device/claim", HTTP_POST, []() {
    String body = server.arg("plain");
    StaticJsonDocument<512> doc;
    auto err = deserializeJson(doc, body);
    if (err) {
      sendJson(400, "{\"error\":\"bad_json\"}");
      return;
    }
    const char *challenge = doc["challenge"] | "";
    const char *userId = doc["userId"] | "";
    if (!strlen(challenge) || lastPairingChallenge != String(challenge)) {
      sendJson(400, "{\"error\":\"invalid_challenge\"}");
      return;
    }
    deviceToken = generateId("token");
    claimedUserId = String(userId);
    lastPairingChallenge = "";

    StaticJsonDocument<512> reply;
    reply["ok"] = true;
    reply["deviceToken"] = deviceToken;
    reply["deviceId"] = deviceId;
    reply["claimed"] = claimedUserId;
    reply["issuedAt"] = isoNow();
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
  randomSeed(ESP.getChipId());
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
