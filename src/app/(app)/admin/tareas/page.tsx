import { redirect } from 'next/navigation';
import { OperationalPageHeader } from '@/components/operational/OperationalUI';
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
    <>
      <OperationalPageHeader
        eyebrow="Admin"
        title="Centro de control de tareas"
        description="Visión rápida de Cocina y Mantenimiento con filtros por estado, fechas y acciones rápidas."
      />

      <TaskControlCenter />
    </>
  );
}
