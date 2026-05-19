import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  cleanText,
  DATE_REGEX,
  DONENESS_LABELS,
  DONENESS_ORDER,
  formatDateTime,
  formatLongDate,
  formatShortDate,
  formatTime,
  getRangeValidation,
  getReportData,
  groupByDate,
  MAX_RANGE_DAYS,
  roomName,
  todayISO,
  type DonenessRow,
  type OfferingRow,
  type ReportData,
  type ReservationRow,
  type RoomAllocationRow,
  type SelectionRow,
} from '@/lib/server/reservation-reports/reportData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type SearchParams = {
  desde?: string;
  hasta?: string;
};
function ReportChromeStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          body:has(.reservation-report-page) {
            background: #f4efe6;
          }

          .aforo-standalone-shell:has(.reservation-report-page) {
            max-width: none;
            gap: 0;
            padding: 0;
            background: #f4efe6;
          }

          .aforo-standalone-shell:has(.reservation-report-page) > aside {
            width: 18.5rem;
            border-right: 1px solid rgba(120, 103, 82, 0.22);
            background: linear-gradient(180deg, #1d1b18, #141310);
          }

          .aforo-standalone-shell:has(.reservation-report-page) > aside > div {
            top: 0;
            min-height: 100dvh;
            padding: 1rem;
          }

          .aforo-standalone-shell:has(.reservation-report-page) > div {
            min-width: 0;
            gap: 0;
          }

          .aforo-standalone-shell:has(.reservation-report-page) > div > header,
          .aforo-standalone-shell:has(.reservation-report-page) footer {
            display: none;
          }

          .reservation-report-paper {
            background:
              linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.88)),
              radial-gradient(circle at 8% 0%, rgba(178, 119, 50, 0.16), transparent 22rem);
          }

          @media print {
            @page {
              size: A4 portrait;
              margin: 12mm;
            }

            html,
            body {
              background: #ffffff !important;
              color: #1f1a14 !important;
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }

            .aforo-standalone-shell,
            .reservation-report-page {
              display: block !important;
              min-height: auto !important;
              background: #ffffff !important;
              padding: 0 !important;
            }

            .aforo-standalone-shell > aside,
            .aforo-standalone-shell > div > header,
            .aforo-standalone-shell footer,
            .report-screen-controls,
            .report-back-link {
              display: none !important;
            }

            .aforo-standalone-shell > div,
            .reservation-report-page > main,
            .reservation-report-paper {
              display: block !important;
              width: 100% !important;
              max-width: none !important;
              padding: 8mm !important;
              margin: 0 !important;
              border: 1px solid #d8c6ae !important;
              border-radius: 8px !important;
              box-shadow: none !important;
              background: #fffaf2 !important;
              color: #1f1a14 !important;
            }

            .reservation-report-paper,
            .reservation-report-paper * {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }

            .reservation-report-paper > header {
              border-bottom: 2px solid #d7b98f !important;
              padding-bottom: 6mm !important;
              margin-bottom: 7mm !important;
            }

            .reservation-report-paper > header h2 {
              font-size: 25pt !important;
              line-height: 1.04 !important;
            }

            .reservation-report-paper > header .report-summary-card {
              border: 1px solid #6e563b !important;
              box-shadow: none !important;
            }

            .reservation-day-block,
            .reservation-print-card,
            .reservation-offering-block {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .reservation-day-block {
              margin-top: 7mm !important;
              padding: 5mm !important;
              border: 1px solid #d8c6ae !important;
              border-radius: 7px !important;
              background: #ffffff !important;
            }

            .reservation-day-block:first-child {
              margin-top: 0 !important;
            }

            .reservation-day-heading {
              border: 1px solid #d4b98f !important;
              border-radius: 6px !important;
              background: #f8edda !important;
              padding: 4mm !important;
            }

            .reservation-day-heading h2 {
              font-size: 17pt !important;
              line-height: 1.12 !important;
            }

            .reservation-print-card {
              overflow: hidden !important;
              border: 1px solid #cdb89d !important;
              border-radius: 7px !important;
              background: #ffffff !important;
              margin-top: 4mm !important;
            }

            .reservation-print-card > div:first-child {
              border-bottom: 1px solid #dcc9ae !important;
              background: #fbf4e8 !important;
              padding: 4mm !important;
            }

            .reservation-print-card > div:last-child {
              padding: 4mm !important;
            }

            .reservation-print-card h3 {
              font-size: 16pt !important;
              line-height: 1.12 !important;
            }

            .reservation-field-pill,
            .reservation-text-section,
            .reservation-offering-block,
            .reservation-selection-item {
              border: 1px solid #decab0 !important;
              box-shadow: none !important;
              background: #fffaf2 !important;
            }

            .reservation-status-badge,
            .reservation-count-badge {
              border: 1px solid #d0ad7d !important;
              background: #ffffff !important;
            }

            .reservation-report-paper * {
              box-shadow: none !important;
            }
          }
        `,
      }}
    />
  );
}

function FieldPill({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;

  return (
    <div className="reservation-field-pill rounded-xl border border-[#e4d4bf] bg-[#fffaf2] px-3 py-2">
      <dt className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-[#98764c]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[#2e241a]">{value}</dd>
    </div>
  );
}

function TextSection({ title, value }: { title: string; value: string | null | undefined }) {
  const text = cleanText(value);
  if (!text) return null;

  return (
    <div className="reservation-text-section rounded-xl border border-[#eadcca] bg-white/72 p-3">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#9a7447]">{title}</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#3a3026]">{text}</p>
    </div>
  );
}

function SelectionList({
  offering,
  selections,
  donenessBySelection,
}: {
  offering: OfferingRow;
  selections: SelectionRow[];
  donenessBySelection: Map<string, DonenessRow[]>;
}) {
  return (
    <div className="reservation-offering-block rounded-xl border border-[#e2d1bd] bg-[#fffaf2] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-[#2e241a]">{offering.display_name_snapshot}</p>
        <p className="text-xs font-semibold text-[#8b6842]">{offering.assigned_pax} pax asignados</p>
      </div>
      {cleanText(offering.notes) ? (
        <p className="mt-1 text-xs leading-relaxed text-[#6f6258]">{offering.notes}</p>
      ) : null}

      {selections.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {selections.map((selection) => {
            const points = (donenessBySelection.get(selection.id) ?? [])
              .slice()
              .sort((a, b) => DONENESS_ORDER.indexOf(a.point) - DONENESS_ORDER.indexOf(b.point));
            const pointText = points
              .filter((point) => point.quantity > 0)
              .map((point) => `${DONENESS_LABELS[point.point] ?? point.point}: ${point.quantity}`)
              .join(' / ');

            return (
              <li key={selection.id} className="reservation-selection-item rounded-lg border border-[#eadcca] bg-white/78 px-3 py-2">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-semibold text-[#30261d]">{selection.quantity}x {selection.display_name_snapshot}</span>
                  <span className="text-xs font-medium text-[#8b6842]">
                    {selection.selection_kind === 'kids_menu'
                      ? 'Infantil'
                      : selection.selection_kind === 'custom_menu'
                        ? 'Personalizado'
                        : 'Segundo'}
                  </span>
                </div>
                {cleanText(selection.description_snapshot) ? (
                  <p className="mt-1 text-xs leading-relaxed text-[#6f6258]">{selection.description_snapshot}</p>
                ) : null}
                {pointText ? <p className="mt-1 text-xs font-semibold text-[#6c4524]">Puntos: {pointText}</p> : null}
                {cleanText(selection.notes) ? (
                  <p className="mt-1 text-xs leading-relaxed text-[#6f6258]">Notas: {selection.notes}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ReservationCard({
  reservation,
  room,
  offerings,
  selectionsByOffering,
  donenessBySelection,
}: {
  reservation: ReservationRow;
  room: RoomAllocationRow | undefined;
  offerings: OfferingRow[];
  selectionsByOffering: Map<string, SelectionRow[]>;
  donenessBySelection: Map<string, DonenessRow[]>;
}) {
  const roomLabel = cleanText(roomName(room?.room ?? null));
  const roomNotes = cleanText(room?.notes);
  const peopleParts = [
    reservation.adults ? `${reservation.adults} adultos` : null,
    reservation.children ? `${reservation.children} niños` : null,
  ].filter(Boolean);
  const flags = [
    reservation.event_mode === 'private_party_only' ? 'Solo fiesta privada' : null,
    reservation.has_private_dining_room ? 'Comedor privado' : null,
    reservation.has_private_party ? 'Fiesta privada' : null,
  ].filter(Boolean);
  const statusLabel = reservation.status === 'completed' ? 'Completada' : null;

  return (
    <article className="reservation-print-card overflow-hidden rounded-2xl border border-[#dfcdb7] bg-white shadow-[0_16px_48px_-36px_rgba(64,40,18,0.72)]">
      <div className="border-b border-[#eadcca] bg-[#fbf4e8] px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-[#d9bd96] bg-white px-2.5 py-1 text-xs font-bold text-[#795226]">
                <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {formatTime(reservation.entry_time)}
              </p>
              {statusLabel ? (
                <p className="reservation-status-badge inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  {statusLabel}
                </p>
              ) : null}
            </div>
            <h3 className="mt-2 break-words text-xl font-bold leading-tight text-[#251d16]">{reservation.name}</h3>
          </div>
          <div className="rounded-xl bg-[#2d2419] px-4 py-3 text-right text-[#fff1d8]">
            <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-[#d6b57f]">Comensales</p>
            <p className="mt-1 text-2xl font-bold leading-none">{reservation.total_pax ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <FieldPill label="Sala" value={roomLabel ?? 'Sin sala asignada'} />
          <FieldPill label="Mesa / zona" value={roomNotes} />
          <FieldPill label="Personas" value={peopleParts.length > 0 ? peopleParts.join(' / ') : `${reservation.total_pax ?? 0} pax`} />
          <FieldPill label="Tipo" value={flags.length > 0 ? flags.join(' / ') : null} />
        </dl>

        {reservation.event_mode === 'private_party_only' ? (
          <section className="space-y-2">
            <h4 className="text-sm font-bold uppercase tracking-[0.12em] text-[#7f592d]">Modalidad</h4>
            <p className="rounded-xl border border-[#eadcca] bg-[#fffaf2] px-3 py-2 text-sm font-semibold text-[#5b3920]">
              Solo fiesta privada
            </p>
          </section>
        ) : offerings.length > 0 ? (
          <section className="space-y-2">
            <h4 className="text-sm font-bold uppercase tracking-[0.12em] text-[#7f592d]">Oferta y selecciones</h4>
            {offerings.map((offering) => (
              <SelectionList
                key={offering.id}
                offering={offering}
                selections={selectionsByOffering.get(offering.id) ?? []}
                donenessBySelection={donenessBySelection}
              />
            ))}
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TextSection title="Menú / carta" value={reservation.menu_text} />
            <TextSection title="Segundo plato" value={reservation.second_course_type} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {reservation.event_mode !== 'private_party_only' ? (
            <>
              <TextSection title="Intolerancias / alergias" value={reservation.allergens_and_diets} />
              <TextSection title="Notas cocina" value={reservation.extras} />
            </>
          ) : null}
          <TextSection title="Notas sala / montaje" value={reservation.setup_notes} />
          <TextSection title="Notas de servicio" value={reservation.service_outcome_notes} />
          <TextSection title="Facturación" value={reservation.invoice_data} />
          {reservation.service_outcome && reservation.service_outcome !== 'normal' ? (
            <TextSection title="Resultado servicio" value={reservation.service_outcome} />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <section className="rounded-2xl border border-dashed border-[#d4bea1] bg-white/64 p-8 text-center">
      <DocumentTextIcon className="mx-auto h-10 w-10 text-[#ad8758]" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-bold text-[#2d2419]">No hay reservas confirmadas o completadas en este rango</h2>
      <p className="mt-1 text-sm text-[#7b6c5f]">Ajusta las fechas o revisa el estado de las reservas para generar contenido imprimible.</p>
    </section>
  );
}

export default async function ReservationReportsPage({ searchParams }: { searchParams?: SearchParams }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/reservas/informes')}`);
  }

  noStore();

  const today = todayISO();
  const from = searchParams?.desde && DATE_REGEX.test(searchParams.desde) ? searchParams.desde : today;
  const to = searchParams?.hasta && DATE_REGEX.test(searchParams.hasta) ? searchParams.hasta : from;
  const validation = getRangeValidation(from, to);
  const generatedAt = new Date();

  let reportData: ReportData | null = null;
  let loadError: string | null = null;

  if (validation.valid) {
    try {
      reportData = await getReportData(from, to);
    } catch (error) {
      loadError = error instanceof Error ? error.message : 'No se pudo cargar el informe.';
    }
  }

  const reservations = reportData?.reservations ?? [];
  const reservationsByDate = groupByDate(reservations);
  const totalPax = reservations.reduce((sum, reservation) => sum + (reservation.total_pax ?? 0), 0);
  const rangeLabel = `${formatShortDate(from)} - ${formatShortDate(to)}`;
  const pdfHref = `/api/reservas/informes/pdf?${new URLSearchParams({ desde: from, hasta: to }).toString()}`;
  const reportActionsDisabled = !validation.valid || Boolean(loadError) || reservations.length === 0;

  return (
    <div className="reservation-report-page min-h-screen bg-[#f4efe6] px-3 py-5 text-[#2d2419] sm:px-4 sm:py-6 md:px-8">
      <ReportChromeStyles />

      <main className="mx-auto max-w-6xl space-y-5">
        <div className="report-back-link">
          <Link href="/reservas?view=week" className="inline-flex items-center gap-2 text-sm font-semibold text-[#7e5629] hover:text-[#4d341c]">
            <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
            Volver a reservas
          </Link>
        </div>

        <section className="report-screen-controls rounded-2xl border border-[#d8c6ae] bg-white/82 p-4 shadow-[0_18px_70px_-52px_rgba(80,49,20,0.55)] backdrop-blur">
          <form className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9a7447]">
                <SparklesIcon className="h-4 w-4" aria-hidden="true" />
                Informes
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[#2d2419]">Informe completo de reservas</h1>
              <p className="mt-1 text-sm text-[#7b6c5f]">Reservas confirmadas y completadas. Máximo {MAX_RANGE_DAYS} días por informe.</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="space-y-1 text-sm font-semibold text-[#4a3828]">
                <span>Desde</span>
                <input
                  type="date"
                  name="desde"
                  defaultValue={from}
                  className="w-full rounded-xl border border-[#d5bea0] bg-[#fffaf2] px-3 py-2 text-sm text-[#2d2419] outline-none focus:border-[#9b6a34] focus:ring-2 focus:ring-[#d9b170]/35 sm:w-40"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-[#4a3828]">
                <span>Hasta</span>
                <input
                  type="date"
                  name="hasta"
                  defaultValue={to}
                  className="w-full rounded-xl border border-[#d5bea0] bg-[#fffaf2] px-3 py-2 text-sm text-[#2d2419] outline-none focus:border-[#9b6a34] focus:ring-2 focus:ring-[#d9b170]/35 sm:w-40"
                />
              </label>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8a5b2b] px-4 py-2.5 text-sm font-bold text-white shadow-[0_18px_45px_-34px_rgba(95,62,26,0.85)] transition hover:bg-[#70451d] sm:w-auto"
              >
                <CalendarDaysIcon className="h-4 w-4" aria-hidden="true" />
                Generar informe
              </button>
              {reportActionsDisabled ? (
                <span
                  aria-disabled="true"
                  className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#2d2419] px-4 py-2.5 text-sm font-bold text-[#fff1d8] opacity-45 shadow-[0_18px_45px_-34px_rgba(95,62,26,0.85)] sm:w-auto"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
                  Descargar PDF
                </span>
              ) : (
                <a
                  href={pdfHref}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2d2419] px-4 py-2.5 text-sm font-bold text-[#fff1d8] shadow-[0_18px_45px_-34px_rgba(95,62,26,0.85)] transition hover:bg-[#3a2b1b] sm:w-auto"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
                  Descargar PDF
                </a>
              )}
            </div>
          </form>
        </section>

        {!validation.valid ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            <ExclamationTriangleIcon className="mr-2 inline h-5 w-5 align-text-bottom" aria-hidden="true" />
            {validation.message}
          </div>
        ) : null}

        {loadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
            <ExclamationTriangleIcon className="mr-2 inline h-5 w-5 align-text-bottom" aria-hidden="true" />
            {loadError}
          </div>
        ) : null}

        <article className="reservation-report-paper overflow-hidden rounded-[1.35rem] border border-[#d8c6ae] p-4 shadow-[0_30px_110px_-68px_rgba(80,49,20,0.62)] sm:p-5 md:p-8">
          <header className="border-b border-[#dfcdb7] pb-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9a7447]">Sikim Empuriabrava</p>
                <h2 className="mt-2 text-3xl font-bold tracking-normal text-[#221911] sm:text-4xl">Informe de reservas</h2>
                <p className="mt-2 text-base text-[#746457]">Rango seleccionado: <strong>{rangeLabel}</strong></p>
                <p className="mt-1 text-sm text-[#8a7b70]">Generado el {formatDateTime(generatedAt)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:min-w-72">
                <div className="report-summary-card rounded-2xl bg-[#2d2419] p-4 text-[#fff1d8]">
                  <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-[#d6b57f]">Reservas</p>
                  <p className="mt-2 text-3xl font-bold leading-none">{reservations.length}</p>
                </div>
                <div className="report-summary-card rounded-2xl bg-[#8a5b2b] p-4 text-white">
                  <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-[#ffe2b6]">Comensales</p>
                  <p className="mt-2 text-3xl font-bold leading-none">{totalPax}</p>
                </div>
              </div>
            </div>
          </header>

          <div className="mt-6 space-y-7">
            {validation.valid && !loadError && reservations.length === 0 ? <EmptyState /> : null}

            {Array.from(reservationsByDate.entries()).map(([date, dayReservations]) => {
              const dayPax = dayReservations.reduce((sum, reservation) => sum + (reservation.total_pax ?? 0), 0);
              return (
                <section key={date} className="reservation-day-block space-y-4">
                  <div className="reservation-day-heading flex flex-col gap-3 rounded-2xl border border-[#dfcdb7] bg-[#f9efe0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-[#2d2419]">{formatLongDate(date)}</h2>
                      <p className="mt-1 text-sm text-[#7b6c5f]">Reservas confirmadas y completadas ordenadas por hora</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="reservation-count-badge inline-flex items-center gap-1.5 rounded-full border border-[#d8c09d] bg-white px-3 py-1.5 text-sm font-bold text-[#6b4925]">
                        <DocumentTextIcon className="h-4 w-4" aria-hidden="true" />
                        {dayReservations.length} {dayReservations.length === 1 ? 'reserva' : 'reservas'}
                      </span>
                      <span className="reservation-count-badge inline-flex items-center gap-1.5 rounded-full border border-[#d8c09d] bg-white px-3 py-1.5 text-sm font-bold text-[#6b4925]">
                        <UsersIcon className="h-4 w-4" aria-hidden="true" />
                        {dayPax} pax
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {dayReservations.map((reservation) => (
                      <ReservationCard
                        key={reservation.id}
                        reservation={reservation}
                        room={reportData?.roomsByReservation.get(reservation.id)}
                        offerings={reportData?.offeringsByReservation.get(reservation.id) ?? []}
                        selectionsByOffering={reportData?.selectionsByOffering ?? new Map()}
                        donenessBySelection={reportData?.donenessBySelection ?? new Map()}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </article>
      </main>
    </div>
  );
}
