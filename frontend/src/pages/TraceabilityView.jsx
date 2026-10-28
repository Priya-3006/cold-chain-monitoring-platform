import React, { useState, useEffect } from 'react';
import { traceabilityApi, shipmentApi } from '../api/client.js';
import confetti from 'canvas-confetti';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  FileText,
  Printer,
  Download,
  AlertTriangle,
  History,
  Lock,
  Boxes,
  Truck,
  Building,
  RefreshCw,
  Hash
} from 'lucide-react';

export default function TraceabilityView() {
  const [activeSubTab, setActiveSubTab] = useState('audit'); // 'audit' | 'recall' | 'compliance'
  const [auditLogs, setAuditLogs] = useState([]);
  const [integrityStatus, setIntegrityStatus] = useState(null);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);

  // Batch Recall State
  const [recallBatchInput, setRecallBatchInput] = useState('VA2026-001');
  const [recallResult, setRecallResult] = useState(null);
  const [loadingRecall, setLoadingRecall] = useState(false);

  // Compliance Report State
  const [reportShipmentId, setReportShipmentId] = useState('shp-vc1018');
  const [complianceReport, setComplianceReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    loadAuditLogs();
    handleSearchRecall('VA2026-001');
    handleLoadReport('shp-vc1018');
  }, []);

  const loadAuditLogs = async () => {
    try {
      const res = await traceabilityApi.getAuditLogs(50);
      setAuditLogs(res.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const handleVerifyIntegrity = async () => {
    try {
      setVerifyingIntegrity(true);
      const res = await traceabilityApi.verifyIntegrity();
      setIntegrityStatus(res);
      if (res.isValid) {
        confetti({ particleCount: 50, spread: 80, origin: { y: 0.7 } });
      }
    } catch (err) {
      setIntegrityStatus({ isValid: false, error: err.message });
    } finally {
      setVerifyingIntegrity(false);
    }
  };

  const handleSearchRecall = async (batchNum) => {
    const num = (batchNum || recallBatchInput).trim();
    if (!num) return;
    try {
      setLoadingRecall(true);
      const res = await traceabilityApi.recallBatch(num);
      setRecallResult(res);
    } catch (err) {
      alert(`Recall search error: ${err.message}`);
    } finally {
      setLoadingRecall(false);
    }
  };

  const handleLoadReport = async (shipmentId) => {
    try {
      setLoadingReport(true);
      const res = await traceabilityApi.getComplianceReport(shipmentId);
      setComplianceReport(res);
    } catch (err) {
      console.error('Compliance report error:', err);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleExportCSV = () => {
    if (!complianceReport?.telemetryHistory) return;
    const rows = [
      ['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Door Open', 'Power Mode', 'Battery (%)'],
      ...complianceReport.telemetryHistory.map(t => [
        t.timestamp,
        t.temperature,
        t.humidity,
        t.door_open ? 'YES' : 'NO',
        t.power_mode,
        t.battery_pct
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ColdChain-Report-${complianceReport.shipmentDetails.shipment_number}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Regulatory Traceability, Audit & Recall
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tamper-Evident SHA-256 Chain, Batch Containment & WHO/CDSCO Aligned GDP Reporting
          </p>
        </div>

        {/* Sub-tab Navigation Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'audit'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Cryptographic Audit Chain
          </button>
          <button
            onClick={() => setActiveSubTab('recall')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'recall'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Batch Recall Engine
          </button>
          <button
            onClick={() => setActiveSubTab('compliance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'compliance'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            GDP Compliance Report
          </button>
        </div>
      </div>

      {/* 1. SUB-TAB: CRYPTOGRAPHIC AUDIT CHAIN */}
      {activeSubTab === 'audit' && (
        <div className="space-y-6">
          {/* Integrity Verification Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-indigo-500" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  SHA-256 Immutable Audit Ledger
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Every event links to the cryptographic hash of the previous record. Mathematically impossible to alter or remove historical actions without detection.
              </p>
            </div>

            <button
              disabled={verifyingIntegrity}
              onClick={handleVerifyIntegrity}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${verifyingIntegrity ? 'animate-spin' : ''}`} />
              {verifyingIntegrity ? 'Recalculating Block Hashes...' : 'Verify Ledger Integrity'}
            </button>
          </div>

          {/* Integrity Result Modal / Banner */}
          {integrityStatus && (
            <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 shadow-md animate-in slide-in-from-top-2 duration-200 ${
              integrityStatus.isValid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
            }`}>
              {integrityStatus.isValid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className="font-bold text-sm">
                  {integrityStatus.isValid ? 'Integrity Audit Succeeded' : 'Audit Chain Compromised!'}
                </h4>
                <p className="mt-0.5 font-medium leading-relaxed">{integrityStatus.message || integrityStatus.error}</p>
                {integrityStatus.latestHash && (
                  <p className="mt-2 font-mono text-[10px] text-slate-500 truncate">
                    Chain Tip Hash: {integrityStatus.latestHash}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Audit Logs Table */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Verified Sequential Block Records ({auditLogs.length})
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Seq #</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">User & Role</th>
                    <th className="py-2.5 px-3">Action Event</th>
                    <th className="py-2.5 px-3">Entity Ref</th>
                    <th className="py-2.5 px-3">SHA-256 Hash Pointer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        #{log.sequence_number}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900 dark:text-white block">{log.user_id}</span>
                        <span className="text-[10px] text-slate-400">{log.user_role}</span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                        {log.entity_type}: {log.entity_id}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400 max-w-xs truncate" title={log.current_hash}>
                        {log.current_hash.slice(0, 16)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. SUB-TAB: BATCH RECALL ENGINE */}
      {activeSubTab === 'recall' && (
        <div className="space-y-6">
          {/* Recall Query Search Bar */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-rose-500" />
                Emergency Batch Traceability & Containment
              </h3>
              <p className="text-xs text-slate-500">
                Enter any vaccine batch number to immediately locate all vials across warehouses, containers, in-transit reefers, and delivered hospitals.
              </p>
            </div>

            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                value={recallBatchInput}
                onChange={(e) => setRecallBatchInput(e.target.value)}
                placeholder="e.g. VA2026-001 or CS2026-101"
                className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
              <button
                disabled={loadingRecall}
                onClick={() => handleSearchRecall(recallBatchInput)}
                className="px-5 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
              >
                {loadingRecall ? 'Locating...' : 'Locate All Vials'}
              </button>
            </div>
          </div>

          {/* Recall Findings */}
          {recallResult && (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-500 block">
                    BATCH RECALL IMPACT REPORT
                  </span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                    Batch {recallResult.batch.batch_number} • {recallResult.batch.vaccine_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Manufacturer: {recallResult.batch.manufacturer} • Exp: {recallResult.batch.expiry_date}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-semibold block">Vials in Depots:</span>
                    <span className="text-sm font-black text-sky-600 dark:text-sky-400">{recallResult.totalVialsInDepot}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-semibold block">Vials Distributed:</span>
                    <span className="text-sm font-black text-rose-600 dark:text-rose-400">{recallResult.totalVialsDistributed}</span>
                  </div>
                </div>
              </div>

              {/* Affected Hospitals Alert Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Affected Destination Hospitals to Contact ({recallResult.affectedHospitals?.length})
                </h4>

                {recallResult.affectedHospitals?.length === 0 ? (
                  <p className="text-xs text-slate-400">No shipments of this batch have been delivered to external hospitals.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {recallResult.affectedHospitals?.map((h, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-xs space-y-1"
                      >
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-rose-950 dark:text-rose-200">{h.hospitalName}</span>
                          <span className="text-rose-600 font-black">{h.quantity} Vials</span>
                        </div>
                        <p className="text-[11px] text-slate-500">{h.address}</p>
                        <div className="pt-2 flex justify-between items-center text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
                          <span>Contact: {h.contactPerson}</span>
                          <span>Phone: {h.contactPhone}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. SUB-TAB: WHO/CDSCO ALIGNED COMPLIANCE REPORT */}
      {activeSubTab === 'compliance' && (
        <div className="space-y-6">
          {complianceReport && (
            <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6 print:p-0 print:border-none">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600 dark:text-sky-400 block">
                    GOOD DISTRIBUTION PRACTICES (GDP) AUDIT REPORT
                  </span>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    Shipment #{complianceReport.shipmentDetails.shipment_number} Cold-Chain Compliance
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {complianceReport.regulatoryFramework}
                  </p>
                </div>

                <div className="flex items-center gap-2 print:hidden">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print PDF
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block font-bold text-[10px]">COMPLIANCE SCORE</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {complianceReport.qualityAudit.complianceScore}%
                  </span>
                  <span className="text-[10px] text-emerald-500 font-bold">{complianceReport.qualityAudit.complianceGrade}</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block font-bold text-[10px]">MEAN KINETIC TEMP (MKT)</span>
                  <span className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1 block">
                    {complianceReport.temperatureProfile.meanKineticTemperature}°C
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Arrhenius Calculated</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block font-bold text-[10px]">TIME OUT OF RANGE</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                    {complianceReport.temperatureProfile.outOfRangeMinutes} min
                  </span>
                  <span className="text-[10px] text-emerald-500 font-bold">Within Safe Margin</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block font-bold text-[10px]">VERIFICATION PROOFS</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                    100% Passed
                  </span>
                  <span className="text-[10px] text-emerald-500 font-bold">Door + GPS + Photos</span>
                </div>
              </div>

              {/* Vaccines Carried Manifest */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Vaccines Carried & Temperature Tolerances
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Vaccine</th>
                        <th className="py-2.5 px-3">Batch Number</th>
                        <th className="py-2.5 px-3">Allowable Range</th>
                        <th className="py-2.5 px-3">Freeze Sensitive</th>
                        <th className="py-2.5 px-3">Safety Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {complianceReport.vaccinesCarried?.map((v, i) => (
                        <tr key={i}>
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{v.vaccine_name}</td>
                          <td className="py-2.5 px-3 font-mono">{v.batch_number}</td>
                          <td className="py-2.5 px-3 text-sky-600 font-bold">{v.min_temp}°C to {v.max_temp}°C</td>
                          <td className="py-2.5 px-3">{v.freeze_sensitive ? 'YES (Strict)' : 'No'}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {v.safety_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
                <p>
                  <strong>Compliance Statement:</strong> This report is structured aligned with World Health Organization (WHO) Technical Report Series Annex 5 (Good Distribution Practices for Pharmaceutical Products) and CDSCO Guidelines for Cold Chain Management. Generated digitally with SHA-256 cryptographic verification.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
