'use client';

import { useMemo, useState } from 'react';
import type { MenuEngineeringRow } from '@/lib/cheffing/menuEngineering';

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatCurrency = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  return currencyFormatter.format(value);
};

const formatPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  return percentFormatter.format(value);
};

const bcmBadgeClassByType: Record<MenuEngineeringRow['bcm'], string> = {
  ESTRELLA: 'border-emerald-500/50 bg-emerald-500/20 text-emerald-100',
  VACA: 'border-sky-500/50 bg-sky-500/20 text-sky-100',
  PUZZLE: 'border-amber-500/50 bg-amber-500/20 text-amber-100',
  PERRO: 'border-rose-500/40 bg-rose-500/15 text-rose-100',
  SIN_DATOS: 'border-slate-600/70 bg-slate-700/40 text-slate-200',
};

const bcmLabelByType: Record<MenuEngineeringRow['bcm'], string> = {
  ESTRELLA: 'Estrella',
  VACA: 'Vaca',
  PUZZLE: 'Puzzle',
  PERRO: 'Perro',
  SIN_DATOS: 'Sin datos',
};

type SortDirection = 'asc' | 'desc';

type SortState<T extends string> = {
  key: T | null;
  direction: SortDirection;
};

type MainSortKey =
  | 'name'
  | 'family'
  | 'selling_price_gross'
  | 'cost_per_serving'
  | 'net_price'
  | 'margin_unit'
  | 'cogs_pct'
  | 'margin_pct'
  | 'pvp_objetivo_gross'
  | 'dif'
  | 'units_sold'
  | 'total_sales_net'
  | 'total_margin';

type DetailSortKey =
  | 'name'
  | 'family'
  | 'margin_unit'
  | 'bcm_popularity_index'
  | 'bcm'
  | 'bcm_margin_g'
  | 'bcm_popularity_g';

const compareNullableNumbers = (a: number | null, b: number | null) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
};

const indicator = <T extends string>(sort: SortState<T>, key: T) => {
  if (sort.key !== key) return '↕';
  return sort.direction === 'asc' ? '↑' : '↓';
};

const sortButtonClass =
  'inline-flex items-center gap-1 rounded px-1 py-0.5 text-left transition hover:bg-slate-800/60';

const bcmSign = (value: boolean) => (value ? '+' : '-');

const toggleSort = <T extends string>(prev: SortState<T>, key: T): SortState<T> => {
  if (prev.key !== key) {
    return { key, direction: 'asc' };
  }

  if (prev.direction === 'asc') {
    return { key, direction: 'desc' };
  }

  return { key: null, direction: 'asc' };
};

export function MenuEngineeringSortableMainTable({ rows }: { rows: MenuEngineeringRow[] }) {
  const [mainSort, setMainSort] = useState<SortState<MainSortKey>>({ key: null, direction: 'asc' });

  const sortedMainRows = useMemo(() => {
    if (!mainSort.key) return rows;

    const indexedRows = rows.map((row, index) => ({ row, index }));

    const sortKey: MainSortKey = mainSort.key;

    indexedRows.sort((a, b) => {
      const dir = mainSort.direction === 'asc' ? 1 : -1;
      let result = 0;

      switch (sortKey) {
        case 'name':
          result = a.row.name.localeCompare(b.row.name, 'es');
          break;
        case 'family':
          result = (a.row.family ?? 'Sin familia').localeCompare(b.row.family ?? 'Sin familia', 'es');
          break;
        case 'units_sold':
          result = a.row.units_sold - b.row.units_sold;
          break;
        default:
          result = compareNullableNumbers(a.row[sortKey], b.row[sortKey]);
          break;
      }

      if (result === 0) {
        return a.index - b.index;
      }

      return result * dir;
    });

    return indexedRows.map(({ row }) => row);
  }, [rows, mainSort]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/70">
      <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
        <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'name'))}>
                Plato <span>{indicator(mainSort, 'name')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'family'))}>
                Familia <span>{indicator(mainSort, 'family')}</span>
              </button>
            </th>
            <th className="px-4 py-3">BCM</th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'selling_price_gross'))}>
                PVP (con IVA) <span>{indicator(mainSort, 'selling_price_gross')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'cost_per_serving'))}>
                Coste/ración <span>{indicator(mainSort, 'cost_per_serving')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'net_price'))}>
                Precio sin IVA (base) <span>{indicator(mainSort, 'net_price')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'margin_unit'))}>
                Margen/ración <span>{indicator(mainSort, 'margin_unit')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'cogs_pct'))}>
                COGS % (sobre base) <span>{indicator(mainSort, 'cogs_pct')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'margin_pct'))}>
                Margen % (sobre base) <span>{indicator(mainSort, 'margin_pct')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'pvp_objetivo_gross'))}>
                PVP objetivo (con IVA) <span>{indicator(mainSort, 'pvp_objetivo_gross')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'dif'))}>
                Dif (PVP - objetivo) <span>{indicator(mainSort, 'dif')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'units_sold'))}>
                Unidades vendidas <span>{indicator(mainSort, 'units_sold')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'total_sales_net'))}>
                Total ventas (€) <span>{indicator(mainSort, 'total_sales_net')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'total_margin'))}>
                Total margen <span>{indicator(mainSort, 'total_margin')}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-900/40">
          {sortedMainRows.length === 0 ? (
            <tr>
              <td colSpan={14} className="px-4 py-6 text-center text-sm text-slate-400">
                No hay platos disponibles para analizar.
              </td>
            </tr>
          ) : (
            sortedMainRows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium text-slate-100">{row.name}</td>
                <td className="px-4 py-3">{row.family || 'Sin familia'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${bcmBadgeClassByType[row.bcm]}`}
                  >
                    {bcmLabelByType[row.bcm]}
                  </span>
                </td>
                <td className="px-4 py-3">{formatCurrency(row.selling_price_gross)}</td>
                <td className="px-4 py-3">{formatCurrency(row.cost_per_serving)}</td>
                <td className="px-4 py-3">{formatCurrency(row.net_price)}</td>
                <td className="px-4 py-3">{formatCurrency(row.margin_unit)}</td>
                <td className="px-4 py-3">{formatPercent(row.cogs_pct)}</td>
                <td className="px-4 py-3">{formatPercent(row.margin_pct)}</td>
                <td className="px-4 py-3">{formatCurrency(row.pvp_objetivo_gross)}</td>
                <td className="px-4 py-3">{formatCurrency(row.dif)}</td>
                <td className="px-4 py-3">{row.units_sold.toLocaleString('es-ES')}</td>
                <td className="px-4 py-3">{formatCurrency(row.total_sales_net)}</td>
                <td className="px-4 py-3">{formatCurrency(row.total_margin)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function MenuEngineeringSortableBcmDetailTable({ bcmDetailRows }: { bcmDetailRows: MenuEngineeringRow[] }) {
  const [detailSort, setDetailSort] = useState<SortState<DetailSortKey>>({ key: null, direction: 'asc' });

  const sortedDetailRows = useMemo(() => {
    if (!detailSort.key) return bcmDetailRows;

    const indexedRows = bcmDetailRows.map((row, index) => ({ row, index }));

    const sortKey: DetailSortKey = detailSort.key;

    indexedRows.sort((a, b) => {
      const dir = detailSort.direction === 'asc' ? 1 : -1;
      let result = 0;

      switch (sortKey) {
        case 'name':
          result = a.row.name.localeCompare(b.row.name, 'es');
          break;
        case 'family':
          result = (a.row.family ?? 'Sin familia').localeCompare(b.row.family ?? 'Sin familia', 'es');
          break;
        case 'bcm':
          result = bcmLabelByType[a.row.bcm].localeCompare(bcmLabelByType[b.row.bcm], 'es');
          break;
        default:
          result = compareNullableNumbers(a.row[sortKey], b.row[sortKey]);
          break;
      }

      if (result === 0) {
        return a.index - b.index;
      }

      return result * dir;
    });

    return indexedRows.map(({ row }) => row);
  }, [bcmDetailRows, detailSort]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800/70">
      <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
        <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setDetailSort((prev) => toggleSort(prev, 'name'))}>
                Plato <span>{indicator(detailSort, 'name')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setDetailSort((prev) => toggleSort(prev, 'family'))}>
                Familia <span>{indicator(detailSort, 'family')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setDetailSort((prev) => toggleSort(prev, 'margin_unit'))}>
                Margen unitario <span>{indicator(detailSort, 'margin_unit')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button
                type="button"
                className={sortButtonClass}
                onClick={() => setDetailSort((prev) => toggleSort(prev, 'bcm_popularity_index'))}
              >
                Índice ventas <span>{indicator(detailSort, 'bcm_popularity_index')}</span>
              </button>
            </th>
            <th className="px-4 py-3">Margen</th>
            <th className="px-4 py-3">Popularidad</th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setDetailSort((prev) => toggleSort(prev, 'bcm'))}>
                Tipo <span>{indicator(detailSort, 'bcm')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setDetailSort((prev) => toggleSort(prev, 'bcm_margin_g'))}>
                Margen G <span>{indicator(detailSort, 'bcm_margin_g')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button
                type="button"
                className={sortButtonClass}
                onClick={() => setDetailSort((prev) => toggleSort(prev, 'bcm_popularity_g'))}
              >
                Popularidad G <span>{indicator(detailSort, 'bcm_popularity_g')}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-900/40">
          {sortedDetailRows.map((row) => (
            <tr key={`bcm-detail-${row.id}`}>
              <td className="px-4 py-3 font-medium text-slate-100">{row.name}</td>
              <td className="px-4 py-3">{row.family || 'Sin familia'}</td>
              <td className="px-4 py-3">{formatCurrency(row.margin_unit)}</td>
              <td className="px-4 py-3">{formatPercent(row.bcm_popularity_index)}</td>
              <td className="px-4 py-3">{bcmSign(row.high_margin)}</td>
              <td className="px-4 py-3">{bcmSign(row.high_popularity)}</td>
              <td className="px-4 py-3">{bcmLabelByType[row.bcm]}</td>
              <td className="px-4 py-3">{formatCurrency(row.bcm_margin_g)}</td>
              <td className="px-4 py-3">{formatPercent(row.bcm_popularity_g)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
