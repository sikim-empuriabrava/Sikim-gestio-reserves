import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { getMenuEngineeringRows, type MenuEngineeringRow, type MenuEngineeringPivots } from '@/lib/cheffing/menuEngineering';
import { MENU_ENGINEERING_FAMILIES, type MenuEngineeringDishFamily } from '@/lib/cheffing/menuEngineeringFamily';
import { normalizeMenuEngineeringVatRate } from '@/lib/cheffing/menuEngineeringVat';

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

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

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

const isValidISODate = (value: string | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const isValidDateRange = (from: string, to: string) => {
  if (!isValidISODate(from) || !isValidISODate(to)) {
    return false;
  }

  return from <= to;
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

type BcmSummary = {
  estrella: number;
  vaca: number;
  puzzle: number;
  perro: number;
  sinDatos: number;
  totals: {
    estrella: { units: number; sales: number; margin: number };
    vaca: { units: number; sales: number; margin: number };
    puzzle: { units: number; sales: number; margin: number };
    perro: { units: number; sales: number; margin: number };
  };
};

const bcmTypeOrder: Array<Exclude<MenuEngineeringRow['bcm'], 'SIN_DATOS'>> = ['ESTRELLA', 'VACA', 'PUZZLE', 'PERRO'];

const bcmTitleByType: Record<Exclude<MenuEngineeringRow['bcm'], 'SIN_DATOS'>, string> = {
  ESTRELLA: '++ Estrella',
  VACA: '-+ Vaca',
  PUZZLE: '+- Puzzle',
  PERRO: '-- Perro',
};

const bcmSign = (value: boolean) => (value ? '+' : '-');

const buildBcmSummary = (rows: MenuEngineeringRow[]): BcmSummary => {
  const summary: BcmSummary = {
    estrella: 0,
    vaca: 0,
    puzzle: 0,
    perro: 0,
    sinDatos: 0,
    totals: {
      estrella: { units: 0, sales: 0, margin: 0 },
      vaca: { units: 0, sales: 0, margin: 0 },
      puzzle: { units: 0, sales: 0, margin: 0 },
      perro: { units: 0, sales: 0, margin: 0 },
    },
  };

  for (const row of rows) {
    const units = Number.isFinite(row.units_sold) ? row.units_sold : 0;
    const sales = row.total_sales_net !== null && Number.isFinite(row.total_sales_net) ? row.total_sales_net : 0;
    const margin = row.total_margin !== null && Number.isFinite(row.total_margin) ? row.total_margin : 0;

    switch (row.bcm) {
      case 'ESTRELLA':
        summary.estrella += 1;
        summary.totals.estrella.units += units;
        summary.totals.estrella.sales += sales;
        summary.totals.estrella.margin += margin;
        break;
      case 'VACA':
        summary.vaca += 1;
        summary.totals.vaca.units += units;
        summary.totals.vaca.sales += sales;
        summary.totals.vaca.margin += margin;
        break;
      case 'PUZZLE':
        summary.puzzle += 1;
        summary.totals.puzzle.units += units;
        summary.totals.puzzle.sales += sales;
        summary.totals.puzzle.margin += margin;
        break;
      case 'PERRO':
        summary.perro += 1;
        summary.totals.perro.units += units;
        summary.totals.perro.sales += sales;
        summary.totals.perro.margin += margin;
        break;
      case 'SIN_DATOS':
        summary.sinDatos += 1;
        break;
      default:
        break;
    }
  }

  return summary;
};

export default async function MenuEngineeringPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string; iva?: string; family?: string };
}) {
  await requireCheffingAccess();

  const today = new Date();
  const defaultTo = formatDateInput(today);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 30);
  const defaultFrom = formatDateInput(startDate);

  const selectedFrom = searchParams?.from ?? defaultFrom;
  const selectedTo = searchParams?.to ?? defaultTo;
  const selectedVatRate = normalizeMenuEngineeringVatRate(searchParams?.iva);
  const selectedFamily = searchParams?.family && MENU_ENGINEERING_FAMILIES.includes(searchParams.family as MenuEngineeringDishFamily)
    ? (searchParams.family as MenuEngineeringDishFamily)
    : null;
  const hasValidDateRange = isValidDateRange(selectedFrom, selectedTo);

  let rows: MenuEngineeringRow[] = [];
  let availableFamilies: MenuEngineeringDishFamily[] = [];
  let pivots: MenuEngineeringPivots = { popularity: 0, margin: 0 };
  let bcmStats = {
    totalUnitsSold: 0,
    totalSales: 0,
    totalMargin: 0,
    dishCount: 0,
    marginAverage: 0,
    costProductPct: 0,
    popularityCorrectionPct: 0.7,
    popularityIndexAverage: 0,
  };
  let loadError: string | null = null;

  try {
    const result = await getMenuEngineeringRows(selectedVatRate, { from: selectedFrom, to: selectedTo }, selectedFamily ?? undefined);
    rows = result.rows;
    pivots = result.pivots;
    bcmStats = result.stats;
    availableFamilies = result.availableFamilies;
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Error desconocido al cargar el reporte.';
  }

  const bcmSummary = buildBcmSummary(rows);
  const hasBcmUsableData = rows.some((row) => row.bcm !== 'SIN_DATOS');
  const bcmScatterRows = rows.filter(
    (row) => row.bcm !== 'SIN_DATOS' && row.bcm_margin_g !== null && row.bcm_popularity_g !== null,
  );
  const bcmDetailRows = rows.filter(
    (row) => row.bcm !== 'SIN_DATOS' && row.margin_unit !== null && row.bcm_popularity_index !== null,
  );

  const marginAbsMax = bcmScatterRows.reduce(
    (max, row) => Math.max(max, Math.abs(row.bcm_margin_g ?? 0)),
    0.01,
  );
  const popularityAbsMax = bcmScatterRows.reduce(
    (max, row) => Math.max(max, Math.abs(row.bcm_popularity_g ?? 0)),
    0.01,
  );

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Menu Engineering</h2>
        <p className="text-sm text-slate-400">
          Analiza márgenes por plato diferenciando coste por ración (yield) y ventas reales/unidades vendidas.
        </p>
      </header>

      <form
        method="get"
        className="grid gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4 md:grid-cols-5"
      >
        <label className="space-y-1 text-sm text-slate-300">
          Desde
          <input
            type="date"
            name="from"
            defaultValue={selectedFrom}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="space-y-1 text-sm text-slate-300">
          Hasta
          <input
            type="date"
            name="to"
            defaultValue={selectedTo}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="space-y-1 text-sm text-slate-300">
          IVA aplicado al análisis
          <select
            name="iva"
            defaultValue={selectedVatRate.toString()}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          >
            <option value="0">0%</option>
            <option value="0.04">4%</option>
            <option value="0.1">10%</option>
            <option value="0.21">21%</option>
          </select>
        </label>
        <label className="space-y-1 text-sm text-slate-300">
          Familia
          <select
            name="family"
            defaultValue={selectedFamily ?? ''}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">Todas</option>
            {availableFamilies.map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-lg border border-emerald-500/70 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400 hover:text-white"
          >
            Actualizar
          </button>
        </div>
      </form>
      <p className="text-sm text-slate-400">
        Nota: servings = raciones producidas por receta (yield, para coste/ración), no ventas. Unidades vendidas =
        ventas (POS/SumUp o placeholder).
        {hasValidDateRange
          ? ' Unidades vendidas se filtran por Fecha apertura (sale_day) en el rango seleccionado.'
          : ' Rango inválido (formato o orden de fechas): no se filtra por fechas y se usa acumulado.'}
        {' '}PVP se interpreta como precio final con IVA; “Precio sin IVA” se calcula dividiendo por (1 + IVA
        seleccionado).
      </p>

      {loadError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          No se pudo cargar el reporte: {loadError}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-800/70">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Plato</th>
                  <th className="px-4 py-3">BCM</th>
                  <th className="px-4 py-3">PVP (con IVA)</th>
                  <th className="px-4 py-3">Coste/ración</th>
                  <th className="px-4 py-3">Precio sin IVA (base)</th>
                  <th className="px-4 py-3">Margen/ración</th>
                  <th className="px-4 py-3">COGS % (sobre base)</th>
                  <th className="px-4 py-3">Margen % (sobre base)</th>
                  <th className="px-4 py-3">PVP objetivo (con IVA)</th>
                  <th className="px-4 py-3">Dif (PVP - objetivo)</th>
                  <th className="px-4 py-3">Unidades vendidas</th>
                  <th className="px-4 py-3">Total ventas (€)</th>
                  <th className="px-4 py-3">Total margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-6 text-center text-sm text-slate-400">
                      No hay platos disponibles para analizar.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium text-slate-100">{row.name}</td>
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

          <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Matriz BCM</h3>
            <p className="text-sm text-slate-400">Bloque BCM separado según el Excel validado (tabla + visual).</p>
            {hasBcmUsableData ? (
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-sm">
                      <p className="text-slate-400">Total unidades vendidas</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {bcmStats.totalUnitsSold.toLocaleString('es-ES')}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-sm">
                      <p className="text-slate-400">Total ventas</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">{formatCurrency(bcmStats.totalSales)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-sm">
                      <p className="text-slate-400">Total margen</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">{formatCurrency(bcmStats.totalMargin)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-sm">
                      <p className="text-slate-400">Número de platos</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">{bcmStats.dishCount}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-sm">
                      <p className="text-slate-400">Margen medio</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">{formatCurrency(bcmStats.marginAverage)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-sm">
                      <p className="text-slate-400">% coste producto</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">{formatPercent(bcmStats.costProductPct)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-sm">
                      <p className="text-slate-400">% corrección popularidad</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {formatPercent(bcmStats.popularityCorrectionPct)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-sm">
                      <p className="text-slate-400">Índice medio popularidad</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">{formatPercent(bcmStats.popularityIndexAverage)}</p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-800/70">
                    <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
                      <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Tipo BCM</th>
                          <th className="px-4 py-3">Platos</th>
                          <th className="px-4 py-3">Total unidades</th>
                          <th className="px-4 py-3">Total ventas</th>
                          <th className="px-4 py-3">Total margen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                        {bcmTypeOrder.map((type) => {
                          const count =
                            type === 'ESTRELLA'
                              ? bcmSummary.estrella
                              : type === 'VACA'
                                ? bcmSummary.vaca
                                : type === 'PUZZLE'
                                  ? bcmSummary.puzzle
                                  : bcmSummary.perro;
                          const totals =
                            type === 'ESTRELLA'
                              ? bcmSummary.totals.estrella
                              : type === 'VACA'
                                ? bcmSummary.totals.vaca
                                : type === 'PUZZLE'
                                  ? bcmSummary.totals.puzzle
                                  : bcmSummary.totals.perro;

                          return (
                            <tr key={type}>
                              <td className="px-4 py-3">{bcmTitleByType[type]}</td>
                              <td className="px-4 py-3">{count}</td>
                              <td className="px-4 py-3">{totals.units.toLocaleString('es-ES')}</td>
                              <td className="px-4 py-3">{formatCurrency(totals.sales)}</td>
                              <td className="px-4 py-3">{formatCurrency(totals.margin)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-800/70">
                    <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
                      <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Plato</th>
                          <th className="px-4 py-3">Margen unitario</th>
                          <th className="px-4 py-3">Índice ventas</th>
                          <th className="px-4 py-3">Margen</th>
                          <th className="px-4 py-3">Popularidad</th>
                          <th className="px-4 py-3">Tipo</th>
                          <th className="px-4 py-3">Margen G</th>
                          <th className="px-4 py-3">Popularidad G</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                        {bcmDetailRows.map((row) => (
                          <tr key={`bcm-detail-${row.id}`}>
                            <td className="px-4 py-3 font-medium text-slate-100">{row.name}</td>
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
                </div>

                <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-4">
                  <h4 className="text-sm font-semibold text-slate-100">Visual BCM (Margen G vs Popularidad G)</h4>
                  <div className="relative mt-3 h-80 rounded-lg border border-slate-700/80 bg-slate-950/60">
                    <div className="absolute left-0 right-0 top-1/2 border-t border-slate-700/80" />
                    <div className="absolute bottom-0 top-0 left-1/2 border-l border-slate-700/80" />
                    {bcmScatterRows.map((row) => {
                      const xPct = 50 + ((row.bcm_margin_g ?? 0) / marginAbsMax) * 46;
                      const yPct = 50 - ((row.bcm_popularity_g ?? 0) / popularityAbsMax) * 46;

                      return (
                        <div
                          key={row.id}
                          title={`${row.name} · ${bcmLabelByType[row.bcm]} · Margen G ${formatCurrency(row.bcm_margin_g)} · Popularidad G ${formatPercent(row.bcm_popularity_g)}`}
                          className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border ${bcmBadgeClassByType[row.bcm]}`}
                          style={{ left: `${Math.min(96, Math.max(4, xPct))}%`, top: `${Math.min(96, Math.max(4, yPct))}%` }}
                        />
                      );
                    })}
                    <div className="absolute bottom-2 right-2 rounded bg-slate-900/80 px-2 py-1 text-[11px] text-slate-300">
                      X: Margen G · Y: Popularidad G
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    Umbral margen = {formatCurrency(pivots.margin)} · umbral popularidad = {formatPercent(pivots.popularity)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
                BCM no disponible: aún no hay ventas (o mapeo TPV) en el rango seleccionado.
              </div>
            )}
            {bcmSummary.sinDatos > 0 ? (
              <p className="text-xs text-slate-400">
                Platos sin datos BCM: {bcmSummary.sinDatos} (faltan datos de margen y/o ventas válidas).
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
