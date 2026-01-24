#include "network.h"
#include <WiFi.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// Internal state
static String g_wifiSsid;
static String g_wifiPassword;
static bool g_hasNewCredentials = false;
static bool g_bleInitialized = false;
static bool g_bleAdvertising = false;

// BLE objects
static BLEServer* g_server = nullptr;
static BLECharacteristic* g_credentialsChar = nullptr;

// CLASS: Detect server events (connect/disconnect)
class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    Serial.println("[BLE] Client connected");
  };

  void onDisconnect(BLEServer* pServer) {
    Serial.println("[BLE] Client disconnected");
    if (g_bleAdvertising) {
      Serial.println("[BLE] Restarting advertising...");
      pServer->getAdvertising()->start();
    }
  }
};

// CLASS: Called when mobile app writes credentials
class CredentialsCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) override {
    std::string value = pCharacteristic->getValue();
    if (value.empty()) return;

    // Expected format: "<SSID>|<PASSWORD>"
    String raw = String(value.c_str());
    Serial.print("[BLE] Data received: ");
    Serial.println(raw);
    
    int sepIndex = raw.indexOf("|");
    if (sepIndex <= 0) {
      Serial.println("[BLE] Error: Invalid format");
      return;
    }

    g_wifiSsid = raw.substring(0, sepIndex);
    g_wifiPassword = raw.substring(sepIndex + 1);
    g_hasNewCredentials = true;

    Serial.print("[BLE] Parsed SSID: ");
    Serial.println(g_wifiSsid);
  }
};

// BLE public API

void networkInitBLE() {
  if (!g_bleInitialized) {
    Serial.println("[BLE] Initializing for the first time...");

    BLEDevice::init(BLE_DEVICE_NAME);

    g_server = BLEDevice::createServer();
    g_server->setCallbacks(new MyServerCallbacks());
    
    BLEService *service = g_server->createService(BLE_SERVICE_UUID);

    g_credentialsChar = service->createCharacteristic(BLE_CREDENTIALS_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE);
    g_credentialsChar->setCallbacks(new CredentialsCallbacks());

    service->start();

    BLEAdvertising *advertising = BLEDevice::getAdvertising();
    advertising->addServiceUUID(BLE_SERVICE_UUID);
    advertising->setScanResponse(true);

    g_bleInitialized = true;
  }

  // Start or restart advertising
  if (!g_bleAdvertising) {
    Serial.println("[BLE] Starting advertising...");
    BLEDevice::startAdvertising();
    g_bleAdvertising = true;
    Serial.println("[BLE] Advertising started. Waiting for credentials...");
  } else {
    Serial.println("[BLE] Already advertising, skipping");
  }
}

void networkStopBLE() {
  if (!g_bleAdvertising) {
    Serial.println("[BLE] Already stopped, skipping");
    return;
  }
  Serial.println("[BLE] Stopping advertising...");
  
  BLEDevice::stopAdvertising();
  g_bleAdvertising = false;

  Serial.println("[BLE] Advertising stopped");
}

void networkReleaseMemory() {
  Serial.println("[BLE] Releasing Bluetooth memory...");
  
  // 1. Stop advertising if active
  if (g_bleAdvertising) {
    BLEDevice::stopAdvertising();
    g_bleAdvertising = false;
  }
  
  // 2. Deinitialize BLE stack (Bluedroid)
  BLEDevice::deinit(false);
  
  // 3. Disable controller
  if (esp_bt_controller_get_status() == ESP_BT_CONTROLLER_STATUS_ENABLED) {
      esp_bt_controller_disable();
      while (esp_bt_controller_get_status() == ESP_BT_CONTROLLER_STATUS_ENABLED);
  }
  
  // 4. Release classic BT memory (if not used)
  esp_bt_mem_release(ESP_BT_MODE_CLASSIC_BT);
  
  // 5. Release BLE memory
  esp_err_t err = esp_bt_mem_release(ESP_BT_MODE_BTDM);
  
  if (err == ESP_OK) {
      Serial.println("[BLE] Memory released successfully!");
  } else {
      Serial.printf("[BLE] Failed to release memory (0x%x)\n", err);
  }
}

bool networkIsBLEActive() {
  return g_bleAdvertising;
}

bool networkHasNewWifiCredentials() {
  return g_hasNewCredentials;
}

void networkConsumeWifiCredentials(String &ssid, String &password) {
  ssid = g_wifiSsid;
  password = g_wifiPassword;
  g_hasNewCredentials = false;
}

// WiFi public API

void networkConnectWiFi(const String &ssid, const String &password) {
  if (ssid.isEmpty()) {
    Serial.println("[WiFi] Error: SSID is empty");
    return;
  }
  Serial.printf("[WiFi] Connecting to '%s'...\n", ssid.c_str());
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
}

bool networkIsWiFiConnected() {
  return (WiFi.status() == WL_CONNECTED);
}