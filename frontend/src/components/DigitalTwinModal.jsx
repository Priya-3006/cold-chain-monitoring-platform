import React, { useState, useEffect } from 'react';
import { X, Box, Battery, Thermometer, ShieldCheck, DoorClosed, DoorOpen, Zap, Droplets } from 'lucide-react';
import { warehouseApi } from '../api/client.js';

export default function DigitalTwinModal({ isOpen, onClose, container }) {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !container) return;
    setLoading(true);
    warehouseApi.getContainerTree(container.id)
      .then(res => setContents(res.contents || []))
      .catch(() => setContents([]))
      .finally(() => setLoading(false));
  }, [isOpen, container]);

  if (!isOpen || !container) return null;

  const isTempSafe = container.current_temp >= container.min_temp && container.current_temp <= container.max_temp;
  const isDoorOpen = container.door_status === 'OPEN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-sky-500/10 via-cyan-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500 text-white shadow-md shadow-sky-500/25">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Container Digital Twin: {container.container_code}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {container.container_type}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Operating Specification: {container.min_temp}°C to {container.max_temp}°C ({container.cooling_capability})
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Digital Twin 3D/Schematic Representation */}
          <div className="relative rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-6 bg-slate-50 dark:bg-slate-950/60 overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Visual Box Diagram */}
            <div className="relative w-48 h-48 rounded-2xl border-4 flex flex-col justify-between p-3 transition-all duration-300 shadow-xl"
              style={{
                borderColor: !isTempSafe ? '#f43f5e' : isDoorOpen ? '#f59e0b' : '#0ea5e9',
                backgroundColor: !isTempSafe ? 'rgba(244, 63, 94, 0.08)' : 'rgba(14, 165, 233, 0.06)'
              }}
            >
              {/* Cold Air Circulator Fan Animation */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-slate-500">TAG: {container.qr_code}</span>
                <div className={`w-3.5 h-3.5 rounded-full ${isDoorOpen ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
              </div>

              {/* Center Temperature readout */}
              <div className="text-center my-auto">
                <span className={`text-3xl font-black tracking-tight ${!isTempSafe ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400'}`}>
                  {container.current_temp}°C
                </span>
                <span className="block text-[10px] font-semibold text-slate-500 mt-0.5">
                  Core Thermal Probe
                </span>
              </div>

              {/* Status Footer inside schematic */}
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                  <Droplets className="w-3.5 h-3.5 text-cyan-500" />
                  {container.current_humidity || 50}% RH
                </span>
                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                  <Battery className="w-3.5 h-3.5 text-emerald-500" />
                  {container.battery_pct}%
                </span>
              </div>
            </div>

            {/* Live Sub-systems Breakdown */}
            <div className="flex-1 w-full space-y-3">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isDoorOpen ? (
                    <DoorOpen className="w-5 h-5 text-amber-500" />
                  ) : (
                    <DoorClosed className="w-5 h-5 text-emerald-500" />
                  )}
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">Physical Door Seal</h5>
                    <p className="text-[11px] text-slate-500">Magnetic Reed Proximity Sensor</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDoorOpen ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                  {container.door_status}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-sky-500" />
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">Power Delivery</h5>
                    <p className="text-[11px] text-slate-500">Active Peltier / Compressor Source</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {container.power_status}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-500" />
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">Thermal Compliance</h5>
                    <p className="text-[11px] text-slate-500">Kinetic margin tolerance</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isTempSafe ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>
                  {isTempSafe ? 'Compliant' : 'Excursion'}
                </span>
              </div>
            </div>
          </div>

          {/* Stored Contents Tree */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Inside This Container: Manifest & Vaccine Batches ({contents.length})
            </h4>

            {loading ? (
              <div className="text-center py-6 text-xs text-slate-400">Loading contents tree...</div>
            ) : contents.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                Container currently empty or waiting for picking loading.
              </div>
            ) : (
              <div className="space-y-2">
                {contents.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{item.vaccine_name}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Batch: {item.batch_number} • Exp: {item.expiry_date}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-sky-600 dark:text-sky-400 text-sm block">
                        {item.quantity} vials
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        {item.safety_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-white dark:bg-slate-900">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors"
          >
            Close Digital Twin
          </button>
        </div>
      </div>
    </div>
  );
}
