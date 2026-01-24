#include <Arduino.h>
#include <WiFi.h>
#include "network.h"
#include "audio.h"
#include "edge.h"
#include "inference.h"

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

  if (!inferenceInit()) {
    Serial.println("[MAIN] ERROR: Failed to initialize ML inference");
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
    
    // CRITICAL: Free BLE memory before starting WiFi to avoid OOM
    networkReleaseMemory();
    delay(500); 
    
    networkConnectWiFi(ssid, password);
  }
  // 2. Monitor WiFi status
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
      ESP.restart(); // Reboot required to re-allocate BLE memory if it was released
    }
  }

  g_wasConnected = isConnected;

// 3. Audio capture + ML classification (every 10 seconds when WiFi connected)
  static unsigned long lastCapture = 0;
  if (isConnected && (millis() - lastCapture > 10000)) {
    lastCapture = millis();
    
    Serial.println("\n[MAIN] === Iniciando Clasificación ===");
    
    if (inferenceIsReady()) {
      Serial.println("[MAIN] Inference Start");
      inferenceStart(); // Reset tensor state
      
      audioStart(); 
      
      size_t totalSamples16 = 0;
      int32_t tempBuffer32[128]; // Small stack buffer
      int16_t tempBuffer16[128]; // Small stack buffer
      
      unsigned long captureStart = millis();
      
      // Stream capture loop
      while (totalSamples16 < INFERENCE_SAMPLES && (millis() - captureStart) < 3000) {
        
        size_t remaining = INFERENCE_SAMPLES - totalSamples16;
        size_t toRead = (remaining < 128) ? remaining : 128;
        
        // 1. Read from I2S
        size_t samplesRead = audioCapture(tempBuffer32, toRead);
        if (samplesRead == 0) { delay(1); continue; }

        // 2. Convert to 16-bit
        for (size_t i = 0; i < samplesRead; i++) {
            tempBuffer16[i] = (int16_t)(tempBuffer32[i] >> 16);
        }
        
        // 3. Process Chunk (FFT -> Mel -> Tensor)
        inferenceProcessChunk(tempBuffer16, samplesRead);
        
        totalSamples16 += samplesRead;
      }
      
      audioStop(); 
      
      Serial.printf("[MAIN] Processed %zu samples\n", totalSamples16);
      
      // 4. Run Model
      float confidence = 0.0f;
      SoundClass detectedClass = inferenceEnd(&confidence);
      
      Serial.printf("[MAIN] Class: %s (%.1f%%)\n", 
                    inferenceGetClassName(detectedClass), confidence * 100.0f);
      
      // 4. ENVIAR DATOS
      EdgePayload payload;
      payload.deviceId = DEVICE_ID;
      payload.soundClass = detectedClass;
      payload.status = DeviceStatus::ONLINE;
      
      // Nota: Si quieres enviar LAeq (decibelios), puedes llamar a audioMeasure(1000) aquí
      // audioMeasure usa su propio buffer interno pequeño, así que no hay conflicto de RAM.
      AudioMetrics metrics = audioMeasure(1000); 
      if(metrics.success) {
          payload.laeq = metrics.LAeq;
          payload.peak = metrics.LApeak;
      }

      edgeSendMetrics(payload);
    }
    
    Serial.println("[MAIN] === Fin Clasificación ===\n");
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