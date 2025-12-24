import { redirect } from 'next/navigation';
import { MaintenanceRoutineWeekBoard, type RoutineTask } from './MaintenanceRoutineWeekBoard';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type PageSearchParams = {
  week_start?: string;
};

export const dynamic = 'force-dynamic';

function toUtcMonday(value: Date) {
  const day = value.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - diff);
  return monday;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function resolveWeekStart(searchParams: PageSearchParams) {
  if (searchParams.week_start) {
    const parsed = new Date(`${searchParams.week_start}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateOnly(toUtcMonday(parsed));
    }
  }

  return formatDateOnly(toUtcMonday(new Date()));
}

export default async function MantenimientoRutinasPage({ searchParams }: { searchParams: PageSearchParams }) {
  const weekStart = resolveWeekStart(searchParams);

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/mantenimiento/rutinas')}`);
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('area', 'maintenance')
    .not('routine_id', 'is', null)
    .eq('routine_week_start', weekStart)
    .order('due_date', { ascending: true })
    .order('priority', { ascending: false });

  const tasks: RoutineTask[] = data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Plan semanal</h1>
        <p className="text-slate-400">
          Genera las tareas de mantenimiento a partir de las rutinas y haz seguimiento diario por ventana.
        </p>
      </div>

      <MaintenanceRoutineWeekBoard initialTasks={tasks} weekStart={weekStart} />
    </div>
  );
}
