'use client';

import { PrinterIcon } from '@heroicons/react/24/outline';

export function PrintReportButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#b98a51]/55 bg-[#2d2419] px-4 py-2.5 text-sm font-semibold text-[#fff1d8] shadow-[0_18px_45px_-34px_rgba(95,62,26,0.85)] transition hover:border-[#8d6334] hover:bg-[#3a2b1b] disabled:cursor-not-allowed disabled:opacity-45"
    >
      <PrinterIcon className="h-4 w-4" aria-hidden="true" />
      Imprimir / Guardar PDF
    </button>
  );
}
