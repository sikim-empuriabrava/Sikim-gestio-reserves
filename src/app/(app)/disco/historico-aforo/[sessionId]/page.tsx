import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  QueueListIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

import { SessionEvolutionChart } from '../components/CapacityCharts';
import {
  getClosedCapacitySessionDetail,
  getWeekdayLabel,
  parseHistoryFilters,
  type EventRow,
  type WeekdayFilter,
} from '@/lib/disco/capacityHistory';
import { requireCapacityHistoryAdmin } from '@/lib/disco/requireCapacityHistoryAdmin';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: { sessionId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

const integerFormatter = new Intl.NumberFormat('es-ES');

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-ES', { timeStyle: 'short' }).format(new Date(value));
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}

function buildBackHref(searchParams: PageProps['searchParams']) {
  const filters = parseHistoryFilters(searchParams);
  const params = new URLSearchParams();
  params.set('tab', filters.tab);
  params.set('range', filters.range);
  params.set('weekday', filters.weekday);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return `/disco/historico-aforo?${params.toString()}`;
}

function MetricBox({ label, value, description, icon: Icon }: { label: string; value: string; description?: string; icon: typeof UsersIcon }) {
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

function MovementDelta({ event }: { event: EventRow }) {
  const positive = event.delta > 0;
  const value = positive ? `+${event.delta}` : String(event.delta);
  return <span className={positive ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>{value}</span>;
}

export default async function CapacitySessionDetailPage({ params, searchParams }: PageProps) {
  await requireCapacityHistoryAdmin(`/disco/historico-aforo/${params.sessionId}`);

  const detail = await getClosedCapacitySessionDetail({ sessionId: params.sessionId });
  if (!detail) {
    notFound();
  }

  const weekday = String(new Date(detail.session.opened_at).getDay() || 7) as WeekdayFilter;
  const backHref = buildBackHref(searchParams);

  return (
    <div className="disco-ops-page disco-history-page space-y-5">
      <header className="rounded-2xl border border-slate-800/75 bg-slate-900/65 p-5 sm:p-6">
        <Link href={backHref} className="inline-flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-950/25 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800/60">
          <ArrowLeftIcon className="h-4 w-4" />
          Volver al historico
        </Link>
        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary-100">Detalle de sesion</p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{formatDate(detail.session.opened_at)}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {getWeekdayLabel(weekday)} · Apertura {formatTime(detail.session.opened_at)} · Cierre {formatTime(detail.session.closed_at)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/70 bg-slate-950/35 px-4 py-3 text-sm text-slate-300">
            <p className="font-semibold text-slate-100">Entradas registradas</p>
            <p className="mt-1 text-xs text-slate-500">No equivale necesariamente a clientes unicos.</p>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricBox label="Pico de sesion" value={integerFormatter.format(detail.session.peak_count)} description={`Hora pico: ${formatTime(detail.metrics.peak_time_at)}`} icon={ArrowTrendingUpIcon} />
        <MetricBox label="Aforo final" value={integerFormatter.format(detail.session.current_count)} icon={UsersIcon} />
        <MetricBox label="Entradas registradas" value={integerFormatter.format(detail.metrics.total_entries)} description="Movimientos de entrada acumulados." icon={UsersIcon} />
        <MetricBox label="Movimientos" value={integerFormatter.format(detail.metrics.event_count)} description={`Salidas: ${integerFormatter.format(detail.metrics.total_exits)}`} icon={QueueListIcon} />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricBox label="Apertura" value={formatDateTime(detail.session.opened_at)} icon={ClockIcon} />
        <MetricBox label="Cierre" value={formatDateTime(detail.session.closed_at)} icon={ClockIcon} />
        <MetricBox label="Duracion" value={formatDuration(detail.metrics.duration_minutes)} icon={ClockIcon} />
        <MetricBox label="Operadores" value={detail.session.opened_by ?? '-'} description={detail.session.closed_by ? `Cierre: ${detail.session.closed_by}` : 'Cierre sin operador registrado'} icon={UsersIcon} />
      </section>

      <SessionEvolutionChart data={detail.evolution} />

      <section className="overflow-hidden rounded-2xl border border-slate-800/75 bg-slate-900/65">
        <div className="border-b border-slate-800/70 px-4 py-4 sm:px-5">
          <h2 className="text-base font-semibold text-white">Movimientos de la sesion</h2>
          <p className="mt-1 text-sm text-slate-400">Aforo despues de cada movimiento registrado.</p>
        </div>

        {detail.events.length === 0 ? (
          <div className="p-6 text-sm text-slate-300">Esta sesion no tiene movimientos registrados.</div>
        ) : (
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[760px] text-left text-sm text-slate-200">
              <thead className="sticky top-0 z-10 bg-slate-950/95 text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-800/70">
                  <th className="px-4 py-3 font-semibold">Hora</th>
                  <th className="px-4 py-3 text-right font-semibold">Delta</th>
                  <th className="px-4 py-3 text-right font-semibold">Resultado</th>
                  <th className="px-4 py-3 font-semibold">Usuario</th>
                  <th className="px-4 py-3 font-semibold">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/20">
                {detail.events.map((event) => (
                  <tr key={event.id} className="transition hover:bg-primary-500/10">
                    <td className="px-4 py-3 tabular-nums text-slate-100">{formatDateTime(event.created_at)}</td>
                    <td className="px-4 py-3 text-right tabular-nums"><MovementDelta event={event} /></td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-white">{integerFormatter.format(event.resulting_count)}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-400">{event.actor_email ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-300">{event.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
