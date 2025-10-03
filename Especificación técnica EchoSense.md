# Especificación técnica EchoSense

> **Objetivo**: Diseñar e implementar un sistema embebido basado en **ESP32-S3** que clasifique en tiempo real sonidos de calle (p. ej., *coches, personas/voz, obras, moto, ambiente/silencio, desconocido*) y envíe conteos/etiquetas al backend preservando la privacidad.

---

## 1) Alcance y casos de uso

**Alcance mínimo (MVP):**

* Captura de audio mono 16 kHz con micrófono MEMS I2S.
* Extracción de **MFCC** (40 coef., ~1.0–1.5 s de ventana) en el ESP32.
* Inferencia **on-device** con **TensorFlow Lite Micro (INT8)**.
* Suavizado temporal + umbrales + conteos por clase cada 60 s.
* Envío de telemetría mediante **HTTP/MQTT**.
* **Sin almacenar audio bruto** (privacidad por diseño).

**Casos de uso:**

* Monitorizar el nivel de actividad por categorías en intersecciones, zonas de obras o calles residenciales.
* Generar **indicadores temporales** (por minuto, hora, día) por clase.
* Detectar cambios en la mezcla acústica (p. ej., inicio/fin de una obra).

**Fuera de alcance (v1):**

* Localización espacial precisa de fuentes (beamforming).
* Clasificación de subclases muy finas (p. ej., tipos específicos de maquinaria de obra).
* Reconocimiento de palabras o identificación personal.

---

## 2) Requisitos de hardware

### 2.1 MCU

* **ESP32-S3** con **PSRAM ≥ 8 MB** (mejor margen para buffers y arena TFLM).
* Alternativas: ESP32-S3-WROOM/ WROVER.

### 2.2 Micrófono

* **MEMS digital I2S**: INMP441, SPH0645, ICS-43434 (puerto superior recomendado si el dispositivo va en exterior).
* Requisitos:

  * Respuesta en frecuencia adecuada 100 Hz–8 kHz.
  * Relación señal/ruido ≥ 60 dB.
  * Salida I2S o PDM (si PDM, incluir conversión a I2S/PCM por software).

### 2.3 Alimentación

* Entrada 5 V (USB-C o **PoE 802.3af** mediante módulo adaptador).
* Regulación a 3.3 V con **LDO de bajo ruido** o step-down + LC/RC para el dominio analógico.
* Protección: TVS, diodo de inversión, fusible resettable.

### 2.4 Conectividad

* **Wi‑Fi** 2.4 GHz.
* (Opcional) **LoRaWAN** si solo se envían conteos y la red Wi‑Fi es poco fiable.

### 2.5 Caja / mecánica

* Rejilla hidrofóbica (Gore) sobre el puerto del micro.
* **Paravientos** (espuma/acústico) y orientación que evite flujo directo.
* Desacoplo mecánico del micro respecto a la carcasa (juntas gomosas).
* Grado de protección sugerido: IP‑54/55 (mínimo para intemperie parcial).

### 2.6 PCB – diseño eléctrico

* Trazado corto y limpio de líneas I2S; plano de masa continuo.
* Separación de dominios (digital/ruido) y filtrado local del micrófono.
* Pads de test para I2S (WS, BCLK, DOUT) y UART.
* Header para **programación/OTA** y recuperación.

---

## 3) Requisitos de firmware

### 3.1 Configuración de audio

* **Frecuencia de muestreo**: 16 kHz (mono, 16-bit PCM; si el MEMS da 24-bit, convertir a 16-bit).
* **Ventanas**: 30 ms (≈480 muestras) con **solape 50%** (hop 15 ms).
* **Ventana de análisis**: 1.0–1.5 s (49–64 frames).
* **Preprocesado**:

  * **Pre-énfasis** (p. ej., y[n] = x[n] − 0.95×x[n−1]).
  * **HPF 100–150 Hz** para mitigar viento/vibración.
  * **Detección de voz/energía** simple para evitar clasificar silencio.

### 3.2 Extracción de características

* **MFCC**: 40 coeficientes; banco mel 64 filtros; FFT de 512 puntos.
* Alternativa: **log‑mel spectrogram** (64 × 64) si la CNN lo requiere.

### 3.3 Modelo en dispositivo

* Arquitectura: **CNN pequeña** (depthwise separable) o conv1D + FC.
* Tamaño: **20–80 k parámetros**; cuantización **INT8**.
* Clases iniciales: `coches`, `personas/voz`, `obras`, `moto`, `ambiente/silencio`, `desconocido`.
* Inferencia objetivo: **< 50–150 ms** por ventana (S3 @ 240 MHz).

### 3.4 Lógica de decisión

* Inferencia cada **0.5 s** con ventana deslizante de ~1 s.
* **Suavizado**: media exponencial sobre 3–5 inferencias.
* **Umbral de confianza**: p ≥ 0.7 (tunable por OTA).
* **Histéresis** y **tiempo mínimo** por evento (p. ej., ≥ 1 s) para evitar parpadeos.
* Salida local: etiqueta + score; contadores por clase/minuto.

### 3.5 Telemetría y privacidad

* **No almacenar ni transmitir audio bruto** por defecto.
* Enviar cada **60 s** payload tipo:

  ```json
  {
    "ts": 1699999999,
    "counts": {"coches": 37, "personas": 12, "obras": 5, "moto": 9, "unknown": 3},
    "rms": 0.21,
    "model": "v1.2.3",
    "uptime_s": 86400
  }
  ```
* Transporte: **MQTT** (QoS 1) o **HTTPS POST**.
* Cifrado: TLS; credenciales por dispositivo.
* Modo **debug** (manual): subir *clips* ≤ 1 s anonimizados para reentrenar (desactivado por defecto, requiere bandera física o comando seguro).

### 3.6 Actualización OTA

* OTA firmado; doble partición A/B.
* Parámetros y umbrales configurables por **endpoint de control**.

---

## 4) Entrenamiento del modelo

### 4.1 Dataset

* **Propio** + fuentes públicas (verificar licencias).
* Recolectar **10–30 min por clase**, en varios lugares y horarios (punta/no‑punta), distancias y oclusiones.
* Etiquetado por segmentos de 1.0–1.5 s con herramienta tipo Audacity/Audino/Edge Impulse Labeling.

### 4.2 Aumentaciones

* Shift temporal, cambio de ganancia ±6 dB.
* Mezcla con **ruido urbano** de fondo a SNR 0–15 dB.
* Reverberación leve (IRs cortas) y *time‑masking* en mel.
* Clase **“desconocido”** con sonidos variados (sirenas, música, perros, etc.).

### 4.3 Entrenamiento y exportación

* Framework: **Keras/PyTorch** o **Edge Impulse**.
* Validación **cross‑location** (evitar sobreajuste a un lugar).
* Métricas: **accuracy**, **F1 macro**, matriz de confusión por clase.
* Exportar **TFLite INT8** (post‑training quantization); guardar **scale**/**zero‑point**.

### 4.4 Verificación en escritorio

* Medir latencia de inferencia simulando el pipeline MFCC.
* Pruebas con *clips* reales no vistos.

---

## 5) Arquitectura de software (alto nivel)

```text
[I2S MEMS] -> [Buffer PCM] -> [Preénfasis + HPF] -> [FFT/Mel/MFCC] -> [TFLM] -> [Suavizado + Umbrales] -> [Conteos/min] -> [MQTT/HTTP]
```

**Módulos:**

* `audio_driver/` (I2S, doble búfer, VAD simple)
* `dsp/` (preénfasis, ventana, FFT, mel, MFCC)
* `model/` (tflite array, TFLM interpreter, arena, INVOKE)
* `logic/` (suavizado EMA, histéresis, ensamblado de eventos)
* `net/` (MQTT/HTTP TLS, reintentos exponenciales)
* `cfg/` (parámetros runtime, OTA)
* `telemetry/` (payloads, health metrics)

---

## 6) Esqueleto de firmware (pseudocódigo C++/Arduino)

```cpp
#include "driver/i2s.h"
#include "tflite-model.h"     // array uint8_t g_model_tflite[]
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"

constexpr int SR = 16000;           // sample rate
constexpr int FRAME_MS = 30;        // ~480 muestras/frame
constexpr int HOP_MS   = 15;        // 50% solape
constexpr int N_FRAMES = 49;        // ~1.0–1.5 s
constexpr int N_MFCC   = 40;

int16_t pcm_window[SR * 1];         // ~1 s
float   mfcc_buf[N_FRAMES * N_MFCC];

static tflite::AllOpsResolver resolver;
static uint8_t tensor_arena[120 * 1024];

void setup_audio_i2s();
void compute_mfcc(const int16_t* pcm, float* out);

void setup() {
  setup_audio_i2s();
  const tflite::Model* model = tflite::GetModel(g_model_tflite);
  static tflite::MicroInterpreter interpreter(model, resolver, tensor_arena, sizeof(tensor_arena));
  interpreter.AllocateTensors();
}

void loop() {
  // 1) llenar pcm_window ~1 s desde I2S
  // 2) preénfasis + HPF + MFCC -> mfcc_buf
  // 3) copiar al input tensor (int8/float según el modelo)
  // 4) interpreter.Invoke()
  // 5) leer logits -> softmax -> clase/score
  // 6) EMA + histéresis + conteos
  // 7) publicar cada 60 s via MQTT/HTTP
}
```

> **Atajo práctico**: con **Edge Impulse** puedes generar el pipeline MFCC + modelo + firmware base para **ESP32‑S3**, incluyendo la arena de TFLM y ejemplos de inferencia.

---

## 7) Rendimiento y consumos (objetivo)

* **Latencia de inferencia**: 50–150 ms por ventana.
* **Memoria**: 100–300 KB (modelo + arena), buffers MFCC aparte (PSRAM ayuda).
* **Exactitud**: 70–90% por clase con buen dataset y balance.
* **Telemetría**: payload cada 10–60 s, < 2 kB.

---

## 8) Validación y pruebas

### 8.1 Pruebas de laboratorio

* Generador de audio + clips reales reproducidos por altavoz.
* Variar SNR, distancias (1–10 m), ángulos, presencia de viento con ventilador.

### 8.2 Pruebas de campo

* Múltiples ubicaciones: calle estrecha, avenida, zona de obras, parque.
* Distintos horarios; registrar **matriz de confusión** por lugar.

### 8.3 Criterios de aceptación

* F1‑macro ≥ 0.75 en **test cross‑location**.
* Falsos positivos de “obras” < 5% en tramos sin obras.
* Pérdida de paquetes < 1% con reintentos.

---

## 9) Telemetría, backend y panel

* Protocolo: **MQTT** (`devices/<id>/events`) o HTTPS.
* Backend agrega conteos por minuto y expone **API** para dashboard.
* Panel con series temporales por clase, heatmaps por hora/día, alarms por umbral.

---

## 10) Seguridad y privacidad

* TLS obligatorio; credenciales únicas por dispositivo.
* **Privacy by default**: solo etiquetas/estadísticos; audio crudo deshabilitado.
* Modo diagnóstico requiere **opt‑in** físico o remoto autenticado + ventana temporal.
* Cumplimiento **GDPR**: DPIA si se despliega a escala, cartelería informativa si procede.

---

## 11) Costes estimados (BOM unitario)

* ESP32‑S3 módulo + PSRAM: **6–10 €**
* Micrófono MEMS I2S: **2–4 €**
* Regulación/pasivos/conectores: **3–5 €**
* Caja + malla/paravientos: **5–10 €**
* **Total**: ~**20–30 €** (sin mano de obra ni PoE).

---

## 12) Roadmap

* **v0.1**: Demo laboratorio (clips sintéticos) + pipeline MFCC + CNN pequeña.
* **v0.2**: Dataset propio + validación cruzada por ubicación.
* **v0.3**: Telemetría MQTT + OTA + panel básico.
* **v1.0**: Envío a campo piloto (5–10 nodos), ajustes de umbrales/EMA, hardening.

---

## 13) Estructura de proyecto (sugerida)

```text
firmware/
  audio_driver/
  dsp/
  model/
  logic/
  net/
  cfg/
  telemetry/
  main.cpp
ml/
  datasets/
    coches/
    personas/
    obras/
    moto/
    ambiente/
    desconocido/
  scripts/
  models/
    esp32_s3_mfcc_int8.tflite
ops/
  ota/
  mqtt_topics.md
  grafana_dashboard.json
docs/
  this_spec.md
```

---

## 14) Checklist de despliegue

* [ ] Ganancia y nivel RMS calibrados en campo.
* [ ] Umbrales de confianza ajustados por lugar.
* [ ] Telemetría recibida y visualizada.
* [ ] OTA verificada (rollback OK).
* [ ] Cartelería/aviso de sensorización si procede.

---

## 15) Preguntas abiertas

* ¿Número objetivo de clases en v1? (equilibrio vs robustez)
* ¿Se requiere conteo absoluto de eventos o proporción temporal?
* ¿Límites de consumo/energía si se alimenta por batería/solar?
* ¿Integración con sistemas municipales existentes (APIs)?
