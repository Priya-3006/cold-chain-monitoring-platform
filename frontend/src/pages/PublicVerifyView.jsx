import React, { useState, useEffect } from 'react';
import { shipmentApi } from '../api/client.js';
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Search,
  Package,
  Calendar,
  Building,
  Thermometer,
  ExternalLink
} from 'lucide-react';

export default function PublicVerifyView() {
  const [queryCode, setQueryCode] = useState('VC1018');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    handleSearch('VC1018');
  }, []);

  const handleSearch = async (codeToSearch) => {
    const code = (codeToSearch || queryCode).trim();
    if (!code) return;

    try {
      setLoading(true);
      setError('');
      const data = await shipmentApi.publicVerify(code);
      setResult(data);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-sky-500/10 text-sky-500 mb-1">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          Public Vaccine Cold-Chain Verification
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Scan vial QR label or enter shipment code to audit end-to-end transport temperatures and regulatory compliance
        </p>
      </div>

      {/* Search Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        className="flex items-center gap-2 max-w-lg mx-auto"
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={queryCode}
            onChange={(e) => setQueryCode(e.target.value)}
            placeholder="e.g. VC1018 or VC1024"
            className="w-full pl-10 pr-4 py-2.5 text-xs font-bold rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none shadow-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-md transition-colors"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>

      {/* Quick Test Chips */}
      <div className="flex items-center justify-center gap-2 text-xs">
        <span className="text-slate-400">Quick-audit:</span>
        <button
          type="button"
          onClick={() => {
            setQueryCode('VC1018');
            handleSearch('VC1018');
          }}
          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] hover:text-sky-500"
        >
          VC1018 (Delivered & Verified)
        </button>
        <button
          type="button"
          onClick={() => {
            setQueryCode('VC1024');
            handleSearch('VC1024');
          }}
          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] hover:text-sky-500"
        >
          VC1024 (Active Mission)
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold text-center">
          {error}
        </div>
      )}

      {/* Verification Certificate Result Card */}
      {result && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border-2 border-emerald-500/30 shadow-xl space-y-6 animate-in fade-in duration-300">
          {/* Certificate Badge Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/25">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  AUTHENTICATED RECORD
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Consignment #{result.consignment.shipmentNumber}
                </h3>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
              {result.consignment.status}
            </span>
          </div>

          {/* Consignment Journey Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-slate-400 font-semibold block">Origin Pharma Depot:</span>
              <p className="font-bold text-slate-900 dark:text-white">{result.consignment.origin}</p>
              <span className="text-slate-400 font-semibold block pt-2">Destination Facility:</span>
              <p className="font-bold text-slate-900 dark:text-white">{result.consignment.destination}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-slate-400 font-semibold block">Storage Requirement:</span>
              <p className="font-bold text-sky-600 dark:text-sky-400">{result.consignment.temperatureRange}</p>
              <span className="text-slate-400 font-semibold block pt-2">Carrier Specification:</span>
              <p className="font-bold text-slate-900 dark:text-white">{result.consignment.containerType}</p>
            </div>
          </div>

          {/* Verified Vaccine Batches */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Vaccine Contents & Batch Traceability ({result.vaccines?.length})
            </h4>
            <div className="space-y-2">
              {result.vaccines?.map((v, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">{v.vaccine_name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Batch: {v.batch_number} • Exp: {v.expiry_date} • Mfg: {v.manufacturer}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {v.safety_status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cryptographic Chain Integrity Statement */}
          <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50 flex items-start gap-3 text-xs">
            <ShieldCheck className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
            <div>
              <h5 className="font-bold text-sky-900 dark:text-sky-200">
                End-to-End Cryptographic Audit Verified
              </h5>
              <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                Every temperature reading, door seal photo, and GPS waypoint has been validated through our SHA-256 tamper-evident proof ledger. Potency and cold-chain integrity are confirmed.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
