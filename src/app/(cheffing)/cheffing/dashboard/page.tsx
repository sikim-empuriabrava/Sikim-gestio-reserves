import Link from 'next/link';

import {
  getCheffingDashboardData,
  MAX_FOOD_COST_PCT,
  MIN_MARGIN_PCT,
} from '@/lib/cheffing/cheffingDashboard';
import { normalizeMenuEngineeringVatRate } from '@/lib/cheffing/menuEngineeringVat';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { mergeQueryString } from '@/lib/cheffing/url';

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

const integerFormatter = new Intl.NumberFormat('es-ES');

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

const badgeByCode = {
  MISSING_PVP: 'border-rose-500/50 bg-rose-500/15 text-rose-100',
  MISSING_COST: 'border-rose-500/50 bg-rose-500/15 text-rose-100',
  LOSS: 'border-red-500/50 bg-red-500/15 text-red-100',
  FOOD_COST_HIGH: 'border-amber-500/50 bg-amber-500/15 text-amber-100',
  MARGIN_LOW: 'border-yellow-500/50 bg-yellow-500/15 text-yellow-100',
} as const;

function toPropagatedParams(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  vatRate: number,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === 'string') {
      params.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
    }
  }

  if (searchParams && Object.prototype.hasOwnProperty.call(searchParams, 'iva')) {
    params.set('iva', String(vatRate));
  } else {
    params.delete('iva');
  }

  return params;
}

export default async function CheffingDashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireCheffingAccess();

  const rawIva = typeof searchParams?.iva === 'string' ? searchParams.iva : searchParams?.iva?.[0];
  const vatRate = normalizeMenuEngineeringVatRate(rawIva);
  const propagatedParams = toPropagatedParams(searchParams, vatRate);
  let loadError: string | null = null;

  const dashboard = await getCheffingDashboardData(vatRate).catch((error) => {
    loadError = error instanceof Error ? error.message : 'Error desconocido al cargar el dashboard.';
    return null;
  });

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Cheffing Dashboard + alertas v1</h2>
        <p className="text-sm text-slate-400">
          Panel de control operativo para detectar platos con datos incompletos o márgenes comprometidos.
        </p>
      </header>

      {loadError || !dashboard ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          No se pudo cargar el dashboard: {loadError ?? 'Error desconocido.'}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Total platos</p>
              <p className="mt-2 text-2xl font-semibold text-white">{integerFormatter.format(dashboard.totalDishes)}</p>
            </article>
            <article className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Platos sin PVP</p>
              <p className="mt-2 text-2xl font-semibold text-rose-200">
                {integerFormatter.format(dashboard.missingPvpCount)}
              </p>
            </article>
            <article className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Platos sin coste</p>
              <p className="mt-2 text-2xl font-semibold text-rose-200">
                {integerFormatter.format(dashboard.missingCostCount)}
              </p>
            </article>
            <article className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Platos en alerta</p>
              <p className="mt-2 text-2xl font-semibold text-amber-100">
                {integerFormatter.format(dashboard.alertDishesCount)}
              </p>
            </article>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800/70">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Plato</th>
                  <th className="px-4 py-3">PVP</th>
                  <th className="px-4 py-3">Coste/ración</th>
                  <th className="px-4 py-3">Food cost %</th>
                  <th className="px-4 py-3">Margen unitario</th>
                  <th className="px-4 py-3">Alertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                {dashboard.alertRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">
                      No hay alertas activas con las reglas actuales.
                    </td>
                  </tr>
                ) : (
                  dashboard.alertRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium text-slate-100">
                        <Link
                          className="hover:text-white hover:underline"
                          href={mergeQueryString(`/cheffing/platos/${row.id}`, propagatedParams.toString())}
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{formatCurrency(row.selling_price)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.cost_per_serving)}</td>
                      <td className="px-4 py-3">{formatPercent(row.food_cost_pct)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.margin_unit)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {row.alerts.map((alert) => (
                            <span
                              key={alert.code}
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeByCode[alert.code]}`}
                            >
                              {alert.label}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400">
            Config v1: IVA {percentFormatter.format(dashboard.vatRate)}, food cost alto &gt;{' '}
            {percentFormatter.format(MAX_FOOD_COST_PCT)}, margen % bajo &lt; {percentFormatter.format(MIN_MARGIN_PCT)}.
          </p>
        </>
      )}
    </section>
  );
}
