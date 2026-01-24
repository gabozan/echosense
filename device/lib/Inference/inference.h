#pragma once
#include <Arduino.h>
#include "edge.h"  // For SoundClass enum

// Model configuration (must match training parameters)
#define INFERENCE_SAMPLE_RATE    16000   // Hz
#define INFERENCE_DURATION_MS    2000    // 2 seconds
#define INFERENCE_SAMPLES        (INFERENCE_SAMPLE_RATE * INFERENCE_DURATION_MS / 1000)  // 32000 samples

// Mel spectrogram parameters
#define INFERENCE_N_MELS         32
#define INFERENCE_N_FFT          1024
#define INFERENCE_HOP_LENGTH     512
#define INFERENCE_FMIN           0
#define INFERENCE_FMAX           8000

// Calculated time steps: (32000 / 512) = 62.5 -> 63 frames
#define INFERENCE_TIME_STEPS     63

// Number of sound classes
#define INFERENCE_NUM_CLASSES    5

// Initialize TFLite interpreter and allocate tensors
// Returns true on success, false on failure
bool inferenceInit();

// Streaming Inference API
// 1. Call inferenceStart() to prepare
// 2. Call inferenceProcessChunk() repeatedly with small audio chunks
// 3. Call inferenceEnd() to run the model and get result
bool inferenceStart();
bool inferenceProcessChunk(const int16_t* chunk, size_t numSamples);
SoundClass inferenceEnd(float* confidence = nullptr);



// Get class name as string
const char* inferenceGetClassName(SoundClass soundClass);

// Check if inference system is ready
bool inferenceIsReady();
