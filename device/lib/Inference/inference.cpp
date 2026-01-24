#include "inference.h"
#include "echosense_model.h"

#include <TensorFlowLite_ESP32.h>
#include <tensorflow/lite/micro/micro_mutable_op_resolver.h>
#include <tensorflow/lite/micro/micro_error_reporter.h>
#include <tensorflow/lite/micro/micro_interpreter.h>
#include <tensorflow/lite/schema/schema_generated.h>

uint8_t* tensorArena = nullptr;
constexpr int kTensorArenaSize = 45 * 1024; // Reduced to 45KB for Tiny INT8 model

// Error reporter for TFLite
static tflite::MicroErrorReporter g_errorReporter;

// TFLite objects
static const tflite::Model* g_model = nullptr;
static tflite::MicroInterpreter* g_interpreter = nullptr;
static TfLiteTensor* g_inputTensor = nullptr;
static TfLiteTensor* g_outputTensor = nullptr;
static bool g_initialized = false;

// Mel filter boundaries (stored instead of full filterbank to save ~130KB)
// Each mel filter only needs: start bin, center bin, end bin
static int g_melBinStart[INFERENCE_N_MELS];
static int g_melBinCenter[INFERENCE_N_MELS];
static int g_melBinEnd[INFERENCE_N_MELS];
static bool g_melFiltersComputed = false;

// Hann window for FFT
static float g_hannWindow[INFERENCE_N_FFT];

// Class names matching Python training
static const char* CLASS_NAMES[INFERENCE_NUM_CLASSES] = {
    "silence", "traffic", "voices", "music", "machinery"
};

// ============================================================================
// Helper: Convert Hz to Mel scale
// ============================================================================
static float hzToMel(float hz) {
    return 2595.0f * log10f(1.0f + hz / 700.0f);
}

// ============================================================================
// Helper: Convert Mel to Hz scale
// ============================================================================
static float melToHz(float mel) {
    return 700.0f * (powf(10.0f, mel / 2595.0f) - 1.0f);
}

// ============================================================================
// Initialize Mel filter boundaries (instead of full filterbank)
// Saves ~130KB of RAM!
// ============================================================================
static void computeMelFilterBoundaries() {
    if (g_melFiltersComputed) return;
    
    float melMin = hzToMel(INFERENCE_FMIN);
    float melMax = hzToMel(INFERENCE_FMAX);
    
    // Compute bin points for each mel filter
    for (int m = 0; m < INFERENCE_N_MELS; m++) {
        float melLow = melMin + (melMax - melMin) * m / (INFERENCE_N_MELS + 1);
        float melCenter = melMin + (melMax - melMin) * (m + 1) / (INFERENCE_N_MELS + 1);
        float melHigh = melMin + (melMax - melMin) * (m + 2) / (INFERENCE_N_MELS + 1);
        
        float hzLow = melToHz(melLow);
        float hzCenter = melToHz(melCenter);
        float hzHigh = melToHz(melHigh);
        
        g_melBinStart[m] = (int)floorf((INFERENCE_N_FFT + 1) * hzLow / INFERENCE_SAMPLE_RATE);
        g_melBinCenter[m] = (int)floorf((INFERENCE_N_FFT + 1) * hzCenter / INFERENCE_SAMPLE_RATE);
        g_melBinEnd[m] = (int)floorf((INFERENCE_N_FFT + 1) * hzHigh / INFERENCE_SAMPLE_RATE);
    }
    
    g_melFiltersComputed = true;
    Serial.println("[INFERENCE] Mel filter boundaries computed (memory-optimized)");
}

// ============================================================================
// Compute mel filter weight on-the-fly (instead of storing full filterbank)
// ============================================================================
static inline float getMelFilterWeight(int melIdx, int binIdx) {
    int start = g_melBinStart[melIdx];
    int center = g_melBinCenter[melIdx];
    int end = g_melBinEnd[melIdx];
    
    if (binIdx < start || binIdx > end) return 0.0f;
    
    if (binIdx <= center) {
        // Rising edge
        if (center == start) return 1.0f;
        return (float)(binIdx - start) / (center - start);
    } else {
        // Falling edge
        if (end == center) return 1.0f;
        return (float)(end - binIdx) / (end - center);
    }
}

// ============================================================================
// Initialize Hann window
// ============================================================================
static void computeHannWindow() {
    for (int i = 0; i < INFERENCE_N_FFT; i++) {
        g_hannWindow[i] = 0.5f * (1.0f - cosf(2.0f * PI * i / (INFERENCE_N_FFT - 1)));
    }
}

// ============================================================================
// Simple DFT - Computes magnitude spectrum for one frame
// ============================================================================


// ============================================================================
// Simple DFT - Computes magnitude spectrum for one frame
// ============================================================================
// ============================================================================
// Optimized FFT (Cooley-Tukey Radix-2)
// ============================================================================
static void computeMagnitudeSpectrum(const float* frame, float* magnitudes) {
    // 1. Copy frame to complex buffer (real, imag interleaved)
    // We reuse memory to avoid stack overflow risks on ESP32
    static float real[INFERENCE_N_FFT];
    static float imag[INFERENCE_N_FFT];
    
    for (int i = 0; i < INFERENCE_N_FFT; i++) {
        real[i] = frame[i];
        imag[i] = 0.0f;
    }

    // 2. Bit Reversal Permutation
    int j = 0;
    for (int i = 0; i < INFERENCE_N_FFT - 1; i++) {
        if (i < j) {
            float tr = real[j]; real[j] = real[i]; real[i] = tr;
            float ti = imag[j]; imag[j] = imag[i]; imag[i] = ti;
        }
        int k = INFERENCE_N_FFT / 2;
        while (k <= j) {
            j -= k;
            k /= 2;
        }
        j += k;
    }

    // 3. FFT Butterfly Operations
    for (int len = 2; len <= INFERENCE_N_FFT; len <<= 1) {
        float ang = -2.0 * PI / len;
        float wlen_r = cos(ang);
        float wlen_i = sin(ang);
        
        for (int i = 0; i < INFERENCE_N_FFT; i += len) {
            float w_r = 1.0f;
            float w_i = 0.0f;
            for (int j = 0; j < len / 2; j++) {
                int u = i + j;
                int v = i + j + len / 2;
                
                float tr = w_r * real[v] - w_i * imag[v];
                float ti = w_r * imag[v] + w_i * real[v];
                
                real[v] = real[u] - tr;
                imag[v] = imag[u] - ti;
                real[u] += tr;
                imag[u] += ti;
                
                float wtypes_r = w_r * wlen_r - w_i * wlen_i;
                w_i = w_r * wlen_i + w_i * wlen_r;
                w_r = wtypes_r;
            }
        }
    }

    // 4. Compute Squared Magnitudes (Power Spectrum)
    // Only need first N/2 + 1 bins (Nyquist)
    int numBins = INFERENCE_N_FFT / 2 + 1;
    for (int k = 0; k < numBins; k++) {
        magnitudes[k] = real[k] * real[k] + imag[k] * imag[k];
    }
}

// ============================================================================
// State for streaming inference
// ============================================================================
static size_t g_samplesProcessed = 0;
static float* g_inputBufferPos = nullptr;

// ============================================================================
// STREAMING API: Start
// ============================================================================
bool inferenceStart() {
    Serial.println("[INFERENCE] Starting Session (Allocating RAM...)");
    
    // 1. Allocate Arena (Just-In-Time)
    if (tensorArena == nullptr) {
        tensorArena = (uint8_t*)heap_caps_malloc(kTensorArenaSize, MALLOC_CAP_8BIT | MALLOC_CAP_INTERNAL);
    }
    
    if (tensorArena == NULL) {
        Serial.println("[INFERENCE] ERROR: OOM - Could not allocate Tensor Arena!");
        return false;
    }
    
    // 2. Create Resolver (Static to avoid reconstruction)
    static tflite::MicroMutableOpResolver<15> resolver;
    static bool resolverInit = false;
    if (!resolverInit) {
        resolver.AddConv2D();
        resolver.AddDepthwiseConv2D();
        resolver.AddMaxPool2D();
        resolver.AddFullyConnected();
        resolver.AddSoftmax();
        resolver.AddReshape();
        resolver.AddQuantize();
        resolver.AddDequantize();
        resolver.AddMean();
        resolver.AddPad();
        resolver.AddMul();
        resolver.AddAdd(); // Added missing opcode
        resolverInit = true;
    }

    // 3. Create Interpreter
    // We MUST use dynamic allocation because the tensorArena changes every time.
    // A static object would keep pointing to the OLD freed memory.
    g_interpreter = new tflite::MicroInterpreter(
        g_model, resolver, tensorArena, kTensorArenaSize, &g_errorReporter
    );

    // 4. Allocate Tensors
    if (g_interpreter->AllocateTensors() != kTfLiteOk) {
        Serial.println("[INFERENCE] ERROR: AllocateTensors failed");
        free(tensorArena);
        tensorArena = nullptr;
        return false;
    }

    // 5. Setup Input Buffer
    g_inputTensor = g_interpreter->input(0);
    g_outputTensor = g_interpreter->output(0);
    
    g_samplesProcessed = 0;
    g_inputBufferPos = g_inputTensor->data.f;
    memset(g_inputBufferPos, 0, INFERENCE_N_MELS * INFERENCE_TIME_STEPS * sizeof(float));
    
    return true;
}

// ============================================================================
// STREAMING API: Process Chunk (calculates FFT -> LogMel for one or more frames)
// ============================================================================
bool inferenceProcessChunk(const int16_t* chunk, size_t numSamples) {
    if (!g_inputBufferPos || !tensorArena) return false; // Guard against uninitialized state

    static float frame[INFERENCE_N_FFT];
    static float magnitudes[INFERENCE_N_FFT / 2 + 1];
    static int16_t sampleWindow[INFERENCE_N_FFT]; 
    static size_t windowPos = 0;
    
    for (size_t i = 0; i < numSamples; i++) {
        sampleWindow[windowPos++] = chunk[i];
        
        if (windowPos >= INFERENCE_N_FFT) {
            // ... (Processing logic remains same) ...
            for (int j = 0; j < INFERENCE_N_FFT; j++) {
                float normalized = (float)(sampleWindow[j]) / 32768.0f;
                frame[j] = normalized * g_hannWindow[j];
            }
            
            computeMagnitudeSpectrum(frame, magnitudes);
            
            int timeStep = g_samplesProcessed / INFERENCE_HOP_LENGTH;
            if (timeStep < INFERENCE_TIME_STEPS) {
                for (int m = 0; m < INFERENCE_N_MELS; m++) {
                    float melEnergy = 0.0f;
                    int start = g_melBinStart[m];
                    // ...
                    int end = g_melBinEnd[m];
                    int numBins = INFERENCE_N_FFT / 2 + 1;
                    for (int k = start; k <= end && k < numBins; k++) {
                        melEnergy += magnitudes[k] * getMelFilterWeight(m, k);
                    }
                    if (melEnergy < 1e-10f) melEnergy = 1e-10f;
                    g_inputBufferPos[(timeStep * INFERENCE_N_MELS) + m] = melEnergy;
                }
            }
            
            memmove(sampleWindow, &sampleWindow[INFERENCE_HOP_LENGTH], 
                    (INFERENCE_N_FFT - INFERENCE_HOP_LENGTH) * sizeof(int16_t));
            windowPos -= INFERENCE_HOP_LENGTH;
            g_samplesProcessed += INFERENCE_HOP_LENGTH;
        }
    }
    return true;
}

// ============================================================================
// STREAMING API: End (Log -> Normalization -> Invoke)
// ============================================================================
// ============================================================================
// STREAMING API: End (Log -> Normalization -> Invoke)
// ============================================================================
SoundClass inferenceEnd(float* confidence) {
    if (!tensorArena) return SoundClass::SILENCE;
    
    float* data = g_inputTensor->data.f;
    int totalElements = INFERENCE_N_MELS * INFERENCE_TIME_STEPS;
    
    // 1. Post-processing: Log & Normalization
    float maxEnergy = 1e-10f;
    for (int i = 0; i < totalElements; i++) {
        if (data[i] > maxEnergy) maxEnergy = data[i];
    }
    
    float sum = 0.0f;
    float sumSq = 0.0f;
    
    for (int i = 0; i < totalElements; i++) {
        float db = 10.0f * log10f(data[i] / maxEnergy);
        data[i] = db;
        sum += db;
        sumSq += db * db;
    }
    
    float mean = sum / totalElements;
    float variance = (sumSq / totalElements) - (mean * mean);
    float stddev = sqrtf(variance + 1e-8f);
    
    for (int i = 0; i < totalElements; i++) {
        data[i] = (data[i] - mean) / stddev;
    }
    
    // 2. Invoke Model (Run Inference)
    unsigned long startTime = millis();
    TfLiteStatus invokeStatus = g_interpreter->Invoke();
    unsigned long inferenceTime = millis() - startTime;
    
    SoundClass result = SoundClass::SILENCE;
    
    if (invokeStatus == kTfLiteOk) {
        // 3. Get Result
        float* outputData = g_outputTensor->data.f;
        int maxIdx = 0;
        float maxVal = outputData[0];
        
        for (int i = 1; i < INFERENCE_NUM_CLASSES; i++) {
            if (outputData[i] > maxVal) {
                maxVal = outputData[i];
                maxIdx = i;
            }
        }
        
        Serial.printf("[INFERENCE] Prediction: %s (%.1f%%) in %lums\n",
                      CLASS_NAMES[maxIdx], maxVal * 100.0f, inferenceTime);
        
        if (confidence) *confidence = maxVal;
        result = static_cast<SoundClass>(maxIdx);
    } else {
        Serial.println("[INFERENCE] ERROR: Invoke failed");
        if (confidence) *confidence = 0.0f;
    }

    // CLEANUP: Free RAM
    // This returns the 40KB to the heap for WiFi usage
    Serial.println("[INFERENCE] Session End (Freeing 40KB RAM)");
    
    // Destroy interpreter FIRST (it uses the arena)
    if (g_interpreter) {
        delete g_interpreter;
        g_interpreter = nullptr;
    }
    
    // Then free arena
    if (tensorArena) {
        free(tensorArena);
        tensorArena = nullptr;
    }
    
    g_inputBufferPos = nullptr;

    return result;
}

// ============================================================================
// Public API: Initialize TFLite (Lite version - No Allocations)
// ============================================================================
bool inferenceInit() {
    if (g_initialized) return true;
    
    Serial.println("[INFERENCE] Initializing (Lite Mode)...");
    
    // 1. Compute DSP tables
    computeMelFilterBoundaries();
    computeHannWindow();
    
    // 2. Validate Model (Pointer only)
    g_model = tflite::GetModel(echosense_model_tflite);
    if (g_model->version() != TFLITE_SCHEMA_VERSION) {
        Serial.printf("[ERROR] Model schema mismatch!\n");
        return false;
    }
    
    Serial.println("[INFERENCE] Model Validated. RAM will be allocated on demand.");

    // Note: We DO NOT allocate tensorArena here anymore.
    // It happens in inferenceStart()
    
    g_initialized = true;
    return true;
}


// ============================================================================
// Public API: Get class name
// ============================================================================
const char* inferenceGetClassName(SoundClass soundClass) {
    int idx = static_cast<int>(soundClass);
    if (idx >= 0 && idx < INFERENCE_NUM_CLASSES) {
        return CLASS_NAMES[idx];
    }
    return "unknown";
}

// ============================================================================
// Public API: Check if ready
// ============================================================================
bool inferenceIsReady() {
    return g_initialized;
}
