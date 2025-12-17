'use client';

import { useMemo } from 'react';
import { CreateTaskFromReservation } from '@/components/tasks/CreateTaskFromReservation';
import type { TodayGroupEvent } from './types';

const statusStyles: Record<string, string> = {
  confirmed: 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/40',
  draft: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40',
  completed: 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-500/40',
  cancelled: 'bg-slate-800/70 text-slate-200 ring-1 ring-slate-600/50',
  incident: 'bg-red-500/25 text-red-100 ring-1 ring-red-400/50',
  no_show: 'bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/50',
};

function formatTime(time: string | null) {
  if (!time) return '—';
  return time.slice(0, 5);
}

function getStatusBadge(status: string) {
  const normalized = status?.toLowerCase?.() ?? 'unknown';
  const className = statusStyles[normalized] ?? 'bg-slate-800/80 text-slate-100 ring-1 ring-slate-700/70';
  return { label: normalized.replace('_', ' ') || 'estado', className };
}

type Props = {
  reservations: TodayGroupEvent[];
};

export function KitchenReservations({ reservations }: Props) {
  const sortedReservations = useMemo(
    () =>
      [...reservations].sort((a, b) => {
        const timeA = a.entry_time ?? '';
        const timeB = b.entry_time ?? '';
        return timeA.localeCompare(timeB);
      }),
    [reservations]
  );

  return (
    <div className="space-y-3">
      {sortedReservations.map((reservation) => {
        const statusBadge = getStatusBadge(reservation.status);
        const showAllergens = Boolean(reservation.allergens_and_diets);
        const showExtras = Boolean(reservation.extras);
        const showSecondsAlert = reservation.second_course_type && reservation.seconds_confirmed === false;
        const totalPax = reservation.total_pax ?? (reservation.adults ?? 0) + (reservation.children ?? 0);

        return (
          <div
            key={reservation.id}
            className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 shadow-sm shadow-slate-950"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-col gap-1 text-slate-100 sm:flex-row sm:items-center sm:gap-3">
                  <span className="text-lg font-semibold text-primary-100">{formatTime(reservation.entry_time)}</span>
                  <span className="text-base font-semibold">{reservation.name}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-slate-200">
                  <span className="rounded-md border border-slate-800 bg-slate-900/70 px-2 py-1 font-semibold">
                    {reservation.adults ?? 0} adultos
                  </span>
                  <span className="rounded-md border border-slate-800 bg-slate-900/70 px-2 py-1 font-semibold">
                    {reservation.children ?? 0} niños
                  </span>
                  <span className="rounded-md border border-primary-700/60 bg-primary-900/30 px-2 py-1 font-semibold text-primary-100">
                    {totalPax} total
                  </span>
                </div>
                <div className="space-y-1 text-sm text-slate-200">
                  <p className="font-semibold text-slate-100">Menú / resumen</p>
                  <p className="whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-900/60 p-2 text-slate-100">
                    {reservation.menu_text || 'Sin menú definido.'}
                  </p>
                </div>

                {reservation.setup_notes && (
                  <div className="space-y-1 text-sm text-slate-200">
                    <p className="font-semibold text-slate-100">Notas de sala</p>
                    <p className="whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-900/60 p-2 text-slate-100">
                      {reservation.setup_notes}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {showAllergens && (
                    <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-100 ring-1 ring-amber-500/50">
                      Alergias
                    </span>
                  )}
                  {showSecondsAlert && (
                    <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-100 ring-1 ring-rose-500/50">
                      Segundos no confirmados
                    </span>
                  )}
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadge.className}`}
                  >
                    {statusBadge.label}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 text-sm text-slate-200 sm:w-64">
                {showAllergens && (
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-100">Alergias / dietas</p>
                    <p className="whitespace-pre-wrap rounded-md border border-amber-500/40 bg-amber-950/30 p-2 text-amber-50">
                      {reservation.allergens_and_diets}
                    </p>
                  </div>
                )}

                {showExtras && (
                  <div className="space-y-1">
                    <p className="font-semibold text-sky-100">Extras / notas cocina</p>
                    <p className="whitespace-pre-wrap rounded-md border border-sky-500/40 bg-sky-950/30 p-2 text-sky-50">
                      {reservation.extras}
                    </p>
                  </div>
                )}

                {(reservation.has_private_dining_room || reservation.has_private_party) && (
                  <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-primary-100">
                    {reservation.has_private_dining_room && (
                      <span className="rounded-md border border-primary-500/40 bg-primary-900/30 px-2 py-1">Sala privada</span>
                    )}
                    {reservation.has_private_party && (
                      <span className="rounded-md border border-primary-500/40 bg-primary-900/30 px-2 py-1">Fiesta privada</span>
                    )}
                  </div>
                )}

                <CreateTaskFromReservation reservation={reservation} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
