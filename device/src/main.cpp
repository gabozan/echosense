#include <Arduino.h>
#include <WiFi.h>
#include "network.h"

static bool g_wasConnected = false;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("Booting DEVICE...");

  networkInitBLE();
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

  // 3. Periodic status log (every 10 seconds)
  static unsigned long lastLog = 0;
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
