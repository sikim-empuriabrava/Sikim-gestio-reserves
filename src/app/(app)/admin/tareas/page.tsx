import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TaskControlCenter } from './TaskControlCenter';

export const dynamic = 'force-dynamic';

export default async function AdminTasksPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/admin/tareas')}`);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Centro de control de tareas</h1>
        <p className="text-slate-400">
          Visión rápida de Cocina y Mantenimiento con filtros por estado, fechas y acciones rápidas.
        </p>
      </div>

      <TaskControlCenter />
    </div>
  );
}
