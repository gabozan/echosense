#pragma once
#include <Arduino.h>

#define EDGE_SERVER_URL "http://10.124.20.163:8000/edge-sim"

enum class SoundClass {
    SILENCE,
    TRAFFIC,
    VOICES,
    MUSIC,
    MACHINERY
};

enum class DeviceStatus {
    ONLINE,
    OFFLINE,
    DAMAGED
};

struct EdgePayload {
    String deviceId;
    float laeq;
    float peak;
    SoundClass soundClass;
    DeviceStatus status;
};

void edgeInit(const char* serverUrl);
int edgeSendMetrics(const EdgePayload& payload);
const char* soundClassToString(SoundClass c);
const char* deviceStatusToString(DeviceStatus s);