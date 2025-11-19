import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { faker } from "@faker-js/faker";
import cors from 'cors';

dotenv.config();

const app = express();
app.use(express.json());

app.use(cors({
  origin: 'http://localhost:3000'
}));

// ================================
// 🔧 CONFIGURACIÓN DESDE .env
// ================================
const PORT = process.env.PORT || 3001;
const SIMULATE = process.env.SIMULATE === "true";
const SIMULATE_INTERVAL_MS = parseInt(process.env.SIMULATE_INTERVAL_MS || "60000");
const CLOUD_INGEST_URL = process.env.CLOUD_INGEST_URL || "http://localhost:4000/ingest";
const CLOUD_API_KEY = process.env.CLOUD_API_KEY || null;

// ================================
// 🔧 NODOS FIJOS DEL CAMPUS
// ================================
const NODE_POSITIONS = [
  { id: 'UAB_NODE_01', lat: 41.5005, lon: 2.1065 },
  { id: 'UAB_NODE_02', lat: 41.5010, lon: 2.1070 },
  { id: 'UAB_NODE_03', lat: 41.4995, lon: 2.1075 },
  { id: 'UAB_NODE_04', lat: 41.5020, lon: 2.1060 },
  { id: 'UAB_NODE_05', lat: 41.4990, lon: 2.1080 },
  { id: 'UAB_NODE_06', lat: 41.5015, lon: 2.1055 }
];

// ================================
// 📦 ALMACENAMIENTO EN MEMORIA
// ================================
let lastData = NODE_POSITIONS.map(node => generateSensorData(node));

// Historial: últimas mediciones por dispositivo
const timeseriesHistory = {};
NODE_POSITIONS.forEach(node => {
  timeseriesHistory[node.id] = [];
});

// Historial agregado por zona y periodo del día (para historical analysis)
const historicalByZone = {};

// ================================
// 🧠 FUNCIÓN: Generar dato simulado por nodo
// ================================
function generateSensorData(node) {
  const laeq = faker.number.float({ min: 40, max: 90, precision: 0.1 });
  const peak = laeq + faker.number.float({ min: 5, max: 15, precision: 0.1 });

  let classification;
  if (laeq < 50) classification = 'silence';
  else {
    const otherClasses = ['traffic', 'voices', 'music', 'machinery'];
    classification = faker.helpers.arrayElement(otherClasses);
  }

  const battery = faker.number.int({ min: 50, max: 100 });
  const timestamp = new Date().toISOString();

  return {
    id: node.id,
    lat: node.lat,
    lon: node.lon,
    laeq,
    peak,
    class: classification,
    battery,
    status: 'online',
    timestamp
  };
}

// ================================
// 🔧 FUNCIÓN: Guardar en historial
// ================================
function saveToHistory(data) {
  const deviceId = data.id;
  const timestamp = new Date(data.timestamp);
  
  // Guardar en timeline
  const timePoint = {
    time: timestamp.toISOString(), // Full ISO timestamp for better filtering
    value: data.laeq,
    timestamp: data.timestamp
  };
  
  if (!timeseriesHistory[deviceId]) {
    timeseriesHistory[deviceId] = [];
  }
  
  timeseriesHistory[deviceId].push(timePoint);
  
  // Mantener solo últimas 1440 mediciones (24 horas con mediciones cada minuto)
  if (timeseriesHistory[deviceId].length > 1440) {
    timeseriesHistory[deviceId].shift();
  }
  
  // Guardar en histórico agregado por zona
  const hour = timestamp.getHours();
  let period;
  if (hour >= 6 && hour < 12) period = 'Morning';
  else if (hour >= 12 && hour < 20) period = 'Afternoon';
  else period = 'Night';
  
  const zoneKey = deviceId.replace('UAB_NODE_', 'N');
  
  if (!historicalByZone[zoneKey]) {
    historicalByZone[zoneKey] = { Morning: [], Afternoon: [], Night: [] };
  }
  
  historicalByZone[zoneKey][period].push(data.laeq);
  
  // Mantener solo últimas 50 mediciones por periodo
  if (historicalByZone[zoneKey][period].length > 50) {
    historicalByZone[zoneKey][period].shift();
  }
}

// ================================
// 🌐 ENDPOINTS
// ================================

// GET /api/data - Obtener estado actual de todos los nodos
app.get("/api/data", (req, res) => {
  res.json({
    success: true,
    count: lastData.length,
    data: lastData,
  });
});

// GET /api/data/:deviceId - Obtener timeline de un dispositivo específico con filtro de rango
app.get("/api/data/:deviceId", (req, res) => {
  const deviceId = req.params.deviceId;
  const range = req.query.range || '24h'; // Default: 24h
  
  let timeline = timeseriesHistory[deviceId] || [];
  
  // Filtrar según el rango temporal solicitado
  const now = new Date();
  let cutoffTime;
  
  switch (range) {
    case '1h':
      cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '6h':
      cutoffTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      break;
    case '12h':
      cutoffTime = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      break;
    case '24h':
    default:
      cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
  }
  
  // Filtrar datos dentro del rango
  const filteredTimeline = timeline.filter(point => {
    const pointTime = new Date(point.timestamp);
    return pointTime >= cutoffTime;
  });
  
  // Formatear el tiempo según el rango para mejor visualización
  const formattedTimeline = filteredTimeline.map(point => {
    const date = new Date(point.timestamp);
    let formattedTime;
    
    if (range === '1h') {
      // Para 1 hora: mostrar HH:MM:SS
      formattedTime = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } else {
      // Para otros rangos: mostrar HH:MM
      formattedTime = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    
    return {
      time: formattedTime,
      value: point.value,
      timestamp: point.timestamp
    };
  });
  
  res.json({
    success: true,
    deviceId: deviceId,
    range: range,
    count: formattedTimeline.length,
    data: formattedTimeline
  });
});

// GET /api/daily-pattern - Patrón diario agregado (para Public Insights)
app.get("/api/daily-pattern", (req, res) => {
  const pattern = Array.from({ length: 24 }, (_, h) => {
    const hourStr = `${String(h).padStart(2, '0')}:00`;
    
    // Calcular promedio de todos los dispositivos en esa hora
    let sum = 0;
    let count = 0;
    
    Object.values(timeseriesHistory).forEach(timeline => {
      timeline.forEach(point => {
        const pointDate = new Date(point.timestamp);
        const pointHour = pointDate.getHours();
        if (pointHour === h) {
          sum += point.value;
          count++;
        }
      });
    });
    
    // Si no hay datos reales, generar mock basado en patrón sinusoidal
    const avg = count > 0 
      ? Math.round((sum / count) * 10) / 10
      : Math.round((48 + Math.abs(Math.sin((h / 24) * 2 * Math.PI)) * 18 + Math.random() * 4 - 2) * 10) / 10;
    
    return { hour: hourStr, avg };
  });
  
  res.json({
    success: true,
    data: pattern
  });
});

// GET /api/historical-zones - Datos históricos agregados por zona
app.get("/api/historical-zones", (req, res) => {
  const zones = Object.keys(historicalByZone).map(zone => {
    const morningAvg = historicalByZone[zone].Morning.length > 0
      ? historicalByZone[zone].Morning.reduce((a, b) => a + b, 0) / historicalByZone[zone].Morning.length
      : 45 + Math.random() * 15;
    
    const afternoonAvg = historicalByZone[zone].Afternoon.length > 0
      ? historicalByZone[zone].Afternoon.reduce((a, b) => a + b, 0) / historicalByZone[zone].Afternoon.length
      : 50 + Math.random() * 20;
    
    const nightAvg = historicalByZone[zone].Night.length > 0
      ? historicalByZone[zone].Night.reduce((a, b) => a + b, 0) / historicalByZone[zone].Night.length
      : 42 + Math.random() * 10;
    
    return {
      zone,
      Morning: Math.round(morningAvg * 10) / 10,
      Afternoon: Math.round(afternoonAvg * 10) / 10,
      Night: Math.round(nightAvg * 10) / 10
    };
  });
  
  // Si no hay datos históricos, generar mock
  if (zones.length === 0) {
    return res.json({
      success: true,
      data: Array.from({ length: 6 }, (_, i) => {
        const base = 45 + Math.random() * 15;
        return {
          zone: `N${i + 1}`,
          Morning: Math.round((base + Math.random() * 10) * 10) / 10,
          Afternoon: Math.round((base + 5 + Math.random() * 15) * 10) / 10,
          Night: Math.round((base - 3 + Math.random() * 6) * 10) / 10
        };
      })
    });
  }
  
  res.json({
    success: true,
    data: zones
  });
});

// ================================
// ☁️ SIMULADOR DE ENVÍOS AUTOMÁTICOS
// ================================
async function sendToCloud(data) {
  try {
    const headers = CLOUD_API_KEY
      ? { "x-api-key": CLOUD_API_KEY, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };

    await axios.post(CLOUD_INGEST_URL, data, { headers });
    console.log(`[SIM] ${data.id} -> enviado a ${CLOUD_INGEST_URL} @ ${data.timestamp}`);
  } catch (err) {
    console.error(`[ERROR] No se pudo enviar ${data.id}: ${err.message}`);
  }
}

// ================================
// 🔁 SIMULACIÓN AUTOMÁTICA
// ================================
if (SIMULATE) {
  console.log(`🔄 Simulación activada: ${NODE_POSITIONS.length} nodos cada ${SIMULATE_INTERVAL_MS / 1000}s`);

  setInterval(async () => {
    lastData = NODE_POSITIONS.map(node => {
      const data = generateSensorData(node);
      saveToHistory(data);
      sendToCloud(data);
      return data;
    });
  }, SIMULATE_INTERVAL_MS);
}

// Generar datos iniciales para el historial (últimas 24 horas)
NODE_POSITIONS.forEach(node => {
  // Generar 1440 puntos (1 por minuto durante 24 horas)
  for (let i = 1440; i >= 0; i--) {
    const data = generateSensorData(node);
    data.timestamp = new Date(Date.now() - i * 60 * 1000).toISOString();
    saveToHistory(data);
  }
});

// ================================
// 🧪 SERVIDOR DE INGESTA OPCIONAL
// ================================
if (CLOUD_INGEST_URL.includes("localhost:4000")) {
  const ingest = express();
  ingest.use(express.json());

  ingest.post("/ingest", (req, res) => {
    console.log("📥 [CLOUD SIM] Datos recibidos:", req.body);
    res.json({ received: true });
  });

  ingest.listen(4000, () => {
    console.log("☁️ Servidor de ingesta activo en http://localhost:4000/ingest");
  });
}

// ================================
// 🚀 ARRANQUE DEL SERVIDOR LOCAL
// ================================
app.listen(PORT, () => {
  console.log(`🌍 EchoSense API corriendo en http://localhost:${PORT}`);
  console.log(`🧩 Endpoints disponibles:`);
  console.log(`   📍 GET  /api/data - Estado actual de todos los nodos`);
  console.log(`   📊 GET  /api/data/:deviceId?range=1h|6h|12h|24h - Timeline de un dispositivo`);
  console.log(`   📈 GET  /api/daily-pattern - Patrón diario agregado`);
  console.log(`   🏛️  GET  /api/historical-zones - Histórico por zonas`);
});