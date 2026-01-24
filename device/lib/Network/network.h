#pragma once
#include <Arduino.h>

// BLE configuration
#define BLE_DEVICE_NAME "EchoSense Node"
#define BLE_SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_CREDENTIALS_CHAR_UUID "6e400002-b5a3-f393-e0a9-e50e24dcca9e"

// BLE functions
void networkInitBLE();
void networkStopBLE();
void networkReleaseMemory(); // Frees BLE memory. Requires reboot to re-enable BLE.
bool networkIsBLEActive();
bool networkHasNewWifiCredentials();
void networkConsumeWifiCredentials(String &ssid, String &password);

// WiFi functions
void networkConnectWiFi(const String &ssid, const String &password);
bool networkIsWiFiConnected();