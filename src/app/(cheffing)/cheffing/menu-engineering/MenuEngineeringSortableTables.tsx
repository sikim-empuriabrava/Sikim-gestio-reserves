'use client';

import Link from 'next/link';
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
  'inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-left transition hover:bg-slate-800/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/25';

const bcmSign = (value: boolean) => (value ? '+' : '-');

const headerTooltipButtonClass =
  'inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[10px] font-semibold text-slate-300';

const headerTooltipPanelClass =
  'pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-md border border-slate-700 bg-slate-950/95 p-2 text-[11px] normal-case text-slate-200 opacity-0 shadow-lg transition-opacity delay-700 group-hover:opacity-100 group-focus-within:opacity-100';

function HeaderTooltip({
  label,
  description,
  formula,
}: {
  label: string;
  description: string;
  formula?: string;
}) {
  return (
    <span className="group relative inline-flex items-center gap-1">
      <span>{label}</span>
      <span
        aria-label={`Información sobre ${label}`}
        tabIndex={0}
        className={headerTooltipButtonClass}
      >
        i
      </span>
      <span role="tooltip" className={headerTooltipPanelClass}>
        <span className="block">{description}</span>
        {formula ? <span className="mt-1 block text-slate-300">Fórmula: {formula}</span> : null}
      </span>
    </span>
  );
}

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
    <div className="max-w-full overflow-x-auto rounded-2xl border border-slate-700/70 bg-slate-900/70 pb-2 shadow-[0_22px_52px_-38px_rgba(2,6,23,0.95)] ring-1 ring-white/[0.03]">
      <table className="w-max min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
        <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'name'))}>
                Ítem <span>{indicator(mainSort, 'name')}</span>
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
                <HeaderTooltip
                  label="PVP (con IVA)"
                  description="Precio final de venta al cliente, con IVA incluido."
                />{' '}
                <span>{indicator(mainSort, 'selling_price_gross')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'cost_per_serving'))}>
                <HeaderTooltip
                  label="Coste/ración"
                  description="Coste estimado de una ración del plato según su escandallo."
                />{' '}
                <span>{indicator(mainSort, 'cost_per_serving')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'net_price'))}>
                <HeaderTooltip
                  label="Precio sin IVA"
                  description="Precio final sin IVA."
                  formula="PVP / (1 + IVA)"
                />{' '}
                <span>{indicator(mainSort, 'net_price')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'margin_unit'))}>
                <HeaderTooltip
                  label="Margen/ración"
                  description="Beneficio bruto por ración antes de IVA."
                  formula="Precio sin IVA - Coste/ración"
                />{' '}
                <span>{indicator(mainSort, 'margin_unit')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'cogs_pct'))}>
                <HeaderTooltip
                  label="COGS %"
                  description="Porcentaje del precio neto que representa el coste del plato."
                  formula="Coste/ración / Precio sin IVA"
                />{' '}
                <span>{indicator(mainSort, 'cogs_pct')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'margin_pct'))}>
                <HeaderTooltip
                  label="Margen %"
                  description="Porcentaje del precio neto que queda como margen bruto."
                  formula="Margen/ración / Precio sin IVA"
                />{' '}
                <span>{indicator(mainSort, 'margin_pct')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'pvp_objetivo_gross'))}>
                <HeaderTooltip
                  label="PVP objetivo"
                  description="Precio recomendado para que el coste represente un 25% del precio neto."
                  formula="Coste/ración × 4 × (1 + IVA)"
                />{' '}
                <span>{indicator(mainSort, 'pvp_objetivo_gross')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'dif'))}>
                <HeaderTooltip
                  label="Dif"
                  description="Diferencia entre el PVP actual y el PVP objetivo."
                  formula="PVP actual - PVP objetivo"
                />{' '}
                <span>{indicator(mainSort, 'dif')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'units_sold'))}>
                <HeaderTooltip
                  label="Unidades vendidas"
                  description="Número total de unidades vendidas en el periodo filtrado."
                />{' '}
                <span>{indicator(mainSort, 'units_sold')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'total_sales_net'))}>
                <HeaderTooltip
                  label="Total ventas"
                  description="Ventas netas totales del plato en el periodo."
                  formula="Unidades vendidas × Precio sin IVA"
                />{' '}
                <span>{indicator(mainSort, 'total_sales_net')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setMainSort((prev) => toggleSort(prev, 'total_margin'))}>
                <HeaderTooltip
                  label="Total margen"
                  description="Margen bruto total generado por el plato en el periodo."
                  formula="Unidades vendidas × Margen/ración"
                />{' '}
                <span>{indicator(mainSort, 'total_margin')}</span>
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
              <tr key={row.id} className="transition-colors hover:bg-slate-800/35">
                <td className="px-4 py-3 font-medium">
                  {row.source === 'menu' ? (
                    <Link href={`/cheffing/menus/${row.id}`} className="text-slate-100 transition hover:text-white hover:underline">
                      {row.name}
                    </Link>
                  ) : (
                    <Link href={`/cheffing/platos/${row.id}`} className="text-slate-100 transition hover:text-white hover:underline">
                      {row.name}
                    </Link>
                  )}
                </td>
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
                <td className="px-4 py-3">{row.has_sales_data ? row.units_sold.toLocaleString('es-ES') : 'Sin datos'}</td>
                <td className="px-4 py-3">{row.has_sales_data ? formatCurrency(row.total_sales_net) : 'Sin datos'}</td>
                <td className="px-4 py-3">{row.has_sales_data ? formatCurrency(row.total_margin) : 'Sin datos'}</td>
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
    <div className="max-w-full overflow-x-auto rounded-xl border border-slate-700/70 bg-slate-900/70 pb-2 shadow-[0_18px_42px_-34px_rgba(2,6,23,0.95)] ring-1 ring-white/[0.03]">
      <table className="w-max min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
        <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wide text-slate-400">
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
                <HeaderTooltip
                  label="Margen unitario"
                  description="Margen bruto por unidad vendida del plato."
                />{' '}
                <span>{indicator(detailSort, 'margin_unit')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button
                type="button"
                className={sortButtonClass}
                onClick={() => setDetailSort((prev) => toggleSort(prev, 'bcm_popularity_index'))}
              >
                <HeaderTooltip
                  label="Índice ventas"
                  description="Peso de este plato sobre el total de unidades vendidas."
                  formula="Unidades del plato / Total unidades vendidas"
                />{' '}
                <span>{indicator(detailSort, 'bcm_popularity_index')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <HeaderTooltip
                label="Margen"
                description="Indica si el margen unitario está por encima (+) o por debajo (-) del margen medio."
              />
            </th>
            <th className="px-4 py-3">
              <HeaderTooltip
                label="Popularidad"
                description="Indica si el índice de ventas está por encima (+) o por debajo (-) del índice medio de popularidad."
              />
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setDetailSort((prev) => toggleSort(prev, 'bcm'))}>
                <HeaderTooltip
                  label="Tipo"
                  description="Clasificación BCM del plato: Estrella, Vaca, Puzzle o Perro."
                />{' '}
                <span>{indicator(detailSort, 'bcm')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" className={sortButtonClass} onClick={() => setDetailSort((prev) => toggleSort(prev, 'bcm_margin_g'))}>
                <HeaderTooltip
                  label="Margen G"
                  description="Diferencia entre el margen unitario del plato y el margen medio."
                  formula="Margen unitario - Margen medio"
                />{' '}
                <span>{indicator(detailSort, 'bcm_margin_g')}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button
                type="button"
                className={sortButtonClass}
                onClick={() => setDetailSort((prev) => toggleSort(prev, 'bcm_popularity_g'))}
              >
                <HeaderTooltip
                  label="Popularidad G"
                  description="Diferencia entre el índice de ventas del plato y el índice medio de popularidad."
                  formula="Índice ventas - Índice medio popularidad"
                />{' '}
                <span>{indicator(detailSort, 'bcm_popularity_g')}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-900/40">
          {sortedDetailRows.map((row) => (
            <tr key={`bcm-detail-${row.id}`} className="transition-colors hover:bg-slate-800/35">
              <td className="px-4 py-3 font-medium">
                <Link href={`/cheffing/platos/${row.id}`} className="text-slate-100 transition hover:text-white hover:underline">
                  {row.name}
                </Link>
              </td>
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
