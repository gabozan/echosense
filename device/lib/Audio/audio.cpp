#include "audio.h"
#include <driver/i2s.h>

// ICS-43434 MEMS Microphone - ESP32 I2S Driver
// Key specs:
// - 24-bit audio, I2S output
// - Sensitivity: -26 dBFS @ 94 dB SPL -> Offset = 120
// - L/R pin LOW = Left channel (data on WS falling edge)

#define I2S_PORT I2S_NUM_0

// State
static bool g_initialized = false;
static bool g_active = false;

// DC offset filter (high-pass)
static float g_dcOffset = 0.0f;
static const float DC_ALPHA = 0.995f;

bool audioInit() {
    if (g_initialized) {
        Serial.println("[Audio] Already initialized");
        return true;
    }
    
    Serial.println("[Audio] Initializing I2S for ICS-43434...");

    // I2S configuration
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = AUDIO_SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT, // 24-bit data in 32-bit frame
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 8,
        .dma_buf_len = 256,
        .use_apll = false,
        .tx_desc_auto_clear = false,
        .fixed_mclk = 0
    };

    // Pin configuration
    i2s_pin_config_t pin_config = {
        .bck_io_num = I2S_SCK_PIN,
        .ws_io_num = I2S_WS_PIN,
        .data_out_num = I2S_PIN_NO_CHANGE,
        .data_in_num = I2S_SD_PIN
    };

    // Install driver
    esp_err_t err = i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
    if (err != ESP_OK) {
        Serial.printf("[Audio] ERROR: i2s_driver_install failed: %d\n", err);
        return false;
    }

    // Set pins
    err = i2s_set_pin(I2S_PORT, &pin_config);
    if (err != ESP_OK) {
        Serial.printf("[Audio] ERROR: i2s_set_pin failed: %d\n", err);
        i2s_driver_uninstall(I2S_PORT);
        return false;
    }

    // Clear DMA buffers
    i2s_zero_dma_buffer(I2S_PORT);

    g_initialized = true;
    g_active = false;
    
    // Start stopped to save power
    i2s_stop(I2S_PORT);

    Serial.println("[Audio] Initialized OK");
    return true;
}

void audioStart() {
    if (!g_initialized || g_active) return;
    
    Serial.println("[Audio] Starting capture...");
    i2s_start(I2S_PORT);
    i2s_zero_dma_buffer(I2S_PORT);
    g_active = true;
    
    // Reset DC offset filter
    g_dcOffset = 0.0f;
    
    delay(100);
    Serial.println("[Audio] Capture started");
}

void audioStop() {
    if (!g_initialized || !g_active) return;
    
    Serial.println("[Audio] Stopping capture...");
    i2s_stop(I2S_PORT);
    g_active = false;
    Serial.println("[Audio] Capture stopped");
}

bool audioIsActive() {
    return g_active;
}

size_t audioCapture(int32_t* buffer, size_t maxSamples) {
    if (!g_initialized || !g_active) {
        return 0;
    }

    size_t bytesToRead = maxSamples * sizeof(int32_t);
    size_t bytesRead = 0;
    
    esp_err_t err = i2s_read(I2S_PORT, buffer, bytesToRead, &bytesRead, portMAX_DELAY);
    
    if (err != ESP_OK) {
        Serial.printf("[Audio] ERROR: i2s_read failed: %d\n", err);
        return 0;
    }
    
    return bytesRead / sizeof(int32_t);
}

float audioSampleToFloat(int32_t rawSample) {
    // ICS-43434 outputs 24-bit data LEFT-ALIGNED in 32-bit frame.
    // Example: A 24-bit value 0x7FFFFF becomes 0x7FFFFF00 in the int32.
    //
    // The ESP32 I2S driver handles byte ordering internally.
    // We receive the data correctly formatted for a little-endian CPU.
    //
    // To normalize: divide by 2^31 (max int32 value for left-aligned 24-bit)
    // This gives us a range of approximately [-1.0, 1.0]
    
    float f = (float)rawSample / 2147483648.0f;
    
    // High-pass filter to remove DC offset (mic bias)
    g_dcOffset = (g_dcOffset * DC_ALPHA) + (f * (1.0f - DC_ALPHA));
    f = f - g_dcOffset;

    return f;
}

float audioSampleToDb(int32_t rawSample) {
    float normalized = audioSampleToFloat(rawSample);
    
    if (fabsf(normalized) < 1e-9f) {
        return -120.0f;
    }

    // dBFS calculation
    float db = 20.0f * log10f(fabsf(normalized));
    return db;
}

AudioAnalysis audioAnalyze() {
    AudioAnalysis result = {0};
    result.success = false;

    if (!g_initialized) {
        Serial.println("[Audio] Error: Audio not initialized");
        return result;
    }

    Serial.println("[Audio] Starting analysis...");

    // 1. Start I2S
    audioStart();

    // 2. Buffer allocation
    static int32_t buffer[AUDIO_BUFFER_SAMPLES];

    // 3. Warm-up (Mic stabilization + DC filter settling)
    for (int i = 0; i < 5; i++) {
        audioCapture(buffer, AUDIO_BUFFER_SAMPLES);
    }

    // 4. Actual Capture
    size_t samplesRead = audioCapture(buffer, AUDIO_BUFFER_SAMPLES);

    if (samplesRead > 0) {
        Serial.printf("[Audio] Captured %d samples\n", samplesRead);

        Serial.println("[Audio] DEBUG Raw samples (first 5):");
        for (int i = 0; i < 5 && i < (int)samplesRead; i++) {
            Serial.printf("  [%d] raw=0x%08X (%d)\n", i, (unsigned int)buffer[i], buffer[i]);
        }

        // 5. Calculate Statistics
        float minVal = 1.0f;
        float maxVal = -1.0f;
        float rmsSum = 0.0f;

        for (size_t i = 0; i < samplesRead; i++) {
            float sample = audioSampleToFloat(buffer[i]);

            if (sample < minVal) minVal = sample;
            if (sample > maxVal) maxVal = sample;

            rmsSum += sample * sample;
        }

        result.minVal = minVal;
        result.maxVal = maxVal;
        result.rms = sqrtf(rmsSum / samplesRead);
        result.rmsDb = 20.0f * log10f(result.rms + 1e-10f);
        result.dbSPL = result.rmsDb + 120.0f; 
        result.success = true;

        Serial.printf("[Audio] Signal: Min=%.6f, Max=%.6f\n", result.minVal, result.maxVal);
        Serial.printf("[Audio] RMS=%.6f, dBFS=%.2f\n", result.rms, result.rmsDb);
        Serial.printf("[Audio] Sound Level: %.1f dB SPL\n", result.dbSPL);

    } else {
        Serial.println("[Audio] ERROR: Failed to capture samples");
    }

    // 6. Stop I2S
    audioStop();
    Serial.println("[Audio] Analysis complete");

    return result;
}

// A-Weighting Filter (IIR Biquad approximation for 16kHz sample rate)
// Coefficients calculated for Fs=16000 Hz using bilinear transform.
// Emphasizes 1-4kHz range (human hearing sensitivity).

// Filter state
static float g_aWeightZ1 = 0.0f;
static float g_aWeightZ2 = 0.0f;

// Biquad coefficients
static const float A_B0 = 0.2343f;
static const float A_B1 = 0.0f;
static const float A_B2 = -0.2343f;
static const float A_A1 = -1.4142f;
static const float A_A2 = 0.5314f;

static float applyAWeighting(float sample) {
    float output = A_B0 * sample + g_aWeightZ1;
    g_aWeightZ1 = A_B1 * sample - A_A1 * output + g_aWeightZ2;
    g_aWeightZ2 = A_B2 * sample - A_A2 * output;
    return output;
}

static void resetAWeightingFilter() {
    g_aWeightZ1 = 0.0f;
    g_aWeightZ2 = 0.0f;
}

// Acoustic Metrics: LAeq, Peak measurement
AudioMetrics audioMeasure(uint32_t durationMs) {
    AudioMetrics result = {0};
    result.success = false;
    result.durationMs = 0;

    if (!g_initialized) {
        Serial.println("[Audio] Error: Not initialized");
        return result;
    }

    Serial.printf("[Audio] Starting %dms measurement...\n", durationMs);

    // Reset filters
    g_dcOffset = 0.0f;
    resetAWeightingFilter();

    // Start I2S
    audioStart();

    // Static buffer
    static int32_t buffer[AUDIO_BUFFER_SAMPLES];

    // Warm-up: 5 buffers to stabilize DC filter and mic
    for (int i = 0; i < 5; i++) {
        size_t read = audioCapture(buffer, AUDIO_BUFFER_SAMPLES);
        for (size_t j = 0; j < read; j++) {
            audioSampleToFloat(buffer[j]); // Process to train DC filter
        }
    }
    resetAWeightingFilter(); // Reset A-weight after warmup

    // Calculate how many samples we need
    uint32_t targetSamples = (AUDIO_SAMPLE_RATE * durationMs) / 1000;
    uint32_t totalSamples = 0;

    // Accumulators
    double sumSquaredA = 0.0; // For LAeq (double for precision)
    float peakA = 0.0f; // Peak A-weighted

    unsigned long startTime = millis();

    // Continuous capture loop
    while (totalSamples < targetSamples) {
        size_t samplesToRead = min((size_t)(targetSamples - totalSamples), (size_t)AUDIO_BUFFER_SAMPLES);
        size_t samplesRead = audioCapture(buffer, samplesToRead);

        if (samplesRead == 0) {
            Serial.println("[Audio] Read error, aborting");
            break;
        }

        for (size_t i = 0; i < samplesRead; i++) {
            // Get normalized sample (DC filtered)
            float sample = audioSampleToFloat(buffer[i]);
            
            // Apply A-weighting
            float sampleA = applyAWeighting(sample);

            // Accumulate for RMS
            sumSquaredA += (double)(sampleA * sampleA);

            // Track peaks (absolute value)
            float absA = fabsf(sampleA);
            if (absA > peakA) peakA = absA;
        }
        totalSamples += samplesRead;
    }

    result.durationMs = millis() - startTime;

    // Stop I2S
    audioStop();

    if (totalSamples > 0) {
        // Calculate RMS
        float rmsA = sqrtf((float)(sumSquaredA / totalSamples));

        // Convert to dB SPL (with calibration offset +120)
        result.LAeq = 20.0f * log10f(rmsA + 1e-10f) + 120.0f;
        result.LApeak = 20.0f * log10f(peakA + 1e-10f) + 120.0f;
        result.success = true;

        Serial.printf("[Audio] Measured %d samples in %dms\n", totalSamples, result.durationMs);
        Serial.printf("[Audio] LAeq=%.1f dB, LApeak=%.1f dB\n", result.LAeq, result.LApeak);
    } else {
        Serial.println("[Audio] ERROR: No samples captured");
    }

    return result;
}