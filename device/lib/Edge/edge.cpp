#include "edge.h"
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <sys/time.h>
#include <WiFi.h>

static String g_serverUrl = EDGE_SERVER_URL;

void edgeInit(const char* serverUrl) {
    if (serverUrl && strlen(serverUrl) > 0) {
        g_serverUrl = serverUrl;
    }
    Serial.printf("[Edge] Server URL: %s\n", g_serverUrl.c_str());
}

const char* soundClassToString(SoundClass c) {
    switch (c) {
        case SoundClass::SILENCE: return "silence";
        case SoundClass::TRAFFIC: return "traffic";
        case SoundClass::VOICES: return "voices";
        case SoundClass::MUSIC: return "music";
        case SoundClass::MACHINERY: return "machinery";
        default: return "silence"; 
    }
}

const char* deviceStatusToString(DeviceStatus s) {
    switch (s) {
        case DeviceStatus::ONLINE: return "online";
        case DeviceStatus::OFFLINE: return "offline";
        default: return "damaged";
    }
}

static String getTimestamp() {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    
    struct tm timeinfo;
    gmtime_r(&tv.tv_sec, &timeinfo);
    
    // Extract milliseconds from microseconds
    int millis = tv.tv_usec / 1000;
    
    char buf[32];
    int len = strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", &timeinfo);
    snprintf(buf + len, sizeof(buf) - len, ".%03dZ", millis);
    
    return String(buf);
}

int edgeSendMetrics(const EdgePayload& payload) {
    if (g_serverUrl.isEmpty()) {
        Serial.println("[Edge] Error: Server URL not configured");
        return -1;
    }

    // Build JSON payload
    StaticJsonDocument<256> doc;
    doc["id"] = payload.deviceId;
    doc["laeq"] = payload.laeq;
    doc["peak"] = payload.peak;
    doc["class"] = soundClassToString(payload.soundClass);
    doc["status"] = deviceStatusToString(payload.status);
    doc["timestamp"] = getTimestamp();

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    Serial.printf("[Edge] Sending to %s\n", g_serverUrl.c_str());
    Serial.printf("[Edge] Payload: %s\n", jsonPayload.c_str());

    WiFiClient client;
    HTTPClient http;
    
    if (http.begin(client, g_serverUrl)) {
        http.addHeader("Content-Type", "application/json");
        int httpCode = http.POST(jsonPayload);

        if (httpCode > 0) {
            Serial.printf("[Edge] Response: %d\n", httpCode);
            if (httpCode >= 200 && httpCode < 300) {
                String response = http.getString();
                Serial.printf("[Edge] Body: %s\n", response.c_str());
            }
        } else {
            Serial.printf("[Edge] Error: %s\n", http.errorToString(httpCode).c_str());
        }
        http.end();
        return httpCode;
    } else {
        Serial.println("[Edge] Unable to connect to server");
        return -1;
    }
}
