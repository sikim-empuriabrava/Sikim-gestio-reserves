import Link from 'next/link';
import { DayNotesPanel } from './DayNotesPanel';
import { ReservationOutcomeCard } from './ReservationOutcomeCard';
import { createSupabaseServerClient } from '@/lib/supabaseClient';

type ReservasDiaDetallePageProps = {
  searchParams?: { date?: string };
};

type DayStatusRow = {
  event_date: string;
  validated?: boolean | null;
  is_validated?: boolean | null;
  needs_revalidation?: boolean | null;
  notes_general?: string | null;
  notes_kitchen?: string | null;
  notes_maintenance?: string | null;
  last_validated_at?: string | null;
  last_validated_by?: string | null;
};

type GroupEventDailyDetail = {
  event_date: string;
  entry_time: string | null;
  group_event_id: string;
  group_name: string;
  status: string;
  total_pax: number | null;
  room_name: string | null;
  has_private_dining_room: boolean | null;
  has_private_party: boolean | null;
  service_outcome?: string | null;
  service_outcome_notes?: string | null;
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function formatDateToDisplay(dateString: string) {
  const formatter = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return formatter.format(new Date(dateString));
}

function getWeekStart(dateString: string) {
  const date = new Date(dateString);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day); // Monday as start
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export default async function ReservasDiaDetallePage({ searchParams }: ReservasDiaDetallePageProps) {
  const today = new Date().toISOString().slice(0, 10);
  const selectedDate =
    searchParams?.date && DATE_REGEX.test(searchParams.date) ? searchParams.date : today;
  const weekStart = getWeekStart(selectedDate);

  const supabase = createSupabaseServerClient();

  const [{ data: dayStatusData, error: dayStatusError }, { data: eventsData, error: eventsError }] =
    await Promise.all([
      supabase.from('v_day_status').select('*').eq('event_date', selectedDate).maybeSingle(),
      supabase
        .from('v_group_events_daily_detail')
        .select('*')
        .eq('event_date', selectedDate)
        .order('entry_time', { ascending: true }),
    ]);

  if (dayStatusError || eventsError) {
    return (
      <div className="p-6 space-y-4">
        <Link
          href={`/reservas-dia?weekStart=${weekStart}`}
          className="inline-flex text-sm text-emerald-300 hover:underline"
        >
          ← Volver a la vista semanal
        </Link>
        <div className="rounded-xl border border-red-900/60 bg-red-950/70 p-4 text-sm text-red-100">
          <p className="font-semibold">No se pudo cargar la información de Supabase.</p>
          <p className="text-red-200">{dayStatusError?.message || eventsError?.message}</p>
        </div>
      </div>
    );
  }

  const dayStatus: DayStatusRow =
    dayStatusData ?? {
      event_date: selectedDate,
      validated: false,
      is_validated: false,
      needs_revalidation: false,
      notes_general: '',
      notes_kitchen: '',
      notes_maintenance: '',
    };

  const reservations: GroupEventDailyDetail[] = eventsData ?? [];

  const badgeColor = dayStatus.validated || dayStatus.is_validated
    ? dayStatus.needs_revalidation
      ? 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/50'
      : 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/50'
    : 'bg-slate-700/60 text-slate-200 ring-1 ring-slate-500/40';

  const badgeLabel = dayStatus.validated || dayStatus.is_validated
    ? dayStatus.needs_revalidation
      ? 'Cambios desde validación'
      : 'Validado'
    : 'No validado';

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Detalle del día</h1>
          <p className="text-slate-400">{formatDateToDisplay(selectedDate)}</p>
          <Link
            href={`/reservas-dia?weekStart=${weekStart}`}
            className="text-sm font-medium text-emerald-300 hover:underline"
          >
            ← Volver a la vista semanal
          </Link>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeColor}`}>
          {badgeLabel}
        </span>
      </div>

      <DayNotesPanel
        eventDate={selectedDate}
        initialNotesGeneral={dayStatus.notes_general ?? ''}
        initialNotesKitchen={dayStatus.notes_kitchen ?? ''}
        initialNotesMaintenance={dayStatus.notes_maintenance ?? ''}
        initialValidated={Boolean(dayStatus.validated ?? dayStatus.is_validated)}
        initialNeedsRevalidation={Boolean(dayStatus.needs_revalidation)}
        initialValidatedBy={dayStatus.last_validated_by}
        initialValidatedAt={dayStatus.last_validated_at}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Reservas del día</h2>
        {reservations.length === 0 ? (
          <p className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200">
            No hay grupos para esta fecha.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {reservations.map((reservation) => (
              <ReservationOutcomeCard
                key={reservation.group_event_id}
                groupEventId={reservation.group_event_id}
                groupName={reservation.group_name}
                entryTime={reservation.entry_time}
                totalPax={reservation.total_pax}
                roomName={reservation.room_name}
                status={reservation.status}
                hasPrivateDiningRoom={reservation.has_private_dining_room}
                hasPrivateParty={reservation.has_private_party}
                serviceOutcome={reservation.service_outcome}
                serviceOutcomeNotes={reservation.service_outcome_notes}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
