import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { getMenuEngineeringRows, type MenuEngineeringRow, type MenuEngineeringPivots } from '@/lib/cheffing/menuEngineering';
import { normalizeMenuEngineeringVatRate } from '@/lib/cheffing/menuEngineeringVat';

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const decimalFormatter = new Intl.NumberFormat('es-ES', {
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

const formatDecimal = (value: number) => decimalFormatter.format(value);

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
    const sales = Number.isFinite(row.total_sales_gross) ? row.total_sales_gross : 0;
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
  searchParams?: { from?: string; to?: string; iva?: string };
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
  const hasValidDateRange = isValidDateRange(selectedFrom, selectedTo);

  let rows: MenuEngineeringRow[] = [];
  let pivots: MenuEngineeringPivots = { popularity: 0, margin: 0 };
  let loadError: string | null = null;

  try {
    const result = await getMenuEngineeringRows(selectedVatRate, { from: selectedFrom, to: selectedTo });
    rows = result.rows;
    pivots = result.pivots;
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Error desconocido al cargar el reporte.';
  }

  const bcmSummary = buildBcmSummary(rows);
  const hasBcmUsableData = rows.some((row) => row.bcm !== 'SIN_DATOS');

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
        className="grid gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4 md:grid-cols-4"
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
                  <th className="px-4 py-3">Total ventas (con IVA)</th>
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
                      <td className="px-4 py-3">{formatCurrency(row.total_sales_gross)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.total_margin)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Matriz BCM</h3>
            <p className="text-sm text-slate-400">
              Pivots usados (media): Popularidad = {formatDecimal(pivots.popularity)} unidades · Rentabilidad ={' '}
              {formatCurrency(pivots.margin)} margen/ración.
            </p>
            {hasBcmUsableData ? (
              <div className="overflow-hidden rounded-xl border border-slate-800/70">
                <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
                  <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Cuadrante</th>
                      <th className="px-4 py-3">BCM</th>
                      <th className="px-4 py-3">Platos</th>
                      <th className="px-4 py-3">Total units</th>
                      <th className="px-4 py-3">Total ventas</th>
                      <th className="px-4 py-3">Total margen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                    <tr>
                      <td className="px-4 py-3">High Pop / High Margin</td>
                      <td className="px-4 py-3">Estrella</td>
                      <td className="px-4 py-3">{bcmSummary.estrella}</td>
                      <td className="px-4 py-3">{bcmSummary.totals.estrella.units.toLocaleString('es-ES')}</td>
                      <td className="px-4 py-3">{formatCurrency(bcmSummary.totals.estrella.sales)}</td>
                      <td className="px-4 py-3">{formatCurrency(bcmSummary.totals.estrella.margin)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">High Pop / Low Margin</td>
                      <td className="px-4 py-3">Vaca</td>
                      <td className="px-4 py-3">{bcmSummary.vaca}</td>
                      <td className="px-4 py-3">{bcmSummary.totals.vaca.units.toLocaleString('es-ES')}</td>
                      <td className="px-4 py-3">{formatCurrency(bcmSummary.totals.vaca.sales)}</td>
                      <td className="px-4 py-3">{formatCurrency(bcmSummary.totals.vaca.margin)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">Low Pop / High Margin</td>
                      <td className="px-4 py-3">Puzzle</td>
                      <td className="px-4 py-3">{bcmSummary.puzzle}</td>
                      <td className="px-4 py-3">{bcmSummary.totals.puzzle.units.toLocaleString('es-ES')}</td>
                      <td className="px-4 py-3">{formatCurrency(bcmSummary.totals.puzzle.sales)}</td>
                      <td className="px-4 py-3">{formatCurrency(bcmSummary.totals.puzzle.margin)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">Low Pop / Low Margin</td>
                      <td className="px-4 py-3">Perro</td>
                      <td className="px-4 py-3">{bcmSummary.perro}</td>
                      <td className="px-4 py-3">{bcmSummary.totals.perro.units.toLocaleString('es-ES')}</td>
                      <td className="px-4 py-3">{formatCurrency(bcmSummary.totals.perro.sales)}</td>
                      <td className="px-4 py-3">{formatCurrency(bcmSummary.totals.perro.margin)}</td>
                    </tr>
                  </tbody>
                </table>
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
