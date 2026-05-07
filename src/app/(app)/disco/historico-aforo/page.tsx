import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  QueueListIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

import { CapacityAnalyticsCharts } from './components/CapacityCharts';
import {
  formatDiscoDate,
  formatDiscoTime,
  getCapacityHistoryDataset,
  getSessionWeekdayFilterValue,
  getWeekdayFilterLabel,
  getWeekdayLabel,
  normalizeUuid,
  parseHistoryFilters,
  type CapacitySessionHistoryItem,
  type HistoryFilters,
  type HistoryRange,
  type HistoryTab,
  type WeekdayValue,
} from '@/lib/disco/capacityHistory';
import { requireCapacityHistoryAdmin } from '@/lib/disco/requireCapacityHistoryAdmin';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const RANGE_OPTIONS: Array<{ value: HistoryRange; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: 'Ultimos 7 dias' },
  { value: '30d', label: 'Ultimos 30 dias' },
  { value: 'all', label: 'Todas' },
];

const TAB_OPTIONS: Array<{ value: HistoryTab; label: string }> = [
  { value: 'sessions', label: 'Sesiones' },
  { value: 'insights', label: 'Insights' },
];

const WEEKDAY_OPTIONS: Array<{ value: WeekdayValue; label: string }> = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miercoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sabado' },
  { value: '7', label: 'Domingo' },
];

const integerFormatter = new Intl.NumberFormat('es-ES');

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null | undefined) {
  return formatDiscoDate(value);
}

function formatTime(value: string | null | undefined) {
  return formatDiscoTime(value);
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}

function buildHref(filters: HistoryFilters, overrides: Partial<Pick<HistoryFilters, 'range' | 'tab' | 'from' | 'to' | 'weekdays'>>) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  params.set('tab', next.tab);
  params.set('range', next.range);
  if (next.weekdays.length > 0) params.set('weekdays', next.weekdays.join(','));

  if (next.from) params.set('from', next.from);
  if (next.to) params.set('to', next.to);

  return `/disco/historico-aforo?${params.toString()}`;
}

function buildDetailHref(sessionId: string, filters: HistoryFilters) {
  const params = new URLSearchParams();
  params.set('tab', filters.tab);
  params.set('range', filters.range);
  if (filters.weekdays.length > 0) params.set('weekdays', filters.weekdays.join(','));
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return `/disco/historico-aforo/${sessionId}?${params.toString()}`;
}

function toggleWeekday(weekdays: WeekdayValue[], weekday: WeekdayValue): WeekdayValue[] {
  const selected = new Set(weekdays);
  if (selected.has(weekday)) {
    selected.delete(weekday);
  } else {
    selected.add(weekday);
  }

  return WEEKDAY_OPTIONS.map((option) => option.value).filter((value) => selected.has(value));
}

function MetricTile({ label, value, description, icon: Icon }: { label: string; value: string; description?: string; icon: typeof UsersIcon }) {
  return (
    <article className="rounded-2xl border border-slate-800/75 bg-slate-900/65 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
        </div>
        <span className="rounded-xl border border-primary-500/30 bg-primary-500/10 p-2 text-primary-100" aria-hidden="true">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {description ? <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p> : null}
    </article>
  );
}

function SessionTable({ sessions, filters }: { sessions: CapacitySessionHistoryItem[]; filters: HistoryFilters }) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/75 bg-slate-900/65 p-6 text-sm text-slate-300">
        No hay sesiones cerradas para los filtros seleccionados.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800/75 bg-slate-900/65">
      <div className="border-b border-slate-800/70 px-4 py-4 sm:px-5">
        <h2 className="text-base font-semibold text-white">Sesiones cerradas</h2>
        <p className="mt-1 text-sm text-slate-400">Tabla operativa compacta con entradas registradas, salidas y picos por noche.</p>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1180px] text-left text-sm text-slate-200">
          <thead className="bg-slate-950/45 text-xs uppercase tracking-wide text-slate-400">
            <tr className="border-b border-slate-800/70">
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Dia</th>
              <th className="px-4 py-3 font-semibold">Apertura</th>
              <th className="px-4 py-3 font-semibold">Cierre</th>
              <th className="px-4 py-3 font-semibold">Duracion</th>
              <th className="px-4 py-3 text-right font-semibold">Pico maximo</th>
              <th className="px-4 py-3 text-right font-semibold">Aforo final</th>
              <th className="px-4 py-3 text-right font-semibold">Entradas registradas</th>
              <th className="px-4 py-3 text-right font-semibold">Salidas registradas</th>
              <th className="px-4 py-3 text-right font-semibold">Movimientos</th>
              <th className="px-4 py-3 font-semibold">Responsable</th>
              <th className="px-4 py-3 font-semibold">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/20">
            {sessions.map((item) => (
              <tr key={item.session.id} className="transition hover:bg-primary-500/10">
                <td className="px-4 py-3 font-medium text-slate-100">{formatDate(item.session.opened_at)}</td>
                <td className="px-4 py-3">{getWeekdayLabel(getSessionWeekdayFilterValue(item.session.opened_at))}</td>
                <td className="px-4 py-3 tabular-nums">{formatTime(item.session.opened_at)}</td>
                <td className="px-4 py-3 tabular-nums">{formatTime(item.session.closed_at)}</td>
                <td className="px-4 py-3 tabular-nums">{formatDuration(item.metrics.duration_minutes)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary-100">{integerFormatter.format(item.session.peak_count)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{integerFormatter.format(item.session.current_count)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-300">{integerFormatter.format(item.metrics.total_entries)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-rose-300">{integerFormatter.format(item.metrics.total_exits)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{integerFormatter.format(item.metrics.event_count)}</td>
                <td className="max-w-[180px] truncate px-4 py-3 text-slate-400">{item.session.opened_by ?? '-'}</td>
                <td className="px-4 py-3">
                  <Link
                    href={buildDetailHref(item.session.id, filters)}
                    className="inline-flex items-center rounded-lg border border-primary-500/50 bg-primary-500/10 px-3 py-1.5 text-xs font-semibold text-primary-100 transition hover:bg-primary-500/20"
                  >
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-800/70 md:hidden">
        {sessions.map((item) => (
          <article key={item.session.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{formatDate(item.session.opened_at)}</p>
                <p className="text-xs text-slate-400">{formatTime(item.session.opened_at)} - {formatTime(item.session.closed_at)}</p>
              </div>
              <Link href={buildDetailHref(item.session.id, filters)} className="rounded-lg border border-primary-500/50 px-3 py-1.5 text-xs font-semibold text-primary-100">
                Ver
              </Link>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-slate-800/70 bg-slate-950/35 p-3"><dt className="text-xs text-slate-500">Pico</dt><dd className="font-semibold text-white">{item.session.peak_count}</dd></div>
              <div className="rounded-xl border border-slate-800/70 bg-slate-950/35 p-3"><dt className="text-xs text-slate-500">Entradas</dt><dd className="font-semibold text-emerald-300">{item.metrics.total_entries}</dd></div>
              <div className="rounded-xl border border-slate-800/70 bg-slate-950/35 p-3"><dt className="text-xs text-slate-500">Salidas</dt><dd className="font-semibold text-rose-300">{item.metrics.total_exits}</dd></div>
              <div className="rounded-xl border border-slate-800/70 bg-slate-950/35 p-3"><dt className="text-xs text-slate-500">Movimientos</dt><dd className="font-semibold text-white">{item.metrics.event_count}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function HistoricoAforoPage({ searchParams }: PageProps) {
  await requireCapacityHistoryAdmin('/disco/historico-aforo');

  const legacySessionId = normalizeUuid(firstParam(searchParams?.session));
  if (legacySessionId) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (key === 'session') continue;
      const resolvedValue = Array.isArray(value) ? value[0] : value;
      if (resolvedValue) params.set(key, resolvedValue);
    }
    redirect(`/disco/historico-aforo/${legacySessionId}${params.size ? `?${params.toString()}` : ''}`);
  }

  const filters = parseHistoryFilters(searchParams);
  const dataset = await getCapacityHistoryDataset({ filters, limit: 300 });
  const insights = dataset.insights;

  return (
    <div className="disco-ops-page disco-history-page space-y-5">
      <header className="rounded-2xl border border-slate-800/75 bg-slate-900/65 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-primary-100">Disco · Aforo</p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Historico de aforo</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Sesiones cerradas, movimientos registrados e insights para comparar noches, dias de semana y evolucion de aforo.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/70 bg-slate-950/35 px-4 py-3 text-sm text-slate-300">
            <p className="font-semibold text-slate-100">Entradas registradas</p>
            <p className="mt-1 text-xs text-slate-500">No equivale necesariamente a clientes unicos.</p>
          </div>
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-800/75 bg-slate-900/65 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {TAB_OPTIONS.map((option) => {
            const active = option.value === filters.tab;
            return (
              <Link
                key={option.value}
                href={buildHref(filters, { tab: option.value })}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'border-primary-500/60 bg-primary-500/20 text-primary-100'
                    : 'border-slate-700/80 bg-slate-950/20 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="text-sm font-semibold text-white">Rango rapido</h2>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {RANGE_OPTIONS.map((option) => {
                const active = option.value === filters.range && !filters.hasManualRange;
                return (
                  <Link
                    key={option.value}
                    href={buildHref(filters, { range: option.value, from: null, to: null })}
                    className={`rounded-lg border px-3 py-2 text-center text-sm font-semibold transition ${
                      active
                        ? 'border-primary-500/60 bg-primary-500/20 text-primary-100'
                        : 'border-slate-700/80 bg-slate-950/20 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <form action="/disco/historico-aforo" className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input type="hidden" name="tab" value={filters.tab} />
            <input type="hidden" name="range" value={filters.range} />
            {filters.weekdays.length > 0 ? <input type="hidden" name="weekdays" value={filters.weekdays.join(',')} /> : null}
            <label className="text-sm text-slate-300">
              Desde
              <input name="from" type="date" defaultValue={filters.from ?? ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/35 px-3 py-2 text-sm text-slate-100" />
            </label>
            <label className="text-sm text-slate-300">
              Hasta
              <input name="to" type="date" defaultValue={filters.to ?? ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/35 px-3 py-2 text-sm text-slate-100" />
            </label>
            <button type="submit" className="self-end rounded-lg border border-primary-500/50 bg-primary-500/15 px-4 py-2 text-sm font-semibold text-primary-100 transition hover:bg-primary-500/25">
              Aplicar
            </button>
          </form>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-white">Dia de la semana</h2>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            <Link
              href={buildHref(filters, { weekdays: [] })}
              className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                filters.weekdays.length === 0
                  ? 'border-primary-500/60 bg-primary-500/20 text-primary-100'
                  : 'border-slate-700/80 bg-slate-950/20 text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              Todos
            </Link>
            {WEEKDAY_OPTIONS.map((option) => {
              const active = filters.weekdays.includes(option.value);
              return (
                <Link
                  key={option.value}
                  href={buildHref(filters, { weekdays: toggleWeekday(filters.weekdays, option.value) })}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? 'border-primary-500/60 bg-primary-500/20 text-primary-100'
                      : 'border-slate-700/80 bg-slate-950/20 text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
        </div>

        {filters.dateNotice ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">{filters.dateNotice}</p>
        ) : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Sesiones cerradas" value={integerFormatter.format(insights.closedSessions)} description={`Filtro: ${getWeekdayFilterLabel(filters.weekdays)}`} icon={CalendarDaysIcon} />
        <MetricTile label="Entradas registradas" value={integerFormatter.format(insights.totalEntries)} description="No equivale necesariamente a clientes unicos." icon={UsersIcon} />
        <MetricTile label="Pico maximo" value={integerFormatter.format(insights.rangePeak)} description={`Pico medio: ${integerFormatter.format(insights.averagePeak)}`} icon={ArrowTrendingUpIcon} />
        <MetricTile label="Movimientos" value={integerFormatter.format(insights.totalMovements)} description={`Salidas: ${integerFormatter.format(insights.totalExits)}`} icon={QueueListIcon} />
      </div>

      {filters.tab === 'sessions' ? (
        <SessionTable sessions={dataset.sessions} filters={filters} />
      ) : (
        <div className="space-y-4">
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Aforo final medio" value={integerFormatter.format(insights.averageFinal)} icon={ChartBarIcon} />
            <MetricTile label="Duracion media" value={formatDuration(insights.averageDurationMinutes)} icon={ClockIcon} />
            <MetricTile
              label="Mejor pico"
              value={insights.bestByPeak ? integerFormatter.format(insights.bestByPeak.session.peak_count) : '-'}
              description={insights.bestByPeak ? formatDate(insights.bestByPeak.session.opened_at) : 'Sin sesiones'}
              icon={ArrowTrendingUpIcon}
            />
            <MetricTile
              label="Mejor por entradas"
              value={insights.bestByEntries ? integerFormatter.format(insights.bestByEntries.metrics.total_entries) : '-'}
              description={insights.bestByEntries ? formatDate(insights.bestByEntries.session.opened_at) : 'Sin sesiones'}
              icon={UsersIcon}
            />
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800/75 bg-slate-900/65 p-4">
              <h2 className="text-base font-semibold text-white">Dia con mayor afluencia</h2>
              <p className="mt-2 text-2xl font-semibold text-primary-100">{insights.weekdayWithMostTraffic ?? '-'}</p>
              <p className="mt-2 text-sm text-slate-400">Calculado por entradas registradas totales en el rango.</p>
            </div>
            <div className="rounded-2xl border border-slate-800/75 bg-slate-900/65 p-4">
              <h2 className="text-base font-semibold text-white">Hora aproximada de mayor aforo medio</h2>
              <p className="mt-2 text-2xl font-semibold text-primary-100">{insights.approximatePeakHour ?? '-'}</p>
              <p className="mt-2 text-sm text-slate-400">Derivado de la evolucion media por franjas de 15 minutos.</p>
            </div>
          </section>

          <CapacityAnalyticsCharts
            averageEvolution={insights.averageEvolution}
            entriesBySession={insights.entriesBySession}
            peakBySession={insights.peakBySession}
            weekdayComparison={insights.weekdayComparison}
            closingQuality={insights.closingQuality}
          />
        </div>
      )}

      {dataset.isLimited ? (
        <p className="text-xs text-slate-500">Consulta limitada a las ultimas {dataset.limit} sesiones cerradas antes de aplicar el filtro de dia.</p>
      ) : null}
    </div>
  );
}
