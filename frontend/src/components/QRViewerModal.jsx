import React from 'react';
import { X, Printer, QrCode } from 'lucide-react';

export default function QRViewerModal({ isOpen, onClose, data }) {
  if (!isOpen || !data) return null;

  const { title, code, subtitle, meta = [], type = 'CONTAINER' } = data;

  // Generate SVG QR pattern visually for crisp display without heavy dependencies
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(code)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-sky-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Printable QR Asset Label</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Label Card */}
        <div className="p-6 bg-slate-50 dark:bg-slate-950/50 flex flex-col items-center">
          <div className="bg-white text-slate-900 p-6 rounded-2xl shadow-lg border-2 border-slate-900 w-full max-w-sm flex flex-col items-center text-center">
            {/* Header info */}
            <div className="w-full flex items-center justify-between border-b pb-2 mb-4">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700">ColdChain Pro</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 uppercase">{type}</span>
            </div>

            <h4 className="font-extrabold text-lg text-slate-900 leading-tight">{title}</h4>
            <p className="text-xs text-slate-600 font-medium mt-0.5">{subtitle}</p>

            {/* QR Code graphic */}
            <div className="my-4 p-2 bg-white rounded-xl border border-slate-300">
              <img
                src={qrUrl}
                alt={`QR code for ${code}`}
                className="w-44 h-44 object-contain"
                loading="lazy"
              />
            </div>

            {/* Human readable code */}
            <div className="w-full py-1.5 px-3 bg-slate-100 rounded-lg font-mono font-black text-sm tracking-widest text-slate-900 mb-3">
              {code}
            </div>

            {/* Metadata tags */}
            {meta.length > 0 && (
              <div className="w-full border-t pt-3 grid grid-cols-2 gap-2 text-left text-[11px]">
                {meta.map((m, idx) => (
                  <div key={idx}>
                    <span className="text-slate-500 font-semibold block">{m.label}:</span>
                    <span className="font-bold text-slate-800">{m.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Label (Thermal / A4)
          </button>
        </div>
      </div>
    </div>
  );
}
