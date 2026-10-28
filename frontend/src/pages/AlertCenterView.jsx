import React, { useState, useEffect } from 'react';
import { alertApi } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import PhotoCaptureModal from '../components/PhotoCaptureModal.jsx';
import {
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  FileCheck2,
  ChevronRight,
  SlidersHorizontal,
  Camera
} from 'lucide-react';

export default function AlertCenterView() {
  const { user } = useAuth();
  const { lastAlertEvent } = useSocket();
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [alertDetails, setAlertDetails] = useState(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionTaken, setActionTaken] = useState('');
  const [rootCause, setRootCause] = useState('Refrigeration Failure');
  const [proofPhoto, setProofPhoto] = useState(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, [lastAlertEvent]);

  useEffect(() => {
    if (selectedAlert) {
      loadAlertDetails(selectedAlert.id);
    }
  }, [selectedAlert]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const res = await alertApi.getAlerts();
      setAlerts(res.alerts || []);
      if (res.alerts?.length > 0 && !selectedAlert) {
        setSelectedAlert(res.alerts[0]);
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAlertDetails = async (id) => {
    try {
      const res = await alertApi.getAlertDetails(id);
      setAlertDetails(res);
    } catch (err) {
      console.error('Failed to load alert details:', err);
    }
  };

  const handleAcknowledge = async () => {
    try {
      await alertApi.acknowledge(selectedAlert.id);
      await loadAlerts();
      await loadAlertDetails(selectedAlert.id);
    } catch (err) {
      alert(`Acknowledge failed: ${err.message}`);
    }
  };

  const handleSubmitAction = async (e) => {
    e.preventDefault();
    try {
      await alertApi.recordAction(selectedAlert.id, {
        actionTaken,
        rootCause,
        proofFileId: proofPhoto?.id || null
      });
      setActionModalOpen(false);
      setActionTaken('');
      setProofPhoto(null);
      await loadAlerts();
      await loadAlertDetails(selectedAlert.id);
    } catch (err) {
      alert(`Action submission failed: ${err.message}`);
    }
  };

  const handleResolve = async () => {
    try {
      await alertApi.resolve(selectedAlert.id, 'Verified and stabilized by operator/supervisor.');
      await loadAlerts();
      await loadAlertDetails(selectedAlert.id);
    } catch (err) {
      alert(`Resolve failed: ${err.message}`);
    }
  };

  const severityBadges = {
    EMERGENCY: 'bg-red-600 text-white animate-pulse',
    CRITICAL: 'bg-rose-500 text-white',
    WARNING: 'bg-amber-500 text-white',
    LOW: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
  };

  const statusBadges = {
    CREATED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    ASSIGNED: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    ACKNOWLEDGED: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    ACTION_TAKEN: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
    VERIFIED: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
    RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Smart Alert & Response Workflow
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Closed-Loop Lifecycle: Trigger → Auto-Assign → SLA Escalation → SOP Guidance → Proof Action → Resolved
          </p>
        </div>
      </div>

      {/* Main 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Alerts List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
            <span>ACTIVE INCIDENTS ({alerts.filter(a => a.status !== 'RESOLVED').length})</span>
            <span>TOTAL ({alerts.length})</span>
          </div>

          <div className="space-y-2.5 max-h-[75vh] overflow-y-auto pr-1">
            {alerts.map((a) => {
              const isSelected = selectedAlert?.id === a.id;
              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedAlert(a)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-500 shadow-md ring-2 ring-rose-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                      {a.alert_code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${severityBadges[a.severity]}`}>
                        {a.severity}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadges[a.status]}`}>
                        {a.status}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                    {a.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {a.message}
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      L{a.escalation_level} • {a.assigned_role}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Alert Triage & SOP Guidance */}
        <div className="lg:col-span-2 space-y-6">
          {selectedAlert && alertDetails?.alert ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              {/* Alert Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-rose-600 dark:text-rose-400">
                      {alertDetails.alert.alert_code}
                    </span>
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${severityBadges[alertDetails.alert.severity]}`}>
                      {alertDetails.alert.severity}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      L{alertDetails.alert.escalation_level} Escalation
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                    {alertDetails.alert.title}
                  </h2>
                </div>

                {/* Primary Action Buttons based on lifecycle status */}
                <div className="flex items-center gap-2">
                  {alertDetails.alert.status === 'ASSIGNED' && (
                    <button
                      onClick={handleAcknowledge}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                    >
                      Acknowledge Alert
                    </button>
                  )}

                  {(alertDetails.alert.status === 'ASSIGNED' || alertDetails.alert.status === 'ACKNOWLEDGED') && (
                    <button
                      onClick={() => setActionModalOpen(true)}
                      className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Take Corrective Action
                    </button>
                  )}

                  {alertDetails.alert.status === 'ACTION_TAKEN' && (
                    <button
                      onClick={handleResolve}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      Verify & Resolve Incident
                    </button>
                  )}
                </div>
              </div>

              {/* SLA Timer & Assignment Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block">Assigned Role & Staff:</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {alertDetails.alert.assigned_role} ({alertDetails.alert.assigned_user_name || 'Auto-Assigned'})
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">SLA Escalation Timer:</span>
                  <p className="font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                    Deadline: {new Date(alertDetails.alert.sla_deadline).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Root-Cause Category:</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {alertDetails.alert.root_cause_category || 'Pending Investigation'}
                  </p>
                </div>
              </div>

              {/* Actionable SOP Guidance Display */}
              <div className="p-5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50 space-y-3">
                <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300 font-bold text-xs uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-sky-500" />
                  <span>SOP Guidance: {alertDetails.alert.sop_title}</span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  Trigger condition: {alertDetails.alert.trigger_condition}
                </p>

                <div className="space-y-2 pt-1">
                  {alertDetails.alert.sop_steps?.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200">
                      <span className="w-5 h-5 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                        {idx + 1}
                      </span>
                      <p className="pt-0.5 leading-relaxed font-medium">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Taken Audit Trail for this Incident */}
              {alertDetails.actions?.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Incident Response Audit Trail ({alertDetails.actions.length})
                  </h4>

                  <div className="space-y-2">
                    {alertDetails.actions.map((act) => (
                      <div
                        key={act.id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1"
                      >
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-slate-900 dark:text-white">{act.action_taken}</span>
                          <span className="text-slate-400 text-[10px]">{new Date(act.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Root cause: <span className="font-semibold text-slate-700 dark:text-slate-300">{act.root_cause}</span> • Performed by: {act.user_name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              Select an alert from the left to view SOP guidance and response controls.
            </div>
          )}
        </div>
      </div>

      {/* Corrective Action Modal */}
      {actionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Record Corrective Action Taken</h3>
              <button onClick={() => setActionModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSubmitAction} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Root-Cause Category:
                </label>
                <select
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                >
                  <option value="Refrigeration Failure">Refrigeration Failure</option>
                  <option value="Door Latch Left Ajar">Door Latch Left Ajar</option>
                  <option value="Power Grid Disconnection">Power Grid Disconnection</option>
                  <option value="Direct Contact with Unconditioned Gel Packs">Direct Contact with Unconditioned Gel Packs</option>
                  <option value="Telemetry Sensor Probe Drift">Telemetry Sensor Probe Drift</option>
                  <option value="Transport Detour / Delay">Transport Detour / Delay</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Action Taken (Describe steps performed per SOP):
                </label>
                <textarea
                  rows={3}
                  required
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  placeholder="e.g. Inspected container C015 door seal, securely locked latch, verified compressor hum, and confirmed temperature rebound to 4.5°C."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Photo Proof Upload Option */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Physical Proof Photo (Optional/Recommended):
                </label>
                {proofPhoto ? (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 text-emerald-700 flex justify-between items-center">
                    <span className="font-semibold">Photo Attached: {proofPhoto.id}</span>
                    <button type="button" onClick={() => setProofPhoto(null)} className="text-xs font-bold text-rose-500">Remove</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPhotoModalOpen(true)}
                    className="w-full py-2.5 px-3 border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl font-semibold flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400"
                  >
                    <Camera className="w-4 h-4" />
                    Capture / Attach Verification Photo
                  </button>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl shadow-md"
                >
                  Submit Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Capture Modal */}
      <PhotoCaptureModal
        isOpen={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        onPhotoUploaded={(pf) => setProofPhoto(pf)}
        title="Capture Incident Resolution Proof"
        fileType="ATTACHMENT"
      />
    </div>
  );
}
