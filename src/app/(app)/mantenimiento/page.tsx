import { redirect } from 'next/navigation';
import {
  ArchiveBoxIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import {
  OperationalEmptyState,
  OperationalMetricCard,
  OperationalPage,
  OperationalPageHeader,
  OperationalPanel,
  OperationalSectionHeader,
} from '@/components/operational/OperationalUI';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type MaintenanceTask = {
  id: string;
  status: string;
  due_date?: string | null;
};

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatLongDate(value: string) {
  const formatter = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return formatter.format(new Date(value));
}

export const dynamic = 'force-dynamic';

export default async function MantenimientoPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/mantenimiento')}`);
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const today = toISODate(new Date());
  const [{ data: notesData }, { data: tasksData }] = await Promise.all([
    supabaseAdmin
      .from('day_status')
      .select('event_date, notes_maintenance, mantenimiento_notes, day_notes')
      .eq('event_date', today)
      .maybeSingle(),
    supabaseAdmin
      .from('tasks')
      .select('id, status, due_date')
      .eq('area', 'maintenance'),
  ]);

  const notes = (notesData?.notes_maintenance ?? notesData?.mantenimiento_notes ?? notesData?.day_notes ?? '').trim();
  const tasks: MaintenanceTask[] = tasksData ?? [];
  const pendingTasks = tasks.filter((task) => task.status !== 'done').length;
  const tasksToday = tasks.filter((task) => task.due_date === today).length;

  return (
    <OperationalPage>
      <OperationalPageHeader title="Mantenimiento" description="Dashboard operativo" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OperationalMetricCard
          icon={ClipboardDocumentCheckIcon}
          label="Tareas pendientes"
          value={pendingTasks}
          description={pendingTasks === 0 ? 'Sin tareas pendientes' : 'Requieren seguimiento'}
        />
        <OperationalMetricCard
          icon={CalendarDaysIcon}
          label="Tareas hoy"
          value={tasksToday}
          description={tasksToday === 0 ? 'Sin tareas para hoy' : 'Programadas para el día'}
        />
        <OperationalMetricCard
          icon={ArchiveBoxIcon}
          label="Stock bajo"
          value={0}
          description="Todo en nivel óptimo"
        />
        <OperationalMetricCard
          icon={ClockIcon}
          label="Próximos vencimientos"
          value={0}
          description="Sin vencimientos próximos"
        />
      </div>

      <OperationalPanel className="p-5">
        <OperationalSectionHeader
          icon={ClipboardDocumentListIcon}
          title="Notas de hoy (Mantenimiento)"
          meta={
            <span className="inline-flex items-center gap-2 text-[#b9aea1]">
              <CalendarDaysIcon className="h-5 w-5" aria-hidden="true" />
              {formatLongDate(today)}
            </span>
          }
        />
        <div className="mt-5">
          {notes ? (
            <div className="min-h-[20rem] whitespace-pre-wrap rounded-2xl border border-[#3c342a]/70 bg-[#12110f]/55 p-4 text-sm leading-6 text-[#efe8dc] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
              {notes}
            </div>
          ) : (
            <OperationalEmptyState
              icon={ClipboardDocumentListIcon}
              title="Sin notas para hoy."
              description="Cuando el chef o el equipo añadan notas, las verás aquí."
            />
          )}
        </div>
      </OperationalPanel>
    </OperationalPage>
  );
}
