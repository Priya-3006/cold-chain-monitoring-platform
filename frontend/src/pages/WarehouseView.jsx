import React, { useState, useEffect } from 'react';
import { warehouseApi, shipmentApi } from '../api/client.js';
import ScannerModal from '../components/ScannerModal.jsx';
import QRViewerModal from '../components/QRViewerModal.jsx';
import confetti from 'canvas-confetti';
import {
  Boxes,
  Barcode,
  QrCode,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ClipboardCheck,
  Clock,
  History
} from 'lucide-react';

export default function WarehouseView() {
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerConfig, setScannerConfig] = useState({});
  const [qrModalData, setQrModalData] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [scanEvents, setScanEvents] = useState([]);

  useEffect(() => {
    loadWarehouseData();
  }, []);

  const loadWarehouseData = async () => {
    try {
      setLoading(true);
      const [tasksRes, eventsRes] = await Promise.all([
        warehouseApi.getTasks(),
        warehouseApi.getScanEvents()
      ]);
      setTasks(tasksRes.tasks || []);
      setScanEvents(eventsRes.scanEvents || []);
      if (tasksRes.tasks?.length > 0 && !selectedTask) {
        setSelectedTask(tasksRes.tasks[0]);
      } else if (selectedTask) {
        // update selected task in-place
        const updated = tasksRes.tasks.find(t => t.id === selectedTask.id);
        if (updated) setSelectedTask(updated);
      }
    } catch (err) {
      console.error('Failed to load warehouse tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  // 1. Trigger Vaccine Scan
  const openVaccineScan = (item) => {
    setScannerConfig({
      title: `Scan Vaccine: ${item.vaccine_name}`,
      description: `Target Batch: ${item.batch_number || 'Any compliant batch'} (Requires ${item.min_temp}°C to ${item.max_temp}°C)`,
      suggestedCodes: [
        { code: 'VA2026-001', label: 'Covaxin Valid Batch (FEFO Recommended)', isError: false },
        { code: 'CS2026-101', label: 'Covishield Valid Batch (2-8°C)', isError: false },
        { code: 'VA2024-EXP', label: 'EXPIRED Batch (Test Regulatory Block)', isError: true },
        { code: 'PF2026-777', label: 'Pfizer Ultra-Cold (-70°C)', isError: false }
      ],
      onSuccess: async (code) => {
        try {
          const res = await warehouseApi.scanVaccine(selectedTask.id, code);
          setFeedback({
            success: res.success,
            title: res.success ? 'Vaccine Scan Verified' : 'Scan Blocked / Exception',
            message: res.message,
            guidance: res.fefoAdvice
          });
          if (res.success) {
            confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
          }
          await loadWarehouseData();
        } catch (err) {
          setFeedback({ success: false, title: 'Scan Error', message: err.message });
        }
      }
    });
    setScannerOpen(true);
  };

  // 2. Trigger Container Scan
  const openContainerScan = () => {
    setScannerConfig({
      title: 'Scan Container QR Code',
      description: 'System will validate operating temperature capability vs vaccine requirements',
      suggestedCodes: [
        { code: 'CONT-C015', label: 'C015 (Compatible 2-8°C Active Refrigerator)', isError: false },
        { code: 'CONT-C001', label: 'C001 (Compatible 2-8°C Active Chiller)', isError: false },
        { code: 'CONT-C003', label: 'C003 (INCOMPATIBLE -70°C Ultra-Cold)', isError: true },
        { code: 'CONT-C004', label: 'C004 (INCOMPATIBLE -20°C Frozen)', isError: true }
      ],
      onSuccess: async (code) => {
        try {
          const res = await warehouseApi.scanContainer(selectedTask.id, code);
          setFeedback({
            success: res.success,
            title: res.success ? 'Container Validated' : 'Container Incompatible',
            message: res.message,
            guidance: res.guidance
          });
          if (res.success) {
            confetti({ particleCount: 40, spread: 70, origin: { y: 0.8 } });
          }
          await loadWarehouseData();
        } catch (err) {
          setFeedback({ success: false, title: 'Container Validation Failed', message: err.message });
        }
      }
    });
    setScannerOpen(true);
  };

  // 3. Trigger Location Put-Away Scan
  const openLocationScan = () => {
    const expectedLocId = 'loc-chn-cra-r01-s01'; // Cold Room A Rack 1 Slot 1
    setScannerConfig({
      title: 'Scan Location QR for Put-Away',
      description: 'Recommends Staging: Cold Room A → Rack R01 → Slot S01',
      suggestedCodes: [
        { code: 'LOC-CHN-CR-A-R01-S01', label: 'CORRECT Location (Cold Room A / R01 / S01)', isError: false },
        { code: 'LOC-CHN-CR-A-R01-S02', label: 'WRONG Location (Cold Room A / R01 / S02)', isError: true },
        { code: 'LOC-CHN-FR-C-R03-S01', label: 'WRONG Zone (Deep Freezer Room C)', isError: true }
      ],
      onSuccess: async (code) => {
        try {
          const res = await warehouseApi.verifyPutAway(selectedTask.id, code, expectedLocId);
          setFeedback({
            success: res.success,
            title: res.success ? 'Put-Away Verified' : 'Location Mismatch',
            message: res.message,
            guidance: res.expected ? `Expected: ${res.expected.code}` : null
          });
          if (res.success) {
            confetti({ particleCount: 50, spread: 80, origin: { y: 0.8 } });
          }
          await loadWarehouseData();
        } catch (err) {
          setFeedback({ success: false, title: 'Put-Away Check Failed', message: err.message });
        }
      }
    });
    setScannerOpen(true);
  };

  // 4. Checklist Item Toggle
  const toggleChecklist = async (key, currentStatus) => {
    try {
      await warehouseApi.updateChecklist(selectedTask.id, key, !currentStatus);
      await loadWarehouseData();
    } catch (err) {
      alert(`Checklist update error: ${err.message}`);
    }
  };

  const isChecklistComplete = selectedTask?.checklist?.every(c => c.passed === 1);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-6 h-6 text-sky-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Guided Warehouse Operations
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Blinkit-Style Step-by-Step Proof-Gated Picking, Validation & Staging
          </p>
        </div>

        {/* Task Selector Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Order Task:</label>
          <select
            value={selectedTask?.id || ''}
            onChange={(e) => {
              const task = tasks.find(t => t.id === e.target.value);
              setSelectedTask(task);
              setFeedback(null);
            }}
            className="py-1.5 px-3 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          >
            {tasks.map(t => (
              <option key={t.id} value={t.id}>
                {t.shipment_number} → {t.destination_name} ({t.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Guided Progress Workflow Steps Ribbon */}
      {selectedTask && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            {/* Step 1: Picking */}
            <div className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 ${
              selectedTask.current_step === 'PICKING'
                ? 'bg-sky-50 border-sky-500 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 shadow-sm ring-2 ring-sky-500/20'
                : selectedTask.items.every(i => i.status === 'PICKED')
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
                : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800/40 dark:border-slate-700'
            }`}>
              <Barcode className="w-5 h-5" />
              <span className="text-xs font-bold">1. Scan Vaccines</span>
              <span className="text-[10px] font-medium">FEFO & Expiry Checked</span>
            </div>

            {/* Step 2: Container */}
            <div className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 ${
              selectedTask.current_step === 'CONTAINER_ASSIGNMENT'
                ? 'bg-sky-50 border-sky-500 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 shadow-sm ring-2 ring-sky-500/20'
                : selectedTask.container_id
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
                : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800/40 dark:border-slate-700'
            }`}>
              <QrCode className="w-5 h-5" />
              <span className="text-xs font-bold">2. Scan Container</span>
              <span className="text-[10px] font-medium">Thermal Compatibility</span>
            </div>

            {/* Step 3: Put-Away */}
            <div className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 ${
              selectedTask.current_step === 'PUT_AWAY'
                ? 'bg-sky-50 border-sky-500 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 shadow-sm ring-2 ring-sky-500/20'
                : selectedTask.current_step === 'LOADING_CHECKLIST' || selectedTask.current_step === 'DOOR_VERIFICATION' || selectedTask.status === 'LOADED'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
                : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800/40 dark:border-slate-700'
            }`}>
              <MapPin className="w-5 h-5" />
              <span className="text-xs font-bold">3. Location Put-Away</span>
              <span className="text-[10px] font-medium">Slot Verification</span>
            </div>

            {/* Step 4: Loading Checklist */}
            <div className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 ${
              selectedTask.current_step === 'LOADING_CHECKLIST' || selectedTask.current_step === 'DOOR_VERIFICATION'
                ? 'bg-sky-50 border-sky-500 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 shadow-sm ring-2 ring-sky-500/20'
                : isChecklistComplete
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
                : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800/40 dark:border-slate-700'
            }`}>
              <ClipboardCheck className="w-5 h-5" />
              <span className="text-xs font-bold">4. Loading Checklist</span>
              <span className="text-[10px] font-medium">Pre-Dispatch Gate</span>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Scan Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3 shadow-md animate-in slide-in-from-top-2 duration-200 ${
          feedback.success
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
        }`}>
          {feedback.success ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs">
            <h4 className="font-extrabold text-sm mb-1">{feedback.title}</h4>
            <p className="font-medium leading-relaxed">{feedback.message}</p>
            {feedback.guidance && (
              <p className="mt-2 font-bold p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-current">
                💡 Guidance: {feedback.guidance}
              </p>
            )}
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Two-Column Layout */}
      {selectedTask && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Active Picking Items & Container */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Picking List */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Barcode className="w-4 h-4 text-sky-500" />
                    Items to Pick for Order {selectedTask.shipment_number}
                  </h3>
                  <p className="text-xs text-slate-500">Scan each vial barcode to verify batch number and FEFO expiry</p>
                </div>
              </div>

              <div className="space-y-3">
                {selectedTask.items.map((item) => {
                  const isComplete = item.quantity_picked >= item.quantity_requested;
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isComplete
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                              {item.vaccine_name}
                            </span>
                            {item.freeze_sensitive === 1 && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                Freeze-Sensitive
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Target Temp: <span className="font-bold text-slate-700 dark:text-slate-300">{item.min_temp}°C to {item.max_temp}°C</span>
                            {item.batch_number && ` • Batch: ${item.batch_number} (Exp: ${item.expiry_date})`}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                              {item.quantity_picked} / {item.quantity_requested}
                            </span>
                            <span className="text-[10px] block text-slate-400">Vials</span>
                          </div>

                          <button
                            onClick={() => openVaccineScan(item)}
                            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                          >
                            <Barcode className="w-4 h-4" />
                            Scan Vial
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Container Compatibility & Scan */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-sky-500" />
                    Container Assignment & Compatibility
                  </h3>
                  <p className="text-xs text-slate-500">Scan container QR code to validate thermal parameters</p>
                </div>
                {selectedTask.container_code && (
                  <button
                    onClick={() => setQrModalData({
                      title: `Container ${selectedTask.container_code}`,
                      subtitle: 'Active Cold-Chain Thermal Shipper',
                      code: `CONT-${selectedTask.container_code}`,
                      type: 'CONTAINER',
                      meta: [
                        { label: 'Operating Temp', value: '2°C to 8°C' },
                        { label: 'Cooling Mode', value: 'Active Chiller' }
                      ]
                    })}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    View Printable Label
                  </button>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-500 font-semibold block">Required Container Type:</span>
                  <span className="font-black text-sm text-slate-900 dark:text-white">
                    {selectedTask.container_code ? `Container ${selectedTask.container_code} (Verified)` : 'C015 (Active Compressor 2-8°C)'}
                  </span>
                </div>

                <button
                  onClick={openContainerScan}
                  className="w-full sm:w-auto px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  {selectedTask.container_code ? 'Re-Scan Container QR' : 'Scan Container QR'}
                </button>
              </div>
            </div>

            {/* Step 3: Location Put-Away */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-sky-500" />
                  Location-Verified Put-Away
                </h3>
                <p className="text-xs text-slate-500">Scan warehouse slot QR code to confirm staging position</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-500 font-semibold block">Recommended Staging Slot:</span>
                  <span className="font-mono font-black text-sm text-sky-600 dark:text-sky-400">
                    CHN-CR-A-R01-S01 (Cold Room A / Rack R01 / Slot S01)
                  </span>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setQrModalData({
                      title: 'Warehouse Storage Slot',
                      subtitle: 'Cold Room A (2-8°C)',
                      code: 'LOC-CHN-CR-A-R01-S01',
                      type: 'LOCATION',
                      meta: [
                        { label: 'Rack', value: 'Rack R01' },
                        { label: 'Slot', value: 'Slot S01' }
                      ]
                    })}
                    className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl"
                  >
                    View Slot QR
                  </button>
                  <button
                    onClick={openLocationScan}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    Verify Put-Away Scan
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Loading Checklist & Scan Logs */}
          <div className="space-y-6">
            {/* Step 4: Digital Loading Checklist */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-sky-500" />
                  Pre-Dispatch Checklist
                </h3>
                <p className="text-xs text-slate-500">Every item must pass before dispatch is unlocked</p>
              </div>

              <div className="space-y-2">
                {selectedTask.checklist
                  ?.filter((item, index, self) =>
                    index === self.findIndex(i => i.item_label === item.item_label)
                  )
                  .map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={item.passed === 1}
                        onChange={() => toggleChecklist(item.item_key, item.passed === 1)}
                        className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                      />
                      <div className="text-xs">
                        <span className={`font-semibold block ${item.passed === 1 ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {item.item_label}
                        </span>
                        {item.verified_by_name && (
                          <span className="text-[10px] text-slate-400">
                            Verified by {item.verified_by_name}
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
              </div>

              {/* Gated Action Button */}
              <button
                disabled={!isChecklistComplete}
                className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Proceed to Door Seal Verification
              </button>
              {!isChecklistComplete && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium">
                  🔒 Dispatch locked: Complete all checklist verifications
                </p>
              )}
            </div>

            {/* Scan History & Audit Trail of Scan Corrections */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-sky-500" />
                  Recent Scan Audits ({scanEvents.length})
                </h3>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {scanEvents.slice(0, 10).map((evt) => (
                  <div
                    key={evt.id}
                    className={`p-2.5 rounded-xl border text-[11px] ${
                      evt.status === 'SUCCESS'
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-300'
                        : 'bg-rose-50/50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold">
                      <span>{evt.scanned_code}</span>
                      <span className="text-[10px] uppercase font-bold">{evt.status}</span>
                    </div>
                    <p className="mt-0.5 text-slate-600 dark:text-slate-400 font-sans line-clamp-2">
                      {evt.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Modal */}
      <ScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title={scannerConfig.title}
        description={scannerConfig.description}
        suggestedCodes={scannerConfig.suggestedCodes}
        onScanSuccess={scannerConfig.onSuccess}
      />

      {/* QR Viewer Modal */}
      <QRViewerModal
        isOpen={Boolean(qrModalData)}
        onClose={() => setQrModalData(null)}
        data={qrModalData}
      />
    </div>
  );
}