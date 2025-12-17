import { redirect } from 'next/navigation';
import { MaintenanceTasksBoard } from './MaintenanceTasksBoard';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Task = {
  id: string;
  area: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'done';
  priority: 'low' | 'normal' | 'high';
  due_date: string | null;
  created_by_email?: string | null;
  created_at?: string;
  updated_at?: string;
};

export const dynamic = 'force-dynamic';

export default async function MantenimientoTareasPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/mantenimiento/tareas')}`);
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('area', 'maintenance')
    .order('created_at', { ascending: false });

  const tasks: Task[] = data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Tareas e incidencias</h1>
        <p className="text-slate-400">
          Organiza incidencias, tareas recurrentes y responsables para mantener el servicio en marcha.
        </p>
      </div>

      <MaintenanceTasksBoard initialTasks={tasks} />
    </div>
  );
}
