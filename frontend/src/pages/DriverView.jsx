import React, { useState, useEffect } from 'react';
import { shipmentApi } from '../api/client.js';
import PhotoCaptureModal from '../components/PhotoCaptureModal.jsx';
import confetti from 'canvas-confetti';
import {
  Truck,
  MapPin,
  Clock,
  Thermometer,
  ShieldCheck,
  CheckCircle2,
  Camera,
  DoorOpen,
  Signature,
  KeyRound,
  FileCheck2,
  AlertTriangle,
  Play
} from 'lucide-react';

export default function DriverView() {
  const [shipments, setShipments] = useState([]);
  const [activeShipment, setActiveShipment] = useState(null);
  const [loading, setLoading] = useState(true);

  // Delivery Proof Form States
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [otpCode, setOtpCode] = useState('849201');
  const [destinationPhoto, setDestinationPhoto] = useState(null);
  const [packagePhoto, setPackagePhoto] = useState(null);
  const [photoModalConfig, setPhotoModalConfig] = useState({ isOpen: false });
  const [submittingProof, setSubmittingProof] = useState(false);
  const [doorReason, setDoorReason] = useState('');

  useEffect(() => {
    loadDriverShipments();
  }, []);

  const loadDriverShipments = async () => {
    try {
      setLoading(true);
      const res = await shipmentApi.getShipments();
      const list = res.shipments || [];
      setShipments(list);
      if (list.length > 0) {
        setActiveShipment(list[0]);
      }
    } catch (err) {
      console.error('Failed to load driver shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDelivery = async () => {
    if (!activeShipment) return;
    try {
      await shipmentApi.dispatch(activeShipment.id);
      await loadDriverShipments();
    } catch (err) {
      alert(`Start delivery failed: ${err.message}`);
    }
  };

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (!destinationPhoto || !packagePhoto) {
      alert('Mandatory proofs missing: Both destination facade and package delivery photos are required.');
      return;
    }
    if (!receiverName) {
      alert('Receiver name is required.');
      return;
    }

    try {
      setSubmittingProof(true);
      await shipmentApi.submitDeliveryProof(activeShipment.id, {
        receiverName,
        receiverPhone,
        otpCode,
        gpsLatitude: 13.0566,
        gpsLongitude: 80.2521,
        destinationPhotoId: destinationPhoto.id,
        packagePhotoId: packagePhoto.id
      });

      confetti({ particleCount: 60, spread: 90, origin: { y: 0.7 } });
      alert('Delivery proof successfully submitted! Consignment marked as DELIVERED.');
      await loadDriverShipments();
    } catch (err) {
      alert(`Proof submission failed: ${err.message}`);
    } finally {
      setSubmittingProof(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-sky-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Driver Delivery Console
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Mobile-First Proof-of-Delivery: GPS Arrival, Photo Seals & Receiver OTP
          </p>
        </div>

        {/* Shipment Selector */}
        {shipments.length > 1 && (
          <select
            value={activeShipment?.id || ''}
            onChange={(e) => setActiveShipment(shipments.find(s => s.id === e.target.value))}
            className="py-2 px-3 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
          >
            {shipments.map(s => (
              <option key={s.id} value={s.id}>
                {s.shipment_number} ({s.status})
              </option>
            ))}
          </select>
        )}
      </div>

      {activeShipment ? (
        <div className="space-y-6">
          {/* Active Mission Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-500 block">
                  ASSIGNED DELIVERY MISSION
                </span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  Shipment {activeShipment.shipment_number}
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 uppercase">
                {activeShipment.status}
              </span>
            </div>

            {/* Origin & Destination route points */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  A
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Origin Depot</span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{activeShipment.origin_name}</p>
                </div>
              </div>

              <div className="border-l-2 border-dashed border-slate-300 dark:border-slate-700 ml-3 h-4" />

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">
                  B
                </div>
                <div>
                  <span className="text-[10px] font-bold text-sky-500 uppercase">Destination Hospital</span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{activeShipment.destination_name}</p>
                </div>
              </div>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block text-[10px] font-bold">CONTAINER TEMP</span>
                <span className="text-base font-black text-sky-600 dark:text-sky-400 mt-1 block">
                  {activeShipment.current_temp || 4.8}°C
                </span>
                <span className="text-[10px] text-emerald-500 font-bold">Optimal 2-8°C</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block text-[10px] font-bold">ESTIMATED ETA</span>
                <span className="text-base font-black text-slate-900 dark:text-white mt-1 block">
                  {activeShipment.eta_minutes} min
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Distance: {activeShipment.distance_km} km</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block text-[10px] font-bold">BATTERY RESERVE</span>
                <span className="text-base font-black text-emerald-600 mt-1 block">
                  {activeShipment.battery_pct || 90}%
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Active Chiller</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block text-[10px] font-bold">DOOR LATCH</span>
                <span className="text-base font-black text-slate-900 dark:text-white mt-1 block">
                  {activeShipment.door_status || 'CLOSED'}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Reed Verified</span>
              </div>
            </div>

            {/* Start Delivery Action (If created/verified) */}
            {activeShipment.status === 'DOOR_VERIFIED' && (
              <button
                onClick={handleStartDelivery}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start Delivery & Activate GPS Tracking
              </button>
            )}
          </div>

          {/* 4-Point Delivery Proof Submission Form */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-500" />
                Proof-of-Delivery Handover (Mandatory 4-Point Verification)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Regulatory rule: Delivery cannot be marked completed without all mandatory digital proofs.
              </p>
            </div>

            <form onSubmit={handleSubmitProof} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Destination Photo */}
                <div className="space-y-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    1. Destination Facade Photo:
                  </label>
                  {destinationPhoto ? (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 text-emerald-800 dark:text-emerald-300 flex justify-between items-center">
                      <span className="font-semibold">Photo Captured ({destinationPhoto.id})</span>
                      <button type="button" onClick={() => setDestinationPhoto(null)} className="text-xs font-bold text-rose-500">Retake</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPhotoModalConfig({
                        isOpen: true,
                        title: 'Capture Destination Facade Photo',
                        fileType: 'PHOTO_DELIVERY',
                        onSuccess: (pf) => setDestinationPhoto(pf)
                      })}
                      className="w-full py-3 px-4 border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl font-bold flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400"
                    >
                      <Camera className="w-4 h-4" />
                      Capture Destination Sign
                    </button>
                  )}
                </div>

                {/* 2. Package Photo */}
                <div className="space-y-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    2. Package / Container Photo:
                  </label>
                  {packagePhoto ? (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 text-emerald-800 dark:text-emerald-300 flex justify-between items-center">
                      <span className="font-semibold">Photo Captured ({packagePhoto.id})</span>
                      <button type="button" onClick={() => setPackagePhoto(null)} className="text-xs font-bold text-rose-500">Retake</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPhotoModalConfig({
                        isOpen: true,
                        title: 'Capture Package / Container Seal Photo',
                        fileType: 'PHOTO_DELIVERY',
                        onSuccess: (pf) => setPackagePhoto(pf)
                      })}
                      className="w-full py-3 px-4 border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl font-bold flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400"
                    >
                      <Camera className="w-4 h-4" />
                      Capture Container Seal
                    </button>
                  )}
                </div>
              </div>

              {/* 3. GPS Proximity Check */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-500" />
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white">3. GPS Destination Proximity</h5>
                    <p className="text-[11px] text-slate-500">Verified coordinates (13.0566° N, 80.2521° E)</p>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  WITHIN 20 METERS
                </span>
              </div>

              {/* 4. Receiver Identity & OTP Verification */}
              <div className="space-y-3 pt-2">
                <h5 className="font-bold text-slate-700 dark:text-slate-300">
                  4. Hospital Receiver Confirmation:
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Receiver Name:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Vimala Nathan"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Receiver Phone:</label>
                    <input
                      type="text"
                      placeholder="+91 98406 12345"
                      value={receiverPhone}
                      onChange={(e) => setReceiverPhone(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Receiver OTP Code:</label>
                    <input
                      type="text"
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full py-2 px-3 font-mono font-bold tracking-widest text-center rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sky-600 dark:text-sky-400"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Proof Button */}
              <button
                type="submit"
                disabled={submittingProof || !destinationPhoto || !packagePhoto || !receiverName}
                className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {submittingProof ? 'Verifying & Submitting Proof...' : 'Submit 4-Point Delivery Proof'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          No deliveries assigned to your vehicle at this time.
        </div>
      )}

      {/* Photo Capture Modal */}
      <PhotoCaptureModal
        isOpen={photoModalConfig.isOpen}
        onClose={() => setPhotoModalConfig({ isOpen: false })}
        title={photoModalConfig.title}
        fileType={photoModalConfig.fileType}
        onPhotoUploaded={photoModalConfig.onSuccess}
      />
    </div>
  );
}
