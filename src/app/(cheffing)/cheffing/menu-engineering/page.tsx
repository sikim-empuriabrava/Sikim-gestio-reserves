import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { getMenuEngineeringRows, type MenuEngineeringRow } from '@/lib/cheffing/menuEngineering';

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

const toNumberOrNull = (value?: string) => {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  const selectedIva = toNumberOrNull(searchParams?.iva) ?? 0.1;

  let rows: MenuEngineeringRow[] = [];
  let loadError: string | null = null;

  try {
    const result = await getMenuEngineeringRows(selectedIva);
    rows = result.rows;
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Error desconocido al cargar el reporte.';
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Menu Engineering</h2>
        <p className="text-sm text-slate-400">
          Analiza márgenes por plato con los datos actuales de Cheffing. La clasificación BCM se activará cuando
          integremos ventas.
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
            defaultValue={selectedIva.toString()}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          >
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
        Nota: el rango de fechas se aplicará cuando integremos ventas (SumUp). Por ahora solo afecta al reporte de
        costes/márgenes.
      </p>

      {loadError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          No se pudo cargar el reporte: {loadError}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800/70">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
            <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Plato</th>
                <th className="px-4 py-3">PVP</th>
                <th className="px-4 py-3">Coste/ración</th>
                <th className="px-4 py-3">Precio sin IVA</th>
                <th className="px-4 py-3">Margen/ración</th>
                <th className="px-4 py-3">Food cost %</th>
                <th className="px-4 py-3">PVP objetivo 25%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
                    No hay platos disponibles para analizar.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-slate-100">{row.name}</td>
                    <td className="px-4 py-3">{formatCurrency(row.selling_price)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.cost_per_serving)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.net_price)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.margin_unit)}</td>
                    <td className="px-4 py-3">{formatPercent(row.food_cost_pct)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col text-xs text-slate-400">
                        <span>Neto: {formatCurrency(row.target_pvp_net_25)}</span>
                        <span>Con IVA: {formatCurrency(row.target_pvp_gross_25)}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Clasificación BCM (Estrella/Vaca/Puzzle/Perro) pendiente de integrar ventas (SumUp).
      </div>
    </section>
  );
}
