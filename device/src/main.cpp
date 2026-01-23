#include <Arduino.h>
#include <WiFi.h>
#include "network.h"
#include "audio.h"
#include "edge.h"

// Device configuration
#define DEVICE_ID "es-node-003"

static bool g_wasConnected = false;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("Booting DEVICE...");

  networkInitBLE();

  if (!audioInit()) {
    Serial.println("[MAIN] ERROR: Failed to initialize audio");
  }

  edgeInit(EDGE_SERVER_URL);

  configTime(3600, 3600, "pool.ntp.org", "time.nist.gov");
}

void loop() {
  // 1. Check if new WiFi credentials arrived via BLE
  if (networkHasNewWifiCredentials()) {
    String ssid;
    String password;
    networkConsumeWifiCredentials(ssid, password);

    Serial.println("[MAIN] New WiFi credentials received via BLE");
    networkConnectWiFi(ssid, password);
  }
  // 2. Monitor WiFi status and toggle BLE accordingly
  bool isConnected = networkIsWiFiConnected();

  // Transition: Disconnected -> Connected
  if (isConnected && !g_wasConnected) {
    Serial.print("[MAIN] WiFi connected! IP: ");
    Serial.println(WiFi.localIP());
    // Turn off BLE to save resources
    if (networkIsBLEActive()) {
      Serial.println("[MAIN] Stopping BLE...");
      networkStopBLE();
    }
  }

  // Transition: Connected -> Disconnected
  if (!isConnected && g_wasConnected) {
    Serial.println("[MAIN] WiFi connection lost");
    // Turn on BLE again to allow reconfiguration
    if (!networkIsBLEActive()) {
      Serial.println("[MAIN] Restarting BLE for reconfiguration...");
      networkInitBLE();
    }
  }

  g_wasConnected = isConnected;

// 3. Audio capture (only when WiFi is connected, every 10 seconds)
  static unsigned long lastCapture = 0;
  if (isConnected && (millis() - lastCapture > 10000)) {
    lastCapture = millis();
    
    Serial.println("\n[MAIN] === Starting Acoustic Measurement ===");
    
    // Measure for 1 second (1000ms) to get LAeq and Peak
    AudioMetrics metrics = audioMeasure(1000);
    
    if (metrics.success) {
      Serial.printf("[MAIN] Results: LAeq=%.1f dB, LApeak=%.1f dB\n", metrics.LAeq, metrics.LApeak);
      
      // Send to edge server
      EdgePayload payload;
      payload.deviceId = DEVICE_ID;
      payload.laeq = metrics.LAeq;
      payload.peak = metrics.LApeak;
      payload.soundClass = SoundClass::SILENCE;  // TODO: Implement classification
      payload.status = DeviceStatus::ONLINE;
      
      int httpCode = edgeSendMetrics(payload);
      if (httpCode >= 200 && httpCode < 300) {
        Serial.println("[MAIN] Data sent to edge server");
      } else {
        Serial.printf("[MAIN] Failed to send data (HTTP %d)\n", httpCode);
      }
    } else {
      Serial.println("[MAIN] Measurement Failed");
    }

    Serial.println("[MAIN] === Measurement Complete ===\n");
  }
  
  // 4. Periodic status log
  static unsigned long lastLog = 5000; // Start at 5s offset
  if (millis() - lastLog > 10000) {
    lastLog = millis();
    
    if (isConnected) {
      Serial.print("[MAIN] Status: WiFi OK | IP: ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("[MAIN] Status: Waiting for WiFi credentials via BLE...");
    }
  }
}