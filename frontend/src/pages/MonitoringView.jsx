import React, { useState, useEffect } from 'react';
import { monitoringApi } from '../api/client.js';
import { useSocket } from '../context/SocketContext.jsx';
import DigitalTwinModal from '../components/DigitalTwinModal.jsx';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import {
  Activity,
  ThermometerSnowflake,
  Zap,
  Battery,
  ShieldAlert,
  AlertTriangle,
  Radio,
  DoorOpen,
  WifiOff,
  Flame,
  Clock,
  Layers,
  TrendingUp,
  Cpu
} from 'lucide-react';

export default function MonitoringView() {
  const [overview, setOverview] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState('cnt-c015');
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [selectedTwin, setSelectedTwin] = useState(null);
  const [loading, setLoading] = useState(true);
  const { latestTick } = useSocket();

  useEffect(() => {
    loadOverview();
  }, [latestTick]);

  useEffect(() => {
    if (selectedEntity) {
      loadHistory(selectedEntity);
    }
  }, [selectedEntity]);

  const loadOverview = async () => {
    try {
      const data = await monitoringApi.getOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to load telemetry overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (entityId) => {
    try {
      const data = await monitoringApi.getHistory(entityId, 30);
      setTelemetryHistory(data.history || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const badgeStyles = {
    Safe: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    Warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    Critical: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse',
    Offline: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-sky-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Cold-Chain Monitoring & Sensor Telemetry
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-Time Kinetic Profiling, Predictive Hold-Times & Redundant Probe Health
          </p>
        </div>

        {/* Aggregate KPI Badges */}
        {overview && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-700 dark:text-emerald-300">
              Safe: {overview.totalContainers - overview.criticalCount - overview.warningCount - overview.offlineCount}
            </span>
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl border bg-amber-50 dark:bg-amber-950/30 border-amber-300 text-amber-700 dark:text-amber-300">
              Warning: {overview.warningCount}
            </span>
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl border bg-rose-50 dark:bg-rose-950/30 border-rose-300 text-rose-700 dark:text-rose-300">
              Critical: {overview.criticalCount}
            </span>
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl border bg-slate-100 dark:bg-slate-800 border-slate-300 text-slate-600 dark:text-slate-400">
              Offline: {overview.offlineCount}
            </span>
          </div>
        )}
      </div>

      {/* Power Failure Panel (Prominent when main AC power is lost or running on battery) */}
      {overview?.powerAnomalies?.length > 0 && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent border-2 border-orange-500/30 shadow-md">
          <div className="flex items-center gap-2.5 text-orange-600 dark:text-orange-400 font-extrabold text-sm mb-3">
            <Zap className="w-5 h-5 animate-pulse" />
            <span>CRITICAL POWER MONITORING: Emergency Battery Mode Active</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {overview.powerAnomalies.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-orange-300 dark:border-orange-900/60 shadow-sm text-xs space-y-1.5"
              >
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-900 dark:text-white">{c.container_code}</span>
                  <span className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-extrabold text-[10px]">
                    MAIN POWER OFF
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-slate-500">Current Temp:</span>
                    <p className="font-extrabold text-slate-900 dark:text-white">{c.current_temp}°C</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Battery Level:</span>
                    <p className="font-extrabold text-amber-600">{c.battery_pct}%</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Est. Active Runtime:</span>
                    <p className="font-extrabold text-sky-600">{c.holdTime.batteryHoursRemaining} hrs</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Total Safe Hold:</span>
                    <p className="font-extrabold text-emerald-600">{c.holdTime.totalSafeHoldHours} hrs</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Container Asset Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {overview?.containers?.map((c) => {
          const isSelected = selectedEntity === c.id;
          return (
            <div
              key={c.id}
              onClick={() => setSelectedEntity(c.id)}
              className={`p-4 rounded-3xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-sky-50/50 dark:bg-sky-950/20 border-sky-500 ring-2 ring-sky-500/20 shadow-md'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
              }`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <ThermometerSnowflake className="w-4 h-4 text-sky-500" />
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {c.container_code}
                    </span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeStyles[c.sensorBadge]}`}>
                    {c.sensorBadge}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 truncate mb-3">
                  {c.container_type} • {c.min_temp}°C to {c.max_temp}°C
                </p>

                {/* Primary Temperature Readout */}
                <div className="my-2">
                  {c.isSensorOffline ? (
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-rose-500 mb-1">
                        <WifiOff className="w-3.5 h-3.5" />
                        <span>SENSOR OFFLINE</span>
                      </div>
                      <p className="text-[10px]">Last reading: {c.current_temp}°C at {new Date(c.last_telemetry_at).toLocaleTimeString()}</p>
                    </div>
                  ) : (
                    <div>
                      <span className={`text-2xl font-black tracking-tight ${
                        c.sensorBadge === 'Critical'
                          ? 'text-rose-600 dark:text-rose-400'
                          : c.sensorBadge === 'Warning'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-sky-600 dark:text-sky-400'
                      }`}>
                        {c.current_temp}°C
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 ml-2">
                        MKT: {c.mkt}°C
                      </span>
                    </div>
                  )}
                </div>

                {/* Rate-of-Rise Prediction Pill */}
                {c.prediction?.minutesToThreshold !== null && (
                  <div className="mt-2 py-1 px-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                    {c.prediction.predictionText}
                  </div>
                )}
              </div>

              {/* Footer info & Digital Twin Trigger */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="flex items-center gap-1 font-semibold">
                    <Battery className="w-3 h-3 text-emerald-500" />
                    {c.battery_pct}%
                  </span>
                  <span>•</span>
                  <span className="font-semibold">{c.door_status}</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTwin(c);
                  }}
                  className="text-[11px] font-bold text-sky-500 hover:text-sky-600 hover:underline"
                >
                  Digital Twin →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Entity Deep-Dive Live Chart */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-500" />
              Continuous Thermodynamic Thermal Curve ({selectedEntity})
            </h3>
            <p className="text-xs text-slate-500">
              Live temperature and kinetic deviation against 2°C - 8°C regulatory threshold bands
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 font-semibold text-sky-500">
              <span className="w-3 h-0.5 bg-sky-500 inline-block" /> Temperature (°C)
            </span>
            <span className="flex items-center gap-1 font-semibold text-slate-400">
              <span className="w-3 h-0.5 bg-slate-400 inline-block border-dashed" /> 8.0°C Upper Bound
            </span>
          </div>
        </div>

        {/* Recharts Area/Line Chart */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={telemetryHistory}>
              <defs>
                <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(t) => new Date(t).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
                fontSize={10}
                stroke="#94a3b8"
              />
              <YAxis
                domain={['auto', 'auto']}
                fontSize={10}
                stroke="#94a3b8"
                tickFormatter={(v) => `${v}°C`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontSize: '11px'
                }}
                labelFormatter={(t) => new Date(t).toLocaleString()}
              />
              <Area
                type="monotone"
                dataKey="temperature"
                stroke="#0ea5e9"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorTemp)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Redundant Probe Sensor Comparison Table */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-500" />
              Multi-Probe Redundancy & Drift Comparison
            </h3>
            <p className="text-xs text-slate-500">Cross-verifies primary RTD sensor probe against redundant thermocouple</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Asset</th>
                <th className="py-2.5 px-3">Primary Probe (DS18B20)</th>
                <th className="py-2.5 px-3">Redundant Probe (DHT22)</th>
                <th className="py-2.5 px-3">Variance Δ</th>
                <th className="py-2.5 px-3">Probe Integrity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {overview?.redundantProbes?.map((p) => (
                <tr key={p.containerId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{p.containerCode}</td>
                  <td className="py-2.5 px-3 font-mono text-sky-600 dark:text-sky-400 font-bold">{p.probePrimary}°C</td>
                  <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">{p.probeSecondary}°C</td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">±{p.delta}°C</td>
                  <td className="py-2.5 px-3">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      CALIBRATED & MATCHED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Digital Twin Modal */}
      <DigitalTwinModal
        isOpen={Boolean(selectedTwin)}
        onClose={() => setSelectedTwin(null)}
        container={selectedTwin}
      />
    </div>
  );
}
