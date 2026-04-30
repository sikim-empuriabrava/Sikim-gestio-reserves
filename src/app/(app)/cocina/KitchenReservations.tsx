'use client';

import { useMemo } from 'react';
import { ClockIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { CreateTaskFromReservation } from '@/components/tasks/CreateTaskFromReservation';
import { OperationalPill } from '@/components/operational/OperationalUI';
import type { TodayGroupEvent } from './types';

const statusStyles: Record<string, string> = {
  confirmed: 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/40',
  draft: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40',
  completed: 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/35',
  cancelled: 'bg-[#25221d]/80 text-[#d8cfc2] ring-1 ring-[#5b5146]/70',
  incident: 'bg-red-500/25 text-red-100 ring-1 ring-red-400/50',
  no_show: 'bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/50',
};

function formatTime(time: string | null) {
  if (!time) return '-';
  return time.slice(0, 5);
}

function getStatusBadge(status: string) {
  const normalized = status?.toLowerCase?.() ?? 'unknown';
  const className = statusStyles[normalized] ?? 'bg-[#25221d]/80 text-[#d8cfc2] ring-1 ring-[#5b5146]/70';
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
    [reservations],
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
            className="rounded-2xl border border-[#4a3f32]/70 bg-[#171512]/82 p-4 shadow-[0_18px_55px_-42px_rgba(0,0,0,0.96),inset_0_1px_0_rgba(255,255,255,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-[#8b6a43]/70 hover:bg-[#1f1c18]"
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-col gap-2 text-[#f6f0e8] sm:flex-row sm:items-center sm:gap-3">
                  <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#6f5434]/60 bg-[#3a2a1b]/55 px-3 py-1.5 text-sm font-semibold text-[#f1c98f] tabular-nums">
                    <ClockIcon className="h-4 w-4" aria-hidden="true" />
                    {formatTime(reservation.entry_time)}
                  </span>
                  <span className="text-lg font-semibold leading-tight">{reservation.name}</span>
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                  <OperationalPill>{reservation.adults ?? 0} adultos</OperationalPill>
                  <OperationalPill>{reservation.children ?? 0} niños</OperationalPill>
                  <OperationalPill tone="accent">
                    <UserGroupIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    {totalPax} total
                  </OperationalPill>
                </div>

                <div className="space-y-1.5 text-sm text-[#d8cfc2]">
                  <p className="font-semibold text-[#f6f0e8]">Menú / resumen</p>
                  <p className="whitespace-pre-wrap rounded-xl border border-[#3c342a]/70 bg-[#12110f]/60 p-3 leading-6 text-[#efe8dc]">
                    {reservation.menu_text || 'Sin menú definido.'}
                  </p>
                </div>

                {reservation.setup_notes ? (
                  <div className="space-y-1.5 text-sm text-[#d8cfc2]">
                    <p className="font-semibold text-[#f6f0e8]">Notas de sala</p>
                    <p className="whitespace-pre-wrap rounded-xl border border-[#3c342a]/70 bg-[#12110f]/60 p-3 leading-6 text-[#efe8dc]">
                      {reservation.setup_notes}
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {showAllergens ? (
                    <span className="inline-flex h-7 items-center whitespace-nowrap rounded-full border border-amber-500/40 bg-amber-500/15 px-3 text-xs font-semibold uppercase tracking-wide text-amber-100">
                      Alergias
                    </span>
                  ) : null}
                  {showSecondsAlert ? (
                    <span className="inline-flex h-7 items-center whitespace-nowrap rounded-full border border-rose-500/40 bg-rose-500/15 px-3 text-xs font-semibold uppercase tracking-wide text-rose-100">
                      Segundos no confirmados
                    </span>
                  ) : null}
                  <span
                    className={`inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-xs font-semibold uppercase tracking-wide ${statusBadge.className}`}
                  >
                    {statusBadge.label}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 text-sm text-[#d8cfc2] xl:w-72">
                {showAllergens ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-100">Alergias / dietas</p>
                    <p className="whitespace-pre-wrap rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 leading-6 text-amber-50">
                      {reservation.allergens_and_diets}
                    </p>
                  </div>
                ) : null}

                {showExtras ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-[#f1c98f]">Extras / notas cocina</p>
                    <p className="whitespace-pre-wrap rounded-xl border border-[#8b6a43]/40 bg-[#7d5932]/15 p-3 leading-6 text-[#f6f0e8]">
                      {reservation.extras}
                    </p>
                  </div>
                ) : null}

                {reservation.has_private_dining_room || reservation.has_private_party ? (
                  <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-[#f1c98f]">
                    {reservation.has_private_dining_room ? (
                      <span className="rounded-full border border-[#b77b3e]/40 bg-[#7d5932]/20 px-3 py-1">
                        Sala privada
                      </span>
                    ) : null}
                    {reservation.has_private_party ? (
                      <span className="rounded-full border border-[#b77b3e]/40 bg-[#7d5932]/20 px-3 py-1">
                        Fiesta privada
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <CreateTaskFromReservation reservation={reservation} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
