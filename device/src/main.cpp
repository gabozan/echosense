#include <Arduino.h>
#include <WiFi.h>
#include "network.h"
#include "audio.h"
#include "edge.h"
#include "inference.h"

#define DEVICE_ID "es-node-001"

static bool g_wasConnected = false;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("Booting DEVICE...");

  networkInitBLE();

  if (!audioInit()) {
    Serial.println("[MAIN] ERROR: Failed to initialize audio");
  }

  if (!inferenceInit()) {
    Serial.println("[MAIN] ERROR: Failed to initialize ML inference");
  }

  edgeInit(EDGE_SERVER_URL);

  configTime(3600, 3600, "pool.ntp.org", "time.nist.gov");
}

void loop() {
  // Check if new WiFi credentials arrived via BLE
  if (networkHasNewWifiCredentials()) {
    String ssid;
    String password;
    networkConsumeWifiCredentials(ssid, password);

    Serial.println("[MAIN] New WiFi credentials received via BLE");
    
    networkReleaseMemory();
    delay(500); 
    
    networkConnectWiFi(ssid, password);
  }
  // Monitor WiFi status
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
    // Turn on BLE again
    if (!networkIsBLEActive()) {
      Serial.println("[MAIN] Restarting system to re-enable BLE...");
      delay(1000);
      ESP.restart();
    }
  }

  g_wasConnected = isConnected;

// Audio capture + ML classification (every 10 seconds when WiFi connected)
  static unsigned long lastCapture = 0;
  if (isConnected && (millis() - lastCapture > 10000)) {
    lastCapture = millis();
    
    Serial.println("\n[MAIN] ==================");
    
    if (inferenceIsReady()) {
      Serial.println("[MAIN] Inference Start");
      inferenceStart(); // Reset tensor state
      
      audioStart(); 
      
      size_t totalSamples16 = 0;
      int32_t tempBuffer32[128]; // Small stack buffer
      int16_t tempBuffer16[128]; // Small stack buffer
      
      unsigned long captureStart = millis();
      
      // Stream capture loop
      while (totalSamples16 < INFERENCE_SAMPLES && (millis() - captureStart) < 6000) {
        
        size_t remaining = INFERENCE_SAMPLES - totalSamples16;
        size_t toRead = (remaining < 128) ? remaining : 128;
        
        // Read from I2S
        size_t samplesRead = audioCapture(tempBuffer32, toRead);
        if (samplesRead == 0) { delay(1); continue; }

        // Convert to 16-bit
        for (size_t i = 0; i < samplesRead; i++) {
            tempBuffer16[i] = (int16_t)(tempBuffer32[i] >> 16);
        }
        
        // Process Chunk (FFT -> Mel -> Tensor)
        inferenceProcessChunk(tempBuffer16, samplesRead);
        
        // Print progress every 1024 samples
        if ((totalSamples16 + samplesRead) % 1024 < samplesRead) {
             Serial.printf("[MAIN] Captured %d/%d samples (Time: %lums)\n", totalSamples16 + samplesRead, INFERENCE_SAMPLES, millis() - captureStart);
        }
        
        totalSamples16 += samplesRead;
      }
      
      audioStop(); 
      
      Serial.printf("[MAIN] Processed %zu samples\n", totalSamples16);
      
      // Run model
      float confidence = 0.0f;
      SoundClass detectedClass = inferenceEnd(&confidence);
      
      Serial.printf("[MAIN] Class: %s (%.1f%%)\n", 
                    inferenceGetClassName(detectedClass), confidence * 100.0f);
      
      // Send data
      EdgePayload payload;
      payload.deviceId = DEVICE_ID;
      payload.soundClass = detectedClass;
      payload.status = DeviceStatus::ONLINE;
      
      AudioMetrics metrics = audioMeasure(1000); 
      if(metrics.success) {
          payload.laeq = metrics.LAeq;
          payload.peak = metrics.LApeak;
      }

      edgeSendMetrics(payload);
    }
    
    Serial.println("[MAIN] ==================\n");
  }
  
  // Periodic status log
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