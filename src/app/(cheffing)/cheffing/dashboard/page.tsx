import Link from 'next/link';
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  RectangleStackIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

import { DataTableShell, MetricCard, MetricStrip, PageHeader, StatusBadge, cn } from '@/components/ui';
import {
  getCheffingDashboardData,
  MAX_FOOD_COST_PCT,
  MIN_MARGIN_PCT,
} from '@/lib/cheffing/cheffingDashboard';
import { normalizeMenuEngineeringVatRate } from '@/lib/cheffing/menuEngineeringVat';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { mergeQueryString } from '@/lib/cheffing/url';
import {
  CheffingEmptyState,
  cheffingNumericClassName,
  cheffingRowClassName,
  cheffingTableClassName,
  cheffingTheadClassName,
} from '@/app/(cheffing)/cheffing/components/CheffingUi';

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
    return '-';
  }
  return currencyFormatter.format(value);
};

const formatPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return '-';
  }
  return percentFormatter.format(value);
};

const badgeToneByCode: Record<string, 'danger' | 'warning'> = {
  MISSING_PVP: 'danger',
  MISSING_COST: 'danger',
  LOSS: 'danger',
  FOOD_COST_HIGH: 'warning',
  MARGIN_LOW: 'warning',
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
    <>
      <PageHeader
        eyebrow="Cheffing"
        title="Dashboard"
        description="Panel operativo para detectar platos con datos incompletos o márgenes comprometidos."
      />

      {loadError || !dashboard ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          No se pudo cargar el dashboard: {loadError ?? 'Error desconocido.'}
        </div>
      ) : (
        <>
          <MetricStrip className="xl:grid-cols-[1fr_1fr_1fr_1.2fr]">
            <MetricCard
              label="Total platos"
              value={integerFormatter.format(dashboard.totalDishes)}
              description="Base analizada"
              tone="violet"
              icon={<RectangleStackIcon className="h-5 w-5" />}
            />
            <MetricCard
              label="Sin PVP"
              value={integerFormatter.format(dashboard.missingPvpCount)}
              description="Requieren precio"
              tone="rose"
              icon={<TagIcon className="h-5 w-5" />}
            />
            <MetricCard
              label="Sin coste"
              value={integerFormatter.format(dashboard.missingCostCount)}
              description="Escandallo incompleto"
              tone="amber"
              icon={<ChartBarIcon className="h-5 w-5" />}
            />
            <MetricCard
              label="En alerta"
              value={integerFormatter.format(dashboard.alertDishesCount)}
              description="Revisar margen o coste"
              tone="amber"
              icon={<ExclamationTriangleIcon className="h-5 w-5" />}
            />
          </MetricStrip>

          <DataTableShell
            title="Alertas de platos"
            description="PVP, coste por ración, food cost y margen unitario con reglas v1."
            footer={
              <span>
                Config v1: IVA {percentFormatter.format(dashboard.vatRate)}, food cost alto &gt;{' '}
                {percentFormatter.format(MAX_FOOD_COST_PCT)}, margen % bajo &lt; {percentFormatter.format(MIN_MARGIN_PCT)}.
              </span>
            }
          >
            <table className={cn(cheffingTableClassName, 'min-w-[1000px]')}>
              <thead className={cheffingTheadClassName}>
                <tr className="border-b border-slate-800/80">
                  <th className="w-[28%] px-4 py-3 font-semibold text-slate-300">Plato</th>
                  <th className="px-4 py-3 font-semibold text-slate-300">PVP</th>
                  <th className="px-4 py-3 font-semibold text-slate-300">Coste/ración</th>
                  <th className="px-4 py-3 font-semibold text-slate-300">Food cost %</th>
                  <th className="px-4 py-3 font-semibold text-slate-300">Margen unitario</th>
                  <th className="px-4 py-3 font-semibold text-slate-300">Alertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/20">
                {dashboard.alertRows.length === 0 ? (
                  <CheffingEmptyState
                    colSpan={6}
                    title="No hay alertas activas con las reglas actuales."
                    description="Los platos analizados no superan los umbrales configurados."
                  />
                ) : (
                  dashboard.alertRows.map((row) => (
                    <tr key={row.id} className={cheffingRowClassName}>
                      <td className="px-4 py-3 align-middle font-medium text-slate-100">
                        <Link
                          className="underline-offset-4 transition hover:text-primary-100 hover:underline"
                          href={mergeQueryString(`/cheffing/platos/${row.id}`, propagatedParams.toString())}
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className={cn('px-4 py-3 align-middle', cheffingNumericClassName)}>
                        {formatCurrency(row.selling_price)}
                      </td>
                      <td className={cn('px-4 py-3 align-middle', cheffingNumericClassName)}>
                        {formatCurrency(row.cost_per_serving)}
                      </td>
                      <td className={cn('px-4 py-3 align-middle', cheffingNumericClassName)}>
                        {formatPercent(row.food_cost_pct)}
                      </td>
                      <td className={cn('px-4 py-3 align-middle', cheffingNumericClassName)}>
                        {formatCurrency(row.margin_unit)}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap gap-2">
                          {row.alerts.map((alert) => (
                            <StatusBadge key={alert.code} tone={badgeToneByCode[alert.code] ?? 'warning'}>
                              {alert.label}
                            </StatusBadge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </DataTableShell>
        </>
      )}
    </>
  );
}
