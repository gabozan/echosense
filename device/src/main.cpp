#include <Arduino.h>
#include <WiFi.h>
#include "network.h"
#include "audio.h"

static bool g_wasConnected = false;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("Booting DEVICE...");

  networkInitBLE();

  if (!audioInit()) {
    Serial.println("[MAIN] ERROR: Failed to initialize audio");
  }
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
    
    Serial.println("\n[MAIN] === Starting Audio Capture ===");
    
    // Start I2S
    audioStart();

    // MEJORA 1: Buffer estático para no saturar la memoria Stack
    static int32_t buffer[AUDIO_BUFFER_SAMPLES];

    // MEJORA 2: Lectura de "Calentamiento" (Warm-up)
    // Leemos buffers para estabilizar el micro y el filtro DC
    for (int i = 0; i < 5; i++) {
      audioCapture(buffer, AUDIO_BUFFER_SAMPLES);
    }
    
    // Ahora sí, captura real
    size_t samplesRead = audioCapture(buffer, AUDIO_BUFFER_SAMPLES);
    
    if (samplesRead > 0) {
      Serial.printf("[MAIN] Captured %d samples\n", samplesRead);
      
      // DEBUG: Print first 5 raw samples to verify data
      Serial.println("[MAIN] DEBUG Raw samples (first 5):");
      for (int i = 0; i < 5 && i < (int)samplesRead; i++) {
        Serial.printf("  [%d] raw=0x%08X (%d)\n", i, (unsigned int)buffer[i], buffer[i]);
      }
      
      // Calculate stats
      float minVal = 1.0f;
      float maxVal = -1.0f;
      float rmsSum = 0.0f;
      
      for (size_t i = 0; i < samplesRead; i++) {
        float sample = audioSampleToFloat(buffer[i]);
        
        if (sample < minVal) minVal = sample;
        if (sample > maxVal) maxVal = sample;
        
        rmsSum += sample * sample;
      }
      
      float rms = sqrtf(rmsSum / samplesRead);
      float rmsDb = 20.0f * log10f(rms + 1e-10f);
      
      // ICS-43434: Sensitivity = -26 dBFS @ 94 dB SPL
      // Therefore: dB_SPL = dBFS + 120
      float dbSPL = rmsDb + 120.0f;

      Serial.printf("[MAIN] Signal: Min=%.6f, Max=%.6f\n", minVal, maxVal);
      Serial.printf("[MAIN] RMS=%.6f, dBFS=%.2f\n", rms, rmsDb);
      Serial.printf("[MAIN] Sound Level: %.1f dB SPL\n", dbSPL);
      
    } else {
      Serial.println("[MAIN] ERROR: Failed to capture audio");
    }
    
    // Stop I2S
    audioStop();

    Serial.println("[MAIN] === Audio Capture Complete ===\n");
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