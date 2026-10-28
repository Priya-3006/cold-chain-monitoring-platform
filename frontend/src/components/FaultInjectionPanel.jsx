import React, { useState } from 'react';
import { simulatorApi } from '../api/client.js';
import {
  X,
  Sliders,
  Flame,
  DoorOpen,
  ZapOff,
  BatteryWarning,
  WifiOff,
  Navigation,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export default function FaultInjectionPanel({ isOpen, onClose }) {
  const [activeMessage, setActiveMessage] = useState('');
  const [targetContainer, setTargetContainer] = useState('cnt-c015');

  if (!isOpen) return null;

  const showToast = (msg) => {
    setActiveMessage(msg);
    setTimeout(() => setActiveMessage(''), 4000);
  };

  const handleTempSpike = async () => {
    const res = await simulatorApi.injectTempSpike(targetContainer, 9.8);
    showToast(res.message);
  };

  const handleDoorOpen = async () => {
    const res = await simulatorApi.injectDoorOpen(targetContainer, true);
    showToast(res.message);
  };

  const handlePowerCut = async () => {
    const res = await simulatorApi.injectPowerCut(targetContainer, true);
    showToast(res.message);
  };

  const handleLowBattery = async () => {
    const res = await simulatorApi.injectLowBattery(targetContainer, 18);
    showToast(res.message);
  };

  const handleSensorOffline = async () => {
    const res = await simulatorApi.injectSensorOffline(targetContainer, true);
    showToast(res.message);
  };

  const handleRouteDeviation = async () => {
    const res = await simulatorApi.injectRouteDeviation('shp-vc1020', true);
    showToast(res.message);
  };

  const handleTransportDelay = async () => {
    const res = await simulatorApi.injectTransportDelay('shp-vc1020', 35);
    showToast(res.message);
  };

  const handleReset = async () => {
    const res = await simulatorApi.reset();
    showToast(res.message);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-amber-500/5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">IoT Fault Injection Panel</h3>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                Interactive Chaos & Stress Test Controls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Selector */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Target Container Asset:
          </label>
          <select
            value={targetContainer}
            onChange={(e) => setTargetContainer(e.target.value)}
            className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
          >
            <option value="cnt-c015">C015 (Active Compressor - VC1024 Target)</option>
            <option value="cnt-c001">C001 (Active Compressor - 2-8°C)</option>
            <option value="cnt-c002">C002 (In-Transit Reefer Van - VC1020)</option>
            <option value="cnt-c003">C003 (Active Ultra-Cold - -70°C)</option>
            <option value="cnt-c004">C004 (PCM Frozen Carrier - -20°C)</option>
            <option value="cnt-c005">C005 (Passive Coolbox - 2-8°C)</option>
          </select>
        </div>

        {/* Action Message Toast */}
        {activeMessage && (
          <div className="m-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top duration-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-500" />
            <span>{activeMessage}</span>
          </div>
        )}

        {/* Controls Grid */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            One-Click Fault Scenarios:
          </p>

          {/* 1. Temp Spike */}
          <button
            onClick={handleTempSpike}
            className="w-full p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200">Inject Temperature Spike (9.8°C)</h4>
                <p className="text-[11px] text-rose-600 dark:text-rose-400">Exceeds 8.0°C threshold; tests MKT calculation & alerts</p>
              </div>
            </div>
          </button>

          {/* 2. Door Open */}
          <button
            onClick={handleDoorOpen}
            className="w-full p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                <DoorOpen className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">Door Left Ajar (&gt; 180s)</h4>
                <p className="text-[11px] text-amber-600 dark:text-amber-400">Triggers DOOR_OPEN_TOO_LONG & SOP response</p>
              </div>
            </div>
          </button>

          {/* 3. Power Cut */}
          <button
            onClick={handlePowerCut}
            className="w-full p-3 rounded-xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                <ZapOff className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-orange-900 dark:text-orange-200">Simulate AC Power Outage</h4>
                <p className="text-[11px] text-orange-600 dark:text-orange-400">Switches to internal battery, tests hold-time calculation</p>
              </div>
            </div>
          </button>

          {/* 4. Low Battery */}
          <button
            onClick={handleLowBattery}
            className="w-full p-3 rounded-xl border border-yellow-200 dark:border-yellow-900/60 bg-yellow-50/50 dark:bg-yellow-950/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 group-hover:scale-110 transition-transform">
                <BatteryWarning className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-yellow-900 dark:text-yellow-200">Drain Battery to 18%</h4>
                <p className="text-[11px] text-yellow-600 dark:text-yellow-400">Triggers critical battery alert & remaining runtime warnings</p>
              </div>
            </div>
          </button>

          {/* 5. Sensor Offline */}
          <button
            onClick={handleSensorOffline}
            className="w-full p-3 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <WifiOff className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200">Cut Sensor Heartbeat (Offline)</h4>
                <p className="text-[11px] text-purple-600 dark:text-purple-400">Tests "SENSOR OFFLINE - never display stale data" rule</p>
              </div>
            </div>
          </button>

          {/* 6. Route Deviation */}
          <button
            onClick={handleRouteDeviation}
            className="w-full p-3 rounded-xl border border-cyan-200 dark:border-cyan-900/60 bg-cyan-50/50 dark:bg-cyan-950/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-cyan-900 dark:text-cyan-200">Truck Route Deviation (&gt; 2 km)</h4>
                <p className="text-[11px] text-cyan-600 dark:text-cyan-400">Deviates truck TN-01 from corridor; tests map alert & backup lookup</p>
              </div>
            </div>
          </button>

          {/* 7. Traffic Delay */}
          <button
            onClick={handleTransportDelay}
            className="w-full p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-left transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">Add Transport Delay (+35 min)</h4>
                <p className="text-[11px] text-blue-600 dark:text-blue-400">Increases ETA and recalculates multi-factor risk score</p>
              </div>
            </div>
          </button>
        </div>

        {/* Footer Reset */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Nominal State
          </button>
          <span className="text-[11px] font-medium text-slate-400">
            Auto-ticks every 4s
          </span>
        </div>
      </div>
    </div>
  );
}
