import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getAllowlistRoleForUserEmail, getDefaultModulePath, isAdmin } from '@/lib/auth/requireRole';
import {
  getClosedCapacitySessionDetail,
  listClosedCapacitySessionsWithMetrics,
  parseHistoryRange,
  type HistoryRange,
} from '@/lib/disco/capacityHistory';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: {
    range?: string;
    session?: string;
  };
};

const RANGE_OPTIONS: Array<{ value: HistoryRange; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: 'all', label: 'Todas' },
];

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value));
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-ES', { timeStyle: 'short' }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}

function buildRangeHref(range: HistoryRange) {
  const params = new URLSearchParams();
  params.set('range', range);
  return `/disco/historico-aforo?${params.toString()}`;
}

function buildSessionHref(range: HistoryRange, sessionId: string) {
  const params = new URLSearchParams();
  params.set('range', range);
  params.set('session', sessionId);
  return `/disco/historico-aforo?${params.toString()}`;
}

export default async function HistoricoAforoPage({ searchParams }: PageProps) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/disco/historico-aforo')}`);
  }

  const requesterEmail = user.email?.trim().toLowerCase();
  if (!requesterEmail) {
    redirect('/login?error=not_allowed');
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    redirect('/login?error=not_allowed');
  }

  if (!isAdmin(allowlistInfo.role)) {
    redirect(getDefaultModulePath(allowlistInfo.allowedUser));
  }

  const range = parseHistoryRange(searchParams?.range);
  const sessions = await listClosedCapacitySessionsWithMetrics({ range, limit: 50 });

  const selectedSessionId = searchParams?.session ?? sessions[0]?.session.id ?? null;
  const detail = selectedSessionId ? await getClosedCapacitySessionDetail({ sessionId: selectedSessionId }) : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white">Histórico aforo</h1>
        <p className="mt-1 text-sm text-slate-400">Resumen de sesiones cerradas y detalle de movimientos registrados.</p>
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Rango rápido</h2>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {RANGE_OPTIONS.map((option) => {
            const active = option.value === range;
            return (
              <Link
                key={option.value}
                href={buildRangeHref(option.value)}
                className={`rounded-lg border px-3 py-2 text-center text-sm font-semibold transition ${
                  active
                    ? 'border-primary-500/70 bg-primary-500/20 text-primary-100'
                    : 'border-slate-700 bg-slate-950/30 text-slate-200 hover:bg-slate-800/70'
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Sesiones cerradas</h2>
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
            Sin sesiones cerradas todavía.
          </div>
        ) : (
          <ul className="space-y-3">
            {sessions.map((item) => {
              const isSelected = detail?.session.id === item.session.id;

              return (
                <li key={item.session.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{formatDate(item.session.opened_at)}</p>
                      <p className="text-xs text-slate-400">
                        Apertura {formatTime(item.session.opened_at)} · Cierre {formatTime(item.session.closed_at)}
                      </p>
                    </div>
                    <Link
                      href={buildSessionHref(range, item.session.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        isSelected
                          ? 'border-primary-500/70 bg-primary-500/20 text-primary-100'
                          : 'border-slate-700 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {isSelected ? 'Detalle abierto' : 'Ver detalle'}
                    </Link>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Duración</dt>
                      <dd className="mt-1 font-semibold text-slate-100">{formatDuration(item.metrics.duration_minutes)}</dd>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Pico de sesión</dt>
                      <dd className="mt-1 font-semibold text-slate-100">{item.session.peak_count}</dd>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Aforo final</dt>
                      <dd className="mt-1 font-semibold text-slate-100">{item.session.current_count}</dd>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Eventos</dt>
                      <dd className="mt-1 font-semibold text-slate-100">{item.metrics.event_count}</dd>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Entradas registradas</dt>
                      <dd className="mt-1 font-semibold text-emerald-300">{item.metrics.total_entries}</dd>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Salidas registradas</dt>
                      <dd className="mt-1 font-semibold text-rose-300">{item.metrics.total_exits}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {detail ? (
        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-white">Detalle de sesión</h2>
            <p className="text-xs text-slate-400">Sesión abierta el {formatDateTime(detail.session.opened_at)}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <dt className="text-xs uppercase tracking-wide text-slate-400">Apertura</dt>
              <dd className="mt-1 font-semibold text-slate-100">{formatDateTime(detail.session.opened_at)}</dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <dt className="text-xs uppercase tracking-wide text-slate-400">Cierre</dt>
              <dd className="mt-1 font-semibold text-slate-100">{formatDateTime(detail.session.closed_at)}</dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <dt className="text-xs uppercase tracking-wide text-slate-400">Duración</dt>
              <dd className="mt-1 font-semibold text-slate-100">{formatDuration(detail.metrics.duration_minutes)}</dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <dt className="text-xs uppercase tracking-wide text-slate-400">Pico de sesión</dt>
              <dd className="mt-1 font-semibold text-slate-100">{detail.session.peak_count}</dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <dt className="text-xs uppercase tracking-wide text-slate-400">Aforo final</dt>
              <dd className="mt-1 font-semibold text-slate-100">{detail.session.current_count}</dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <dt className="text-xs uppercase tracking-wide text-slate-400">Eventos</dt>
              <dd className="mt-1 font-semibold text-slate-100">{detail.metrics.event_count}</dd>
            </div>
          </dl>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold text-slate-200">Movimientos de la sesión</h3>
            {detail.events.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Sin eventos para esta sesión.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {detail.events.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-200"
                  >
                    <p className="font-semibold text-slate-100">
                      {event.delta > 0 ? `+${event.delta}` : event.delta} → {event.resulting_count}
                    </p>
                    <p className="text-xs text-slate-400">{formatDateTime(event.created_at)}</p>
                    <p className="text-xs text-slate-400">{event.actor_email ?? 'Usuario no identificado'}</p>
                    <p className="text-xs text-slate-300">{event.note || 'Sin nota'}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
