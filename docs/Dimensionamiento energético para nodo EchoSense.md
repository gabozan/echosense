# Dimensionamiento energético para nodo EchoSense

> Documento de referencia con cálculos de consumo, autonomía y precios de batería y panel solar para un sistema de clasificación acústica urbano basado en ESP32-S3.

---

## 1) Consumo estimado de la PCB

### Componentes principales

* **ESP32-S3**

  * CPU @80 MHz (modem-sleep): 30–40 mA
  * CPU @240 MHz: 80–120 mA
  * Wi-Fi TX pico: 160–240 mA (ráfagas breves)
  * Light-sleep: 1–2 mA
  * Deep-sleep: 5–20 µA
* **Micrófono MEMS I2S (INMP441/SPH0645/ICS-43434):** 0.6–1.5 mA (constante)
* **Regulación (LDO/buck):** añadir ~10–20 % pérdidas

### Escenarios de consumo

#### 1. Continuo (sin optimizar)

* CPU casi siempre a alta frecuencia, Wi-Fi activo
* Consumo medio: **70–100 mA @3.3 V**
* Potencia: 0.23–0.33 W
* Energía diaria: **5.5–8 Wh/día**

#### 2. Optimizado (recomendado)

* Audio continuo, CPU a 240 MHz solo durante inferencia (~100 ms/s)
* Wi-Fi en power-save, envío cada 60 s
* Consumo medio: **42–45 mA @3.3 V**
* Potencia: ~0.15 W
* Energía diaria: **3.3–3.6 Wh/día**

#### 3. Ultra-bajo (mínimo)

* CPU 80 MHz la mayor parte del tiempo, Wi-Fi apagado salvo cada 15–60 min
* Consumo medio: **5–15 mA @3.3 V**
* Energía diaria: **0.4–1.2 Wh/día**

---

## 2) Dimensionamiento de batería

### Fórmula

[ Batería_{Wh} = \frac{E_{día} \times Días_{respaldo}}{DoD} ]

Supuestos:

* Días de respaldo: 3 días
* Profundidad de descarga (DoD): 80 %
* Tensión nominal: 3.7 V (Li-ion)

### Resultados

* **Optimizado (3.6 Wh/día):**

  * 3.6 × 3 / 0.8 = **13.5 Wh**
  * En Ah: 13.5 / 3.7 = **3.65 Ah ≈ 4000 mAh**

* **Continuo (8 Wh/día):**

  * 8 × 3 / 0.8 = **30 Wh**
  * En Ah: 30 / 3.7 = **8.1 Ah ≈ 10 000 mAh**

### Precios medios de baterías

* **Li-ion 1S (3.7 V, 4000 mAh):** 10–15 €
* **Li-ion 1S (3.7 V, 10 000 mAh, con BMS):** 15–25 €
* **LiFePO₄ 1S (3.2 V, 10 Ah, alta durabilidad):** 35–50 €

---

## 3) Dimensionamiento de panel solar

### Fórmula

[ Panel_{W} = \frac{E_{día} / Eficiencia}{Horas_{sol}} ]

Supuestos:

* Irradiancia estándar: 1000 W/m²
* Eficiencia global (MPPT + batería + DC-DC): 85 %
* Horas de sol pico: 4 h/día

### Resultados

* **Optimizado (3.6 Wh/día):**

  * Energía requerida = 4.24 Wh/día
  * Panel mínimo = 1.06 W

* **Continuo (8 Wh/día):**

  * Energía requerida = 9.41 Wh/día
  * Panel mínimo = 2.35 W

### Recomendaciones prácticas

* Añadir margen ×2–×3 (suciedad, nubes, orientación):

  * **Optimizado:** panel **5 W** suficiente
  * **Continuo:** panel **10 W** recomendado
  * **Crítico:** panel **20–30 W**

### Precios medios paneles 10 W

* Genéricos policristalinos (IP44): **12–20 €**
* Monocristalinos con marco aluminio IP65: **18–30 €**
* Alta eficiencia (SunPower, Victron, Renogy): **30–45 €**

### Superficie estimada

* Policristalino (~15 %): ~660 cm² (22×30 cm)
* Monocristalino (~20 %): ~500 cm² (20×25 cm)
* Alta eficiencia (~22 %): ~450 cm² (18×25 cm)

---

## 4) Configuraciones ejemplo

### A) Económica (pruebas / prototipo)

* Batería: Li-ion 4000 mAh (~15 €)
* Panel: 5 W genérico (~15 €)
* Total ≈ **30 €**

### B) Recomendado (uso urbano estable)

* Batería: Li-ion 10 000 mAh (~20 €)
* Panel: 10 W monocristalino IP65 (~25 €)
* Total ≈ **45 €**

### C) Robusta (alta fiabilidad, clima variable)

* Batería: LiFePO₄ 10 Ah (~40 €)
* Panel: 20 W marca reconocida (~40 €)
* Total ≈ **80 €**

---

## 5) Arquitectura energética

```
[Panel solar 5–20 W] → [Controlador MPPT 1S] → [Batería Li-ion / LiFePO₄ + BMS] → [Buck DC-DC 3.3 V] → [ESP32-S3 + MEMS]
```

---

## 6) Resumen

* **Consumo diario típico (optimizado):** 3.3–3.6 Wh
* **Batería mínima (3 días):** 4000 mAh Li-ion (~15 €)
* **Batería robusta (3 días, uso continuo):** 10 000 mAh (~20 €)
* **Panel recomendado:** 10 W monocristalino (~25 €)
* **Sistema completo (optimizado, fiable):** ~45 € en componentes energéticos

Esto permite un funcionamiento **24/7 autónomo**, con margen para días nublados y ciclos de carga adecuados para despliegues urbanos.
