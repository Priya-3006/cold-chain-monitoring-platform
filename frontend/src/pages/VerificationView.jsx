import React, { useState, useEffect } from 'react';
import { shipmentApi, monitoringApi } from '../api/client.js';
import PhotoCaptureModal from '../components/PhotoCaptureModal.jsx';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Camera,
  DoorClosed,
  DoorOpen,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Lock,
  Unlock
} from 'lucide-react';

export default function VerificationView() {
  const [shipments, setShipments] = useState([]);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [doorProofPhoto, setDoorProofPhoto] = useState(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState(null);

  useEffect(() => {
    loadVerificationTasks();
  }, []);

  const loadVerificationTasks = async () => {
    try {
      const res = await shipmentApi.getShipments();
      const list = res.shipments || [];
      setShipments(list);
      if (list.length > 0 && !selectedShipment) {
        setSelectedShipment(list[0]);
      } else if (selectedShipment) {
        const updated = list.find(s => s.id === selectedShipment.id);
        if (updated) setSelectedShipment(updated);
      }
    } catch (err) {
      console.error('Failed to load verification tasks:', err);
    }
  };

  const handleVerifyDoorClosure = async () => {
    if (!selectedShipment) return;
    if (!doorProofPhoto) {
      alert('Mandatory photo proof missing: Please capture camera photo of the locked door latch.');
      return;
    }

    try {
      setVerifying(true);
      const res = await shipmentApi.verifyDoor(selectedShipment.id, doorProofPhoto.id);
      setVerificationFeedback(res);
      if (res.success) {
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.7 } });
      }
      await loadVerificationTasks();
    } catch (err) {
      setVerificationFeedback({
        success: false,
        message: err.message
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-cyan-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Physical Verification & Seal Audit
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Dual-Proof Door Closure Verification: Hardware Sensor CLOSED + Photo Proof Required
          </p>
        </div>

        {/* Shipment Selector */}
        <select
          value={selectedShipment?.id || ''}
          onChange={(e) => {
            const shp = shipments.find(s => s.id === e.target.value);
            setSelectedShipment(shp);
            setDoorProofPhoto(null);
            setVerificationFeedback(null);
          }}
          className="py-2 px-3 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
        >
          {shipments.map(s => (
            <option key={s.id} value={s.id}>
              {s.shipment_number} ({s.status})
            </option>
          ))}
        </select>
      </div>

      {selectedShipment && (
        <div className="space-y-6">
          {/* Active Container Seal Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-500 block">
                  PHYSICAL INSPECTION PROTOCOL
                </span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  Shipment {selectedShipment.shipment_number} • Container {selectedShipment.container_code}
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 uppercase">
                {selectedShipment.status}
              </span>
            </div>

            {/* Dual Proof Checks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Proof 1: IoT Door Sensor */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    {selectedShipment.door_status === 'CLOSED' ? (
                      <DoorClosed className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <DoorOpen className="w-4 h-4 text-amber-500" />
                    )}
                    1. Magnetic Reed Sensor Probe
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    selectedShipment.door_status === 'CLOSED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                  }`}>
                    {selectedShipment.door_status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {selectedShipment.door_status === 'CLOSED'
                    ? 'Sensor telemetry confirms door latch is fully engaged.'
                    : 'WARNING: Sensor reads OPEN. Physically latch door before submitting.'}
                </p>
              </div>

              {/* Proof 2: Physical Photo Seal */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-sky-500" />
                    2. Latch Camera Photo Proof
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    doorProofPhoto
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {doorProofPhoto ? 'PHOTO ATTACHED' : 'REQUIRED'}
                  </span>
                </div>
                {doorProofPhoto ? (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-emerald-600 font-semibold truncate">Ref: {doorProofPhoto.id}</span>
                    <button onClick={() => setDoorProofPhoto(null)} className="text-xs text-rose-500 font-bold">Retake</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setPhotoModalOpen(true)}
                    className="w-full py-2 px-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    Capture Door Latch Photo
                  </button>
                )}
              </div>
            </div>

            {/* Feedback Alert */}
            {verificationFeedback && (
              <div className={`p-4 rounded-2xl border text-xs ${
                verificationFeedback.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
              }`}>
                <div className="flex items-center gap-2 font-bold mb-1">
                  {verificationFeedback.success ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-rose-500" />}
                  <span>{verificationFeedback.success ? 'Verification Passed!' : 'Verification Blocked'}</span>
                </div>
                <p className="font-medium leading-relaxed">{verificationFeedback.message}</p>
              </div>
            )}

            {/* Action Trigger */}
            <div className="pt-2">
              <button
                disabled={verifying || selectedShipment.status === 'DOOR_VERIFIED' || selectedShipment.status === 'IN_TRANSIT'}
                onClick={handleVerifyDoorClosure}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {verifying
                  ? 'Validating Dual Sensor & Photo Proofs...'
                  : selectedShipment.status === 'DOOR_VERIFIED' || selectedShipment.status === 'IN_TRANSIT'
                  ? 'Door Closure Already Verified & Sealed'
                  : 'Verify Door Closure & Unlock Dispatch Stage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      <PhotoCaptureModal
        isOpen={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        title="Capture Container Door Closure Photo"
        fileType="PHOTO_DOOR"
        onPhotoUploaded={(pf) => setDoorProofPhoto(pf)}
      />
    </div>
  );
}
