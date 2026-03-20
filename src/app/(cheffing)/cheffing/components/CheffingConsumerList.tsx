'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { normalizeSearchText } from '@/lib/cheffing/search';

type ConsumerSummary = {
  id: string;
  name: string;
  notes: string | null;
  is_active: boolean;
  price_per_person?: number | null;
  total_cost: number | null;
  total_price?: number | null;
  total_margin?: number | null;
  calculation_issue?: string | null;
};

export function CheffingConsumerList({
  title,
  createHref,
  detailBaseHref,
  searchPlaceholder,
  showFinancials,
  entries,
}: {
  title: string;
  createHref: string;
  detailBaseHref: string;
  searchPlaceholder: string;
  showFinancials: boolean;
  entries: ConsumerSummary[];
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const filtered = useMemo(() => {
    const query = normalizeSearchText(searchTerm);
    if (!query) return entries;
    return entries.filter((entry) => normalizeSearchText(entry.name).includes(query));
  }, [entries, searchTerm]);

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${value.toFixed(2)} €`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={createHref}
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
        >
          Nuevo
        </Link>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800/70">
        <table className="w-full min-w-[900px] text-left text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">{title}</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Coste total</th>
              {showFinancials ? <th className="px-4 py-3">Precio</th> : null}
              {showFinancials ? <th className="px-4 py-3">Margen</th> : null}
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={showFinancials ? 6 : 4} className="px-4 py-6 text-center text-sm text-slate-500">
                  No hay resultados.
                </td>
              </tr>
            ) : (
              filtered.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-800/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{entry.name}</p>
                    {entry.notes ? <p className="text-xs text-slate-500">{entry.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3">{entry.is_active ? 'Activo' : 'Inactivo'}</td>
                  <td className="px-4 py-3">
                    <p>{formatCurrency(entry.total_cost)}</p>
                    {entry.calculation_issue ? <p className="text-xs text-amber-300">{entry.calculation_issue}</p> : null}
                  </td>
                  {showFinancials ? <td className="px-4 py-3">{formatCurrency(entry.price_per_person ?? null)}</td> : null}
                  {showFinancials ? <td className="px-4 py-3">{formatCurrency(entry.total_margin ?? null)}</td> : null}
                  <td className="px-4 py-3">
                    <Link
                      href={`${detailBaseHref}/${entry.id}`}
                      className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-400"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
