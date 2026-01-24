#pragma once
#include <Arduino.h>

// I2S pin configuration for ICS-43434
#define I2S_WS_PIN 17 // Word select (LRCL)
#define I2S_SD_PIN 4 // Serial data (DOUT)
#define I2S_SCK_PIN 14 // Bit clock (BCLK)

// Audio configuration
#define AUDIO_SAMPLE_RATE 16000 // 16 kHz
#define AUDIO_BUFFER_SAMPLES 1024 // Samples per buffer

// Audio functions
bool audioInit();
void audioStart();
void audioStop();
bool audioIsActive();
size_t audioCapture(int32_t* buffer, size_t maxSamples);
float audioSampleToFloat(int32_t rawSample);
float audioSampleToDb(int32_t rawSample);

// Structure to return analysis results
struct AudioAnalysis {
    float minVal;
    float maxVal;
    float rms;
    float rmsDb;
    float dbSPL;
    bool success;
};

// Main function encapsulating capture and analysis
AudioAnalysis audioAnalyze();

// Acoustic Metrics (LAeq, Peak)
struct AudioMetrics {
    float LAeq; // A-weighted equivalent level (dB SPL)
    float LApeak; // A-weighted instantaneous peak (dB SPL)
    uint32_t durationMs; // Actual measurement duration
    bool success;
};

// Measure audio for durationMs and calculate metrics
AudioMetrics audioMeasure(uint32_t durationMs);