import { redirect } from 'next/navigation';
import { MaintenanceTasksBoard } from './MaintenanceTasksBoard';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { OperationalPage, OperationalPageHeader } from '@/components/operational/OperationalUI';

type Task = {
  id: string;
  area: string;
  title: string;
  description: string | null;
  status: string;
  priority: 'low' | 'normal' | 'high';
  routine_id?: string | null;
  window_start_date?: string | null;
  due_date?: string | null;
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
    <OperationalPage>
      <OperationalPageHeader
        title="Tareas"
        description="Organiza incidencias, tareas recurrentes y responsables para mantener el servicio en marcha."
      />
      <MaintenanceTasksBoard initialTasks={tasks} />
    </OperationalPage>
  );
}
