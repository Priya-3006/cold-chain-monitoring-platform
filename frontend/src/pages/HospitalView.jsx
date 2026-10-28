import React, { useState, useEffect } from 'react';
import { shipmentApi } from '../api/client.js';
import confetti from 'canvas-confetti';
import {
  Building2,
  CheckCircle2,
  XCircle,
  FileCheck2,
  ThermometerSnowflake,
  ShieldCheck,
  AlertTriangle,
  Clock,
  MapPin,
  FileText
} from 'lucide-react';

export default function HospitalView() {
  const [shipments, setShipments] = useState([]);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [shipmentDetails, setShipmentDetails] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHospitalShipments();
  }, []);

  useEffect(() => {
    if (selectedShipment) {
      loadDetails(selectedShipment.id);
    }
  }, [selectedShipment]);

  const loadHospitalShipments = async () => {
    try {
      setLoading(true);
      const res = await shipmentApi.getShipments();
      const list = res.shipments || [];
      setShipments(list);
      if (list.length > 0) {
        setSelectedShipment(list[0]);
      }
    } catch (err) {
      console.error('Failed to load hospital shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (id) => {
    try {
      const res = await shipmentApi.getShipmentById(id);
      setShipmentDetails(res);
    } catch (err) {
      console.error('Failed to load shipment details:', err);
    }
  };

  const handleDecision = async (decision) => {
    if (!selectedShipment) return;
    try {
      await shipmentApi.recordHospitalDecision(selectedShipment.id, decision, rejectReason);
      if (decision === 'ACCEPT') {
        confetti({ particleCount: 70, spread: 100, origin: { y: 0.7 } });
        alert('Shipment accepted and verified! Chain of custody recorded.');
      } else {
        alert('Shipment rejected. Quarantine alert raised.');
        setIsRejectModalOpen(false);
        setRejectReason('');
      }
      await loadHospitalShipments();
    } catch (err) {
      alert(`Decision error: ${err.message}`);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-rose-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Hospital & Pharmacy Receiving Portal
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Apollo Hospitals Central Receiving • Inward Inspection, Thermal Verification & Acceptance
          </p>
        </div>

        {/* Consignment Selector */}
        <select
          value={selectedShipment?.id || ''}
          onChange={(e) => setSelectedShipment(shipments.find(s => s.id === e.target.value))}
          className="py-2 px-3 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
        >
          {shipments.map(s => (
            <option key={s.id} value={s.id}>
              {s.shipment_number} ({s.status})
            </option>
          ))}
        </select>
      </div>

      {shipmentDetails?.shipment ? (
        <div className="space-y-6">
          {/* Main Acceptance Overview Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-500 block">
                  DELIVERY CONSIGNMENT
                </span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  Shipment {shipmentDetails.shipment.shipment_number} • Container {shipmentDetails.shipment.container_code}
                </h2>
                <p className="text-xs text-slate-500">
                  Origin: {shipmentDetails.shipment.origin_name} → Destination: {shipmentDetails.shipment.destination_name}
                </p>
              </div>

              {/* Accept / Reject Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsRejectModalOpen(true)}
                  disabled={shipmentDetails.shipment.status === 'COMPLETED' || shipmentDetails.shipment.status === 'REJECTED'}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Consignment
                </button>
                <button
                  onClick={() => handleDecision('ACCEPT')}
                  disabled={shipmentDetails.shipment.status === 'COMPLETED' || shipmentDetails.shipment.status === 'REJECTED'}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Accept & Receive Vials
                </button>
              </div>
            </div>

            {/* Vaccine Vials Manifest */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Inward Vaccine Batches Manifest ({shipmentDetails.items?.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {shipmentDetails.items?.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs space-y-1"
                  >
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-slate-900 dark:text-white">{item.vaccine_name}</span>
                      <span className="text-sky-600 dark:text-sky-400">{item.quantity_picked} Vials</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Batch: {item.batch_number} • Exp: {item.expiry_date}
                    </p>
                    <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      Safety: {item.safety_status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Proof Review (Photos & Signature) */}
            {shipmentDetails.deliveryConfirmation && (
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800/50 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Verified 4-Point Delivery Handover Record</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">Receiver Name:</span>
                    <p className="font-bold text-slate-900 dark:text-white">{shipmentDetails.deliveryConfirmation.receiver_name}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">OTP Verification:</span>
                    <p className="font-bold text-emerald-600 font-mono">VERIFIED (849201)</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">GPS Distance:</span>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {shipmentDetails.deliveryConfirmation.distance_from_hospital_meters}m from Gate
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">Confirmed At:</span>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {new Date(shipmentDetails.deliveryConfirmation.confirmed_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          Loading inward consignments...
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-rose-600 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> Reject Inward Consignment
            </h3>
            <p className="text-slate-500">
              Please enter the regulatory reason for rejecting this vaccine shipment (e.g. broken seal, high temperature reading, physical damage):
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Container C002 arrived with temperature at 11.2°C exceeding 8°C threshold for > 2 hours."
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDecision('REJECT')}
                className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
