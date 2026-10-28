import React, { useState, useEffect } from 'react';
import { shipmentApi, alertApi } from '../api/client.js';
import {
  LayoutDashboard,
  ShieldAlert,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingDown,
  Building,
  FileCheck2,
  ThumbsUp,
  ThumbsDown,
  FileWarning
} from 'lucide-react';

export default function ManagerView() {
  const [shipments, setShipments] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decisionModal, setDecisionModal] = useState(null);
  const [decisionNotes, setDecisionNotes] = useState('');

  useEffect(() => {
    loadManagerData();
  }, []);

  const loadManagerData = async () => {
    try {
      setLoading(true);
      const [shipmentsRes, alertsRes] = await Promise.all([
        shipmentApi.getShipments(),
        alertApi.getAlerts()
      ]);
      setShipments(shipmentsRes.shipments || []);
      setAlerts(alertsRes.alerts || []);
    } catch (err) {
      console.error('Failed to load manager data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExcursionApproval = async (alertId, decision) => {
    try {
      await alertApi.submitExcursionDecision(alertId, {
        batchId: 'btc-cov-001',
        shipmentId: 'shp-vc1024',
        mkt: 6.2,
        outOfRangeSecs: 1800,
        recommendation: 'SAFE_TO_USE',
        managerDecision: decision,
        reasoning: decisionNotes || 'Manager evaluated kinetic degradation vs manufacturer stability data'
      });
      alert(`Decision '${decision}' recorded and logged in cryptographic audit trail.`);
      setDecisionModal(null);
      setDecisionNotes('');
      await loadManagerData();
    } catch (err) {
      alert(`Approval submission failed: ${err.message}`);
    }
  };

  // KPIs
  const activeShipments = shipments.filter(s => s.status === 'IN_TRANSIT' || s.status === 'CREATED');
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'EMERGENCY');
  const delayedShipments = shipments.filter(s => s.risk_score > 30);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-sky-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Operations & Quality Command
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Executive Fleet Overview, Kinetic Risk Profiles & Excursion Authorization Workflow
          </p>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Active Consignments</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
              {activeShipments.length}
            </span>
            <span className="text-[10px] text-sky-500 font-bold">1 In-Transit Reefer</span>
          </div>
          <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-500">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Critical Incidents</span>
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block">
              {criticalAlerts.length}
            </span>
            <span className="text-[10px] text-rose-500 font-bold">Requires Action</span>
          </div>
          <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Consignments at Risk</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
              {delayedShipments.length}
            </span>
            <span className="text-[10px] text-amber-500 font-bold">Thermal / Traffic Risk</span>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Compliance Score</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
              98.4%
            </span>
            <span className="text-[10px] text-emerald-500 font-bold">WHO GDP Aligned</span>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Active Excursion Decisions Awaiting Manager Approval */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-amber-500" />
              Excursion Authorization Queue (Manager Sign-Off Required)
            </h3>
            <p className="text-xs text-slate-500">
              Evaluates Arrhenius Mean Kinetic Temperature (MKT) to authorize "Safe to Use", "Quarantine", or "Discard"
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">Batch VA2026-001 (Covaxin BBV152)</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                MKT: 6.2°C (Transient Spike 9.2°C for 20m)
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              System Recommendation: <span className="font-bold text-emerald-600 dark:text-emerald-400">SAFE_TO_USE</span> (Cumulative degradation within WHO 48h tolerance margin).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExcursionApproval('alt-cnt007-batt', 'APPROVED_SAFE')}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <ThumbsUp className="w-4 h-4" />
              Approve Safe to Use
            </button>
            <button
              onClick={() => handleExcursionApproval('alt-cnt007-batt', 'APPROVED_QUARANTINE')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              Quarantine for Testing
            </button>
            <button
              onClick={() => handleExcursionApproval('alt-cnt007-batt', 'APPROVED_DISCARD')}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <ThumbsDown className="w-4 h-4" />
              Order Discard
            </button>
          </div>
        </div>
      </div>

      {/* Fleet & Shipment Risk Table */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-sky-500" />
            Active Fleet Deliveries & Risk Radar
          </h3>
          <p className="text-xs text-slate-500">
            Multi-factor composite risk scoring (Traffic delay, thermal margin, door openings, battery, weather)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Shipment</th>
                <th className="py-2.5 px-3">Vehicle & Driver</th>
                <th className="py-2.5 px-3">Container Temp</th>
                <th className="py-2.5 px-3">Battery</th>
                <th className="py-2.5 px-3">ETA</th>
                <th className="py-2.5 px-3">Risk Score</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {shipments.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-3">
                    <span className="font-mono font-bold text-slate-900 dark:text-white block">{s.shipment_number}</span>
                    <span className="text-[10px] text-slate-400">{s.destination_name}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">{s.vehicle_number || 'Reefer Van'}</span>
                    <span className="text-[10px] text-slate-400">{s.driver_name || 'Fleet Pilot'}</span>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                    {s.current_temp || 4.8}°C
                  </td>
                  <td className="py-3 px-3 font-mono">
                    {s.battery_pct || 90}%
                  </td>
                  <td className="py-3 px-3 font-bold">
                    {s.eta_minutes} min
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full ${s.risk_score > 50 ? 'bg-rose-500' : s.risk_score > 25 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${s.risk_score}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-[11px]">{s.risk_score}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
