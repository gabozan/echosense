import axios from 'axios';
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import 'leaflet/dist/leaflet.css';

// =============== CONFIG ===============
const BRAND = {
  primary: '#10b981',
  secondary: '#34d399',
  accent: '#059669',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6'
};

const CLASS_CONFIG = {
  silence: { color: '#94a3b8', icon: '🔇', name: 'Silence' },
  traffic: { color: '#ef4444', icon: '🚗', name: 'Traffic' },
  voices: { color: '#3b82f6', icon: '👥', name: 'Voices' },
  music: { color: '#10b981', icon: '🎵', name: 'Music' },
  machinery: { color: '#f59e0b', icon: '⚙️', name: 'Machinery' }
};

const CAMPUS_CENTER = [41.5002, 2.1068];

// =============== COMPONENTS ===============

// Header
function Header() {
  return (
    <div className="header">
      <div className="header-content">
        <div className="header-left">
          <div className="logo-box">
            <svg className="logo-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
            <h1 className="header-title">EchoSense</h1>
            <p className="header-subtitle">Listening to Your Campus, Protecting Your Well-being</p>
          </div>
        </div>
        <div className="header-right">
          <div className="status-indicator"></div>
          <span className="status-text">System Active</span>
        </div>
      </div>
    </div>
  );
}

// Metric Card
function MetricCard({ icon, label, value, unit, color }) {
  return (
    <div className="metric-card">
      <div className="metric-icon" style={{ background: `${color}20`, color: color }}>
        {icon}
      </div>
      <div className="metric-content">
        <div className="metric-label">{label}</div>
        <div className="metric-value">
          {value}<span className="metric-unit">{unit}</span>
        </div>
      </div>
    </div>
  );
}

// Map Section
function CampusMap({ devices, onSelectDevice, highlightedDevices = [] }) {
  const getColor = (laeq) => {
    if (laeq > 75) return BRAND.danger;
    if (laeq > 65) return BRAND.warning;
    return BRAND.primary;
  };

  return (
    <div className="section-card">
      <div className="section-header">
        <h2 className="section-title">🗺️ Campus Acoustic Map</h2>
        <p className="section-subtitle">Real-time monitoring across all locations</p>
      </div>
      <div className="map-container">
        <MapContainer center={CAMPUS_CENTER} zoom={15} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {devices.map(device => {
            const isHighlighted = highlightedDevices.includes(device.id);
            return (
              <CircleMarker
                key={device.id}
                center={[device.lat, device.lon]}
                radius={isHighlighted ? 15 : 10}
                fillColor={getColor(device.laeq)}
                color={isHighlighted ? '#fbbf24' : 'white'}
                weight={isHighlighted ? 4 : 2}
                fillOpacity={0.8}
                eventHandlers={{ click: () => onSelectDevice(device) }}
              >
                <Popup>
                  <div style={{ padding: '8px' }}>
                    <strong>{device.id}</strong><br />
                    <span>{CLASS_CONFIG[device.class].icon} {CLASS_CONFIG[device.class].name}</span><br />
                    <span>{device.laeq.toFixed(1)} dB</span><br />
                    <span>Battery: {device.battery.toFixed(0)}%</span>
                    {isHighlighted && <><br /><span style={{ color: BRAND.primary, fontWeight: 'bold' }}>🌿 Quiet Zone</span></>}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

// Timeline Chart with Node Selector and Time Range Controls
function TimelineChart({ data, deviceName, devices, onSelectDevice, selectedRange, onRangeChange }) {
  const timeRanges = [
    { value: '1h', label: '1 Hora', icon: '⏱️' },
    { value: '6h', label: '6 Horas', icon: '🕐' },
    { value: '12h', label: '12 Horas', icon: '🕛' },
    { value: '24h', label: '24 Horas', icon: '📅' }
  ];

  return (
    <div className="section-card">
      <div className="section-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="section-title">📈 Sound Level Timeline</h2>
            <p className="section-subtitle">
              {deviceName ? `Monitoring: ${deviceName} - ${timeRanges.find(r => r.value === selectedRange)?.label}` : 'Select a device to view timeline'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Time Range Selector */}
            <div style={{ display: 'flex', gap: '6px', background: '#f3f4f6', padding: '4px', borderRadius: '8px' }}>
              {timeRanges.map(range => (
                <button
                  key={range.value}
                  onClick={() => onRangeChange(range.value)}
                  disabled={!deviceName}
                  style={{
                    background: selectedRange === range.value ? BRAND.primary : 'transparent',
                    color: selectedRange === range.value ? 'white' : '#6b7280',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: deviceName ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    opacity: deviceName ? 1 : 0.5
                  }}
                  title={range.label}
                >
                  {range.icon} {range.label}
                </button>
              ))}
            </div>
            
            {/* Node Selector */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {devices.map(device => (
                <button
                  key={device.id}
                  onClick={() => onSelectDevice(device)}
                  style={{
                    background: deviceName === device.id ? BRAND.primary : 'white',
                    color: deviceName === device.id ? 'white' : '#6b7280',
                    border: `2px solid ${deviceName === device.id ? BRAND.primary : '#e5e7eb'}`,
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {device.id.replace('UAB_NODE_', 'N')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="chart-container">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={BRAND.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" stroke="#6b7280" style={{ fontSize: 12 }} />
              <YAxis domain={[40, 90]} stroke="#6b7280" style={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  background: 'white', 
                  border: `2px solid ${BRAND.primary}`,
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                labelStyle={{ fontWeight: 'bold', color: BRAND.primary }}
              />
              <Area type="monotone" dataKey="value" stroke={BRAND.primary} strokeWidth={2} fill="url(#colorGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="chart-empty">
            <p>{deviceName ? '⏳ Cargando datos...' : '📍 Selecciona un nodo para ver su timeline'}</p>
          </div>
        )}
      </div>
      
      {/* Stats Summary */}
      {data.length > 0 && (
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          marginTop: '16px', 
          padding: '12px',
          background: '#f9fafb',
          borderRadius: '8px',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>PROMEDIO</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: BRAND.info }}>
              {(data.reduce((s, d) => s + d.value, 0) / data.length).toFixed(1)} dB
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>MÁXIMO</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: BRAND.danger }}>
              {Math.max(...data.map(d => d.value)).toFixed(1)} dB
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>MÍNIMO</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: BRAND.primary }}>
              {Math.min(...data.map(d => d.value)).toFixed(1)} dB
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>MEDICIONES</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#6b7280' }}>
              {data.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Recommendations
function Recommendations({ devices, onHighlightZones }) {
  const avgNoise = devices.reduce((s, d) => s + d.laeq, 0) / devices.length;
  const quietZones = devices.filter(d => d.laeq < 55);
  const quietZoneIds = quietZones.map(d => d.id);

  const recs = [
    avgNoise > 70 && {
      icon: '🔊',
      title: 'High Average Noise Detected',
      desc: 'Consider noise reduction measures in high-traffic areas',
      color: BRAND.danger,
      action: null
    },
    quietZones.length > 0 && {
      icon: '🌿',
      title: `${quietZones.length} Quiet Zones Available`,
      desc: `Perfect areas for study: ${quietZones.map(d => d.id.replace('UAB_NODE_', 'N')).join(', ')}`,
      color: BRAND.primary,
      action: () => onHighlightZones(quietZoneIds)
    },
    devices.filter(d => d.battery < 30).length > 0 && {
      icon: '🔋',
      title: 'Battery Maintenance Required',
      desc: `${devices.filter(d => d.battery < 30).length} devices need attention`,
      color: BRAND.warning,
      action: null
    }
  ].filter(Boolean);

  return (
    <div className="section-card">
      <div className="section-header">
        <h2 className="section-title">💡 Smart Recommendations</h2>
        <p className="section-subtitle">AI-powered insights for campus acoustics</p>
      </div>
      <div className="recommendations-list">
        {recs.map((rec, i) => (
          <div
            key={i}
            className="recommendation-item"
            style={{
              borderLeftColor: rec.color,
              cursor: rec.action ? 'pointer' : 'default'
            }}
            onClick={rec.action}
          >
            <span className="rec-icon">{rec.icon}</span>
            <div className="rec-content">
              <div className="rec-title">{rec.title}</div>
              <div className="rec-desc">{rec.desc}</div>
              {rec.action && <div style={{ fontSize: '11px', color: BRAND.primary, fontWeight: 600, marginTop: '4px' }}>👆 Click to highlight on map</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Distribution Chart
function DistributionChart({ devices }) {
  const dist = {};
  devices.forEach(d => {
    dist[d.class] = (dist[d.class] || 0) + 1;
  });

  const data = Object.entries(dist).map(([key, value]) => ({
    name: CLASS_CONFIG[key].name,
    count: value,
    fill: CLASS_CONFIG[key].color
  }));

  return (
    <div className="section-card">
      <div className="section-header">
        <h2 className="section-title">📊 Class Distribution</h2>
        <p className="section-subtitle">Sound sources across campus</p>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: 12 }} />
            <YAxis stroke="#6b7280" style={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Public Insights (for students) - NOW FETCHES FROM API
function PublicInsights({ apiUrl }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDailyPattern = async () => {
      try {
        const res = await axios.get(`${apiUrl}/daily-pattern`);
        setData(res.data.data || []);
      } catch (err) {
        console.error('Error fetching daily pattern:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDailyPattern();
    const interval = setInterval(fetchDailyPattern, 300000); // Refresh every 5 min
    return () => clearInterval(interval);
  }, [apiUrl]);

  // Determine best study hours (lowest avg)
  const sorted = [...data].sort((a, b) => a.avg - b.avg);
  const best = sorted.slice(0, 3).map(d => d.hour);

  if (loading) {
    return (
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">📚 Campus Noise Insights</h2>
          <p className="section-subtitle">Loading daily patterns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-card">
      <div className="section-header">
        <h2 className="section-title">📚 Campus Noise Insights</h2>
        <p className="section-subtitle">Find the best study times based on daily sound trends</p>
      </div>
      <div className="chart-container" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hour" stroke="#6b7280" style={{ fontSize: 12 }} />
            <YAxis domain={[40, 80]} stroke="#6b7280" style={{ fontSize: 12 }} />
            <Tooltip />
            <Area type="monotone" dataKey="avg" stroke={BRAND.primary} strokeWidth={2} fillOpacity={0.12} fill={BRAND.primary} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <p style={{ fontWeight: 700, color: '#059669', marginBottom: 6 }}>
          🌅 Recomendación: Los mejores horarios para estudiar hoy
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          {best.map((h, idx) => (
            <div key={idx} style={{
              background: 'white',
              border: `2px solid ${BRAND.primary}`,
              padding: '8px 12px',
              borderRadius: 10,
              fontWeight: 700
            }}>{h}</div>
          ))}
        </div>
        <p style={{ marginTop: 8, color: '#6b7280' }}>
          Tip: Busca zonas marcadas como Quiet Zones en el mapa para maximizar concentración.
        </p>
      </div>
    </div>
  );
}

// Historical Analysis (for staff) - NOW FETCHES FROM API
function HistoricalAnalysis({ apiUrl }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistorical = async () => {
      try {
        const res = await axios.get(`${apiUrl}/historical-zones`);
        setData(res.data.data || []);
      } catch (err) {
        console.error('Error fetching historical zones:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistorical();
    const interval = setInterval(fetchHistorical, 300000); // Refresh every 5 min
    return () => clearInterval(interval);
  }, [apiUrl]);

  if (loading) {
    return (
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">📈 Historical Noise Analysis</h2>
          <p className="section-subtitle">Loading historical data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-card">
      <div className="section-header">
        <h2 className="section-title">📈 Historical Noise Analysis</h2>
        <p className="section-subtitle">Identify peak noise zones and times to guide improvement actions</p>
      </div>
      <div className="chart-container" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="zone" stroke="#6b7280" style={{ fontSize: 12 }} />
            <YAxis domain={[40, 85]} stroke="#6b7280" style={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Morning" stackId="a" fill="#34d399" />
            <Bar dataKey="Afternoon" stackId="a" fill="#f59e0b" />
            <Bar dataKey="Night" stackId="a" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
        <p><strong>Interpretación rápida:</strong> Los periodos de tarde muestran los valores medios más altos en la mayoría de zonas. Recomendado: campañas de concienciación, control de tráfico o medidas de aislamiento acústico en zonas con picos consistentes.</p>
      </div>
    </div>
  );
}

// =============== MAIN APP ===============
export default function App() {
  const [devices, setDevices] = useState([]);
  const [timeseries, setTimeseries] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [highlightedDevices, setHighlightedDevices] = useState([]);
  const [viewMode, setViewMode] = useState('staff'); // 'staff' or 'public'
  const [timeRange, setTimeRange] = useState('24h'); // '1h', '6h', '12h', '24h'

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

  // 🚀 Obtener todos los dispositivos desde el backend
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await axios.get(`${API_URL}/data`);
        setDevices(res.data.data || []);
      } catch (err) {
        console.error('Error fetching devices:', err);
      }
    };

    fetchDevices();
    const interval = setInterval(fetchDevices, 60000); // refrescar cada 60s
    return () => clearInterval(interval);
  }, [API_URL]);

  // Seleccionar un dispositivo y pedir su línea temporal
  const handleSelectDevice = async (device) => {
    setSelectedDevice(device);
    setHighlightedDevices([]);
    await fetchTimeseries(device.id, timeRange);
  };

  // Fetch timeline data with time range
  const fetchTimeseries = async (deviceId, range) => {
    try {
      const res = await axios.get(`${API_URL}/data/${deviceId}?range=${range}`);
      setTimeseries(res.data.data || []);
    } catch (err) {
      console.error('Error fetching timeseries:', err);
      setTimeseries([]);
    }
  };

  // Handle time range change
  const handleRangeChange = (newRange) => {
    setTimeRange(newRange);
    if (selectedDevice) {
      fetchTimeseries(selectedDevice.id, newRange);
    }
  };

  const handleHighlightZones = (deviceIds) => {
    setHighlightedDevices(deviceIds);
  };

  const avgLaeq = devices.length > 0
    ? (devices.reduce((s, d) => s + d.laeq, 0) / devices.length).toFixed(1)
    : '-';

  return (
    <div className="app">
      <Header />

      <div className="container">
        {/* View Mode Toggle */}
        <div className="view-mode-toggle">
          <button
            className={`toggle-btn ${viewMode === 'public' ? 'active' : ''}`}
            onClick={() => setViewMode('public')}
          >
            👨‍🎓 Public View
          </button>
          <button
            className={`toggle-btn ${viewMode === 'staff' ? 'active' : ''}`}
            onClick={() => setViewMode('staff')}
          >
            👔 Staff Dashboard
          </button>
        </div>

        {viewMode === 'public' && (
          <>
            <CampusMap devices={devices} onSelectDevice={handleSelectDevice} highlightedDevices={highlightedDevices} />
            <PublicInsights apiUrl={API_URL} />
          </>
        )}

        {viewMode === 'staff' && (
          <>
            <div className="metrics-grid">
              <MetricCard
                icon="📡"
                label="Active Nodes"
                value={devices.filter(d => d.status === 'online').length}
                unit={` / ${devices.length}`}
                color={BRAND.primary}
              />
              <MetricCard
                icon="📊"
                label="Avg LAeq"
                value={avgLaeq}
                unit=" dB"
                color={BRAND.info}
              />
              <MetricCard
                icon="🌿"
                label="Quiet Zones"
                value={devices.filter(d => d.laeq < 55).length}
                unit=""
                color={BRAND.primary}
              />
              <MetricCard
                icon="⚡"
                label="System Health"
                value="98"
                unit="%"
                color={BRAND.primary}
              />
            </div>

            <CampusMap devices={devices} onSelectDevice={handleSelectDevice} highlightedDevices={highlightedDevices} />

            <TimelineChart
              data={timeseries}
              deviceName={selectedDevice?.id}
              devices={devices}
              onSelectDevice={handleSelectDevice}
              selectedRange={timeRange}
              onRangeChange={handleRangeChange}
            />

            <div className="two-column-grid">
              <Recommendations devices={devices} onHighlightZones={handleHighlightZones} />
              <DistributionChart devices={devices} />
            </div>

            <HistoricalAnalysis apiUrl={API_URL} />
          </>
        )}
      </div>

      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .app {
          min-height: 100vh;
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .header {
          background: white;
          border-bottom: 3px solid #10b981;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .header-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .logo-box {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #10b981, #059669);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .logo-icon {
          width: 32px;
          height: 32px;
          color: white;
        }

        .header-title {
          font-size: 28px;
          font-weight: 800;
          color: #065f46;
          letter-spacing: -0.5px;
        }

        .header-subtitle {
          font-size: 13px;
          color: #6b7280;
          margin-top: 2px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-indicator {
          width: 10px;
          height: 10px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .status-text {
          font-size: 13px;
          font-weight: 600;
          color: #059669;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px;
        }

        .view-mode-toggle {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          background: white;
          padding: 8px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          width: fit-content;
        }

        .toggle-btn {
          padding: 12px 24px;
          border: none;
          background: transparent;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          color: #6b7280;
        }

        .toggle-btn.active {
          background: #10b981;
          color: white;
        }

        .toggle-btn:hover:not(.active) {
          background: #f3f4f6;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .metric-card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }

        .metric-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .metric-content {
          flex: 1;
        }

        .metric-label {
          font-size: 13px;
          color: #6b7280;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .metric-value {
          font-size: 28px;
          font-weight: 800;
          color: #111827;
        }

        .metric-unit {
          font-size: 16px;
          font-weight: 600;
          color: #9ca3af;
        }

        .section-card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          margin-bottom: 24px;
        }

        .section-header {
          margin-bottom: 20px;
        }

        .section-title {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 4px;
        }

        .section-subtitle {
          font-size: 13px;
          color: #6b7280;
        }

        .map-container {
          height: 500px;
          border-radius: 12px;
          overflow: hidden;
          border: 2px solid #e5e7eb;
        }

        .chart-container {
          height: 300px;
        }

        .chart-empty {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9ca3af;
          font-size: 14px;
        }

        .two-column-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
          gap: 24px;
        }

        .recommendations-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .recommendation-item {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 12px;
          border-left: 4px solid;
          transition: all 0.2s;
        }

        .recommendation-item:hover {
          background: #f3f4f6;
          transform: translateX(4px);
        }

        .rec-icon {
          font-size: 24px;
        }

        .rec-content {
          flex: 1;
        }

        .rec-title {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 4px;
        }

        .rec-desc {
          font-size: 13px;
          color: #6b7280;
        }

        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .two-column-grid {
            grid-template-columns: 1fr;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}