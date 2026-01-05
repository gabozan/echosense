#include "audio.h"
#include <driver/i2s.h>

// ============================================================================
// ICS-43434 MEMS Microphone - ESP32 I2S Driver
// ============================================================================
// Key specs from datasheet:
// - 24-bit audio, I2S output
// - Sensitivity: -26 dBFS @ 94 dB SPL  ->  94 = -26 + OFFSET  ->  OFFSET = 120
// - L/R pin LOW = Left channel (data on WS falling edge)
// - L/R pin HIGH = Right channel (data on WS rising edge)
// ============================================================================

#define I2S_PORT I2S_NUM_0

// State
static bool g_initialized = false;
static bool g_active = false;

// DC offset filter (high-pass to remove mic bias)
static float g_dcOffset = 0.0f;
static const float DC_ALPHA = 0.995f;  // Very slow adaptation

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
        .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,  // 24-bit data in 32-bit frame
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,   // <-- MIC IS ON LEFT CHANNEL
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
    
    delay(100);  // Let mic stabilize
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
    
    // With ONLY_LEFT, each sample is a single int32_t (no stereo interleaving)
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
        return -120.0f;  // Silence floor
    }

    // dBFS calculation
    float db = 20.0f * log10f(fabsf(normalized));
    return db;
}