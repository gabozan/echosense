<p align="center">
  <img src="assets/images/logo-banner.png" alt="Logo EchoSense" width="600"/>
</p>

EchoSense is an end-to-end IoT acoustic monitoring platform designed for smart campus environments. It captures real-time environmental audio data from distributed sensor nodes, classifies sound sources using on-device machine learning, and provides actionable insights through a modern web dashboard.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [System Components](#system-components)
  - [Device (ESP32 Firmware)](#device-esp32-firmware)
  - [Mobile App (React Native)](#mobile-app-react-native)
  - [Edge Service (FastAPI)](#edge-service-fastapi)
  - [Cloud Service (Azure Functions)](#cloud-service-azure-functions)
  - [ML Model (TensorFlow/TFLite)](#ml-model-tensorflowtflite)
  - [Website (React Dashboard)](#website-react-dashboard)
- [Data Flow](#data-flow)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Technologies](#technologies)
- [License](#license)

---

## Overview

EchoSense addresses the challenge of environmental noise monitoring in large campus settings by combining:

- **Edge AI**: Real-time audio classification on ESP32 microcontrollers
- **IoT Connectivity**: Seamless BLE provisioning and WiFi data transmission
- **Cloud Integration**: Serverless Azure Functions for data ingestion and retrieval
- **Interactive Visualization**: Real-time dashboards with acoustic maps and analytics

### Key Features

| Feature | Description |
|---------|-------------|
| 🎤 **Audio Capture** | High-fidelity 16kHz sampling with ICS-43434 MEMS microphone |
| 🧠 **On-Device ML** | 5-class audio classification using TFLite (11KB model) |
| 📊 **Acoustic Metrics** | LAeq and Peak sound level calculations with A-weighting |
| 📱 **BLE Provisioning** | Mobile app for wireless WiFi credential configuration |
| 🗺️ **Live Mapping** | Interactive campus map with real-time noise visualization |
| 💡 **Smart Insights** | AI-powered recommendations for quiet study zones |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              EchoSense Architecture                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     BLE      ┌─────────────┐
│  Mobile App │◄────────────►│    ESP32    │
| (React Nat) │  WiFi Creds  │    Device   │
└─────────────┘              └──────┬──────┘
                                    │
                                    │ HTTP POST (JSON)
                                    ▼
                             ┌─────────────┐
                             │    Edge     │
                             │  (FastAPI)  │
                             └──────┬──────┘
                                    │
                                    │ HTTP POST
                                    ▼
                             ┌─────────────┐
                             │   Cloud     │
                             │  (Azure     │
                             │  Functions) │
                             └──────┬──────┘
                                    │
                                    │ SQL Bindings
                                    ▼
                             ┌─────────────┐
                             │  Azure SQL  │
                             │  Database   │
                             └──────┬──────┘
                                    │
                                    │ HTTP GET
                                    ▼
                             ┌─────────────┐
                             │   Website   │
                             │   (React)   │
                             └─────────────┘
```

---

## System Components

### Device (ESP32 Firmware)

**Location:** `device/`

The ESP32 firmware is the heart of EchoSense, responsible for audio capture, feature extraction, ML inference, and data transmission.

#### Hardware Requirements

| Component | Specification |
|-----------|---------------|
| MCU | ESP32-WROOM-32 (FireBeetle recommended) |
| Microphone | ICS-43434 MEMS (I2S interface) |
| Power | 3.3V / USB powered |

#### Pin Configuration

| Signal | ESP32 Pin | Description |
|--------|-----------|-------------|
| I2S_SCK | GPIO 18 | Serial Clock |
| I2S_WS | GPIO 19 | Word Select (L/R) |
| I2S_SD | GPIO 21 | Serial Data |

#### Firmware Modules

| Module | File | Description |
|--------|------|-------------|
| **Audio** | `lib/Audio/audio.cpp` | I2S driver, A-weighting filter, LAeq/Peak calculation |
| **Network** | `lib/Network/network.cpp` | BLE server for WiFi provisioning, WiFi client |
| **Inference** | `lib/Inference/inference.cpp` | TFLite interpreter, Log-Mel spectrogram extraction, FFT |
| **Edge** | `lib/Edge/edge.cpp` | HTTP client, JSON payload construction |

#### Audio Processing Pipeline

```
Raw I2S (32-bit) → Convert to 16-bit → Hann Window → FFT → Mel Filterbank → Log Scale → Normalize → TFLite Model
```

Key parameters (synchronized with training):
- Sample Rate: 16,000 Hz
- Duration: 2 seconds
- FFT Size: 1024 samples
- Hop Length: 512 samples
- Mel Bands: 32
- Frequency Range: 0-8000 Hz

#### Sound Classification Classes

| Class ID | Label | Description |
|----------|-------|-------------|
| 0 | `silence` | Ambient quiet / low noise |
| 1 | `traffic` | Vehicles, engines, horns |
| 2 | `voices` | Human speech, laughter, footsteps |
| 3 | `music` | Clapping, keyboard typing, knocking |
| 4 | `machinery` | Sirens, chainsaws, helicopters |

#### Memory Optimization

The firmware implements just-in-time memory allocation to work within ESP32's constraints:
- Tensor arena (45KB) allocated only during inference
- BLE memory released before WiFi initialization
- Streaming audio processing (no large buffers)

#### Build & Flash

```bash
cd device
pio run --target upload
pio device monitor --baud 115200
```

---

### Mobile App (React Native)

**Location:** `mobile-app/`

A cross-platform mobile application for provisioning EchoSense nodes with WiFi credentials via Bluetooth Low Energy (BLE).

#### Features

- **Device Discovery**: Scan for nearby EchoSense nodes advertising the service UUID
- **BLE Connection**: Secure connection to selected devices
- **WiFi Configuration**: Send SSID and password to devices
- **Status Feedback**: Real-time connection and transmission status

#### BLE Protocol

| Characteristic | UUID | Type | Description |
|---------------|------|------|-------------|
| Service | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | - | Nordic UART Service |
| Credentials | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` | Write | WiFi credentials |

**Payload Format:** `<SSID>|<PASSWORD>` (ASCII, Base64 encoded)

#### Screens

| Screen | File | Description |
|--------|------|-------------|
| Device List | `src/screens/DeviceListScreen.tsx` | Displays discovered BLE devices |
| WiFi Config | `src/screens/WifiConfigScreen.tsx` | SSID/Password input form |

#### Key Dependencies

| Package | Purpose |
|---------|---------|
| `react-native-ble-plx` | BLE communication |
| `@react-navigation/native-stack` | Navigation |
| `expo` | Development framework |

#### Run the App

```bash
cd mobile-app
npm install
npx expo run:android  # For Android
```

---

### Edge Service (FastAPI)

**Location:** `edge/`

A lightweight edge gateway that receives data from ESP32 devices and forwards it to the cloud. Designed for deployment on local servers or edge computing devices.

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/edge-sim` | Receive device payload and forward to cloud |

#### Request Payload Schema

```json
{
  "id": "es-node-001",
  "laeq": 62.5,
  "peak": 78.3,
  "class": "traffic",
  "status": "online",
  "timestamp": "2026-01-24T18:00:00.123Z"
}
```

#### Configuration

Environment variables (`.env`):

| Variable | Description | Example |
|----------|-------------|---------|
| `CLOUD_API_URL` | Azure Functions endpoint | `https://func-app.azurewebsites.net/api` |

#### Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   FastAPI    │───►│   Forwarder  │───►│  Azure Cloud │
│   Router     │    │   Service    │    │   Functions  │
└──────────────┘    └──────────────┘    └──────────────┘
       │                   │
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│   Pydantic   │    │    httpx     │
│   Models     │    │   (async)    │
└──────────────┘    └──────────────┘
```

#### Run Locally

```bash
cd edge
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Docker Deployment

```bash
cd edge
docker compose up --build
```

---

### Cloud Service (Azure Functions)

**Location:** `cloud/`

Serverless backend running on Azure Functions with SQL database bindings for data persistence.

#### Functions

| Function | Route | Method | Description |
|----------|-------|--------|-------------|
| `ingestData` | `/api/ingestData` | POST | Insert device readings into database |
| `nodeRegistration` | `/api/nodeRegistration` | POST | Register new sensor nodes (metadata) |
| `obtainRawData` | `/api/obtainRawData` | GET | Retrieve all historical readings |
| `obtainData` | `/api/obtainData` | GET | Get latest reading per node with metadata enrichment |

#### Database Schema

**Table: `device_payloads`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR | Device identifier |
| `laeq` | FLOAT | Equivalent continuous sound level (dB) |
| `peak` | FLOAT | Peak sound level (dB) |
| `class` | VARCHAR | Sound classification label |
| `status` | VARCHAR | Device status (online/offline/damaged) |
| `timestamp` | DATETIME2 | Measurement timestamp (UTC) |

**Table: `node_metadata`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR | Device identifier |
| `lat` | FLOAT | Latitude coordinate |
| `lon` | FLOAT | Longitude coordinate |
| `battery` | FLOAT | Battery level (%) |

#### Configuration

Application settings:

| Setting | Description |
|---------|-------------|
| `SqlConnectionString` | Azure SQL connection string |

#### Deploy to Azure

```bash
cd cloud
func azure functionapp publish <FunctionAppName>
```

---

### ML Model (TensorFlow/TFLite)

**Location:** `model/`

A convolutional neural network trained for environmental sound classification, optimized for edge deployment on ESP32.

#### Training Pipeline

1. **Dataset**: ESC-50 (subset) + synthetic silence samples
2. **Features**: Log-Mel Spectrogram (32 bands × 63 time steps)
3. **Architecture**: 3-layer CNN with GlobalAveragePooling
4. **Quantization**: INT8 (4x compression)

#### Model Architecture

```
Input (32, 63, 1)
    │
    ▼
Conv2D(8, 3x3) + ReLU + MaxPool(2x2)
    │
    ▼
Conv2D(16, 3x3) + ReLU + MaxPool(2x2)
    │
    ▼
Conv2D(32, 3x3) + ReLU + GlobalAvgPool
    │
    ▼
Dropout(0.2)
    │
    ▼
Dense(5) + Softmax
```

#### Training Configuration

| Parameter | Value |
|-----------|-------|
| Sample Rate | 16,000 Hz |
| Duration | 2.0 seconds |
| Mel Bands | 32 |
| FFT Size | 1024 |
| Hop Length | 512 |
| Epochs | 30 |
| Batch Size | 32 |
| Learning Rate | 0.001 |

#### Data Augmentation

- Time shifting (±20%)
- Gaussian noise injection
- Pitch shifting (±3 semitones)
- Time stretching (0.8x - 1.2x)
- SpecAugment (frequency/time masking)

#### Output Files

| File | Size | Description |
|------|------|-------------|
| `echosense_model.tflite` | ~12 KB | Quantized model for ESP32 |
| `echosense_best_model.keras` | ~116 KB | Full precision Keras model |
| `confusion_matrix_esp32.png` | - | Evaluation visualization |

#### Train the Model

```bash
cd model
python training.py
```

> **Note**: Requires ESC-50 dataset downloaded to the path specified in `CONFIG['esc50_path']`

---

### Website (React Dashboard)

**Location:** `website/`

A modern, responsive web dashboard providing real-time visualization and analytics of campus acoustic data.

#### Features

| Feature | Description |
|---------|-------------|
| 🗺️ **Acoustic Map** | Interactive Leaflet map with color-coded noise levels |
| 📊 **Distribution Analytics** | Bar charts showing sound class distribution |
| 💡 **Smart Recommendations** | AI-powered insights for noise management |
| 🏥 **Device Health Monitor** | Real-time status of all sensor nodes |

#### Components

| Component | Description |
|-----------|-------------|
| `Header` | Branding and system status indicator |
| `MetricCard` | Summary statistics display |
| `CampusMap` | Leaflet map with CircleMarkers |
| `TimelineChart` | Recharts AreaChart with time range controls |
| `DistributionChart` | Sound class bar chart |
| `Recommendations` | AI-generated insights |
| `DeviceHealthMonitor` | Node status grid |
| `PublicInsights` | Student-facing daily patterns |

#### Color Coding

| Noise Level (dB) | Color | Meaning |
|------------------|-------|---------|
| < 65 | 🟢 Green | Comfortable |
| 65 - 75 | 🟡 Yellow | Moderate |
| > 75 | 🔴 Red | High |

#### Run Locally

```bash
cd website
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Environment Variables

Create `.env` in the `website/src/` directory:

```env
REACT_APP_API_URL=https://your-azure-function.azurewebsites.net/api
```

---

## Data Flow

### Complete System Flow

```
1. USER PROVISIONING
   ┌─────────────────────────────────────────────────────────────┐
   │ Mobile App → BLE → ESP32: Send WiFi SSID + Password         │
   └─────────────────────────────────────────────────────────────┘
                              │
                              ▼
2. DEVICE OPERATION (Every 10 seconds)
   ┌─────────────────────────────────────────────────────────────┐
   │ ESP32: Capture 2s audio → Extract Log-Mel → Run TFLite      │
   │        → Measure LAeq/Peak → Build JSON payload             │
   └─────────────────────────────────────────────────────────────┘
                              │
                              ▼
3. DATA TRANSMISSION
   ┌─────────────────────────────────────────────────────────────┐
   │ ESP32 → HTTP POST → Edge Server → HTTP POST → Azure Cloud   │
   └─────────────────────────────────────────────────────────────┘
                              │
                              ▼
4. DATA PERSISTENCE
   ┌─────────────────────────────────────────────────────────────┐
   │ Azure Functions → SQL Bindings → Azure SQL Database         │
   └─────────────────────────────────────────────────────────────┘
                              │
                              ▼
5. VISUALIZATION
   ┌─────────────────────────────────────────────────────────────┐
   │ Website → HTTP GET → Azure Functions → Display Dashboard    │
   └─────────────────────────────────────────────────────────────┘
```

### Payload Example

```json
{
  "id": "es-node-001",
  "laeq": 62.5,
  "peak": 78.3,
  "class": "traffic",
  "status": "online",
  "timestamp": "2026-01-24T18:00:00.123Z"
}
```

---

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| PlatformIO | Latest | ESP32 firmware development |
| Node.js | 18+ | Mobile app & website |
| Python | 3.10+ | Edge service & ML training |
| Azure CLI | Latest | Cloud deployment |
| Docker | Latest | Edge containerization |

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/echosense.git
   cd echosense
   ```

2. **Deploy Cloud Functions** (Azure)
   ```bash
   cd cloud
   func azure functionapp publish <YourFunctionApp>
   ```

3. **Start Edge Service**
   ```bash
   cd edge
   docker-compose up -d
   ```

4. **Flash ESP32 Device**
   ```bash
   cd device
   pio run --target upload
   ```

5. **Run Mobile App**
   ```bash
   cd mobile-app
   npm install
   npx expo run:android
   ```

6. **Start Website**
   ```bash
   cd website
   npm install
   npm start
   ```

---

## Configuration

### Device Configuration

Edit `device/lib/Edge/edge.h`:

```cpp
#define EDGE_SERVER_URL "http://<your-edge-ip>:8000/edge-sim"
```

Edit `device/lib/Network/network.h`:

```cpp
#define BLE_DEVICE_NAME "EchoSense-001"
```

### Edge Configuration

Create `edge/.env`:

```env
CLOUD_API_URL=https://your-function-app.azurewebsites.net/api
REQUEST_TIMEOUT=30
MAX_RETRIES=3
```

### Cloud Configuration

Set Azure Function App settings:

```bash
az functionapp config appsettings set \
  --name <FunctionAppName> \
  --resource-group <ResourceGroup> \
  --settings SqlConnectionString="<YourConnectionString>"
```

---

## API Reference

### Edge API

#### POST `/edge-sim`

Receive and forward device payload.

**Request:**
```json
{
  "id": "string",
  "laeq": "number",
  "peak": "number",
  "class": "silence|traffic|voices|music|machinery",
  "status": "online|offline|error",
  "timestamp": "ISO8601 datetime"
}
```

**Response:**
```json
{
  "message": "Data received and forwarded to the cloud.",
  "cloud_status": 201
}
```

### Cloud API

#### POST `/api/ingestData`

Insert new sensor reading.

#### GET `/api/obtainData`

Get latest reading per device with metadata.

**Response:**
```json
[
  {
    "id": "es-node-001",
    "lat": 41.5002,
    "lon": 2.1068,
    "laeq": 62.5,
    "peak": 78.3,
    "class": "traffic",
    "battery": 85.0,
    "status": "online",
    "timestamp": 1706115600
  }
]
```

---

## Project Structure

```
echosense/
├── device/                    # ESP32 PlatformIO firmware
│   ├── src/
│   │   └── main.cpp          # Main application loop
│   ├── lib/
│   │   ├── Audio/            # I2S driver, A-weighting, metrics
│   │   ├── Edge/             # HTTP client, payload builder
│   │   ├── Inference/        # TFLite, FFT, Mel spectrogram
│   │   └── Network/          # BLE server, WiFi client
│   └── platformio.ini        # Build configuration
│
├── mobile-app/                # React Native (Expo) application
│   ├── src/
│   │   ├── screens/          # DeviceList, WifiConfig
│   │   ├── services/         # BLEService
│   │   ├── hooks/            # useBLE
│   │   └── components/       # UI components
│   └── package.json
│
├── edge/                      # FastAPI edge gateway
│   ├── app/
│   │   ├── api/              # Route handlers
│   │   ├── models/           # Pydantic schemas
│   │   ├── services/         # Cloud forwarder
│   │   └── core/             # Configuration
│   ├── Dockerfile
│   └── requirements.txt
│
├── cloud/                     # Azure Functions backend
│   ├── function_app.py       # All function definitions
│   ├── host.json
│   └── requirements.txt
│
├── model/                     # ML training pipeline
│   ├── training.py           # Full training script
│   ├── echosense_model.tflite
│   └── confusion_matrix_esp32.png
│
├── website/                   # React dashboard
│   ├── src/
│   │   ├── App.js            # Main application
│   │   └── index.css         # Styles
│   └── package.json
│
└── README.md                  # This file
```

---

## Technologies

### Hardware

| Component | Description |
|-----------|-------------|
| ESP32 | Dual-core 240MHz, WiFi + BLE |
| ICS-43434 | MEMS microphone, 24-bit I2S |

### Firmware

| Technology | Purpose |
|------------|---------|
| PlatformIO | Build system |
| Arduino Framework | Hardware abstraction |
| TensorFlow Lite Micro | On-device ML |
| ArduinoJson | JSON serialization |

### Mobile

| Technology | Purpose |
|------------|---------|
| React Native | Cross-platform UI |
| Expo | Development toolchain |
| react-native-ble-plx | BLE communication |
| React Navigation | Screen navigation |

### Backend

| Technology | Purpose |
|------------|---------|
| FastAPI | Edge REST API |
| Azure Functions | Serverless compute |
| Azure SQL Database | Data persistence |
| Python httpx | Async HTTP client |

### Frontend

| Technology | Purpose |
|------------|---------|
| React 19 | UI framework |
| Leaflet | Interactive maps |
| Recharts | Data visualization |
| Axios | HTTP client |

### Machine Learning

| Technology | Purpose |
|------------|---------|
| TensorFlow/Keras | Model training |
| TFLite | Model optimization |
| librosa | Audio processing |
| scikit-learn | Evaluation metrics |

---

## License

This project is developed for academic and research purposes.

---

<p align="center">
  <strong>EchoSense</strong> — Listening to Your Campus, Protecting Your Well-being
</p>
