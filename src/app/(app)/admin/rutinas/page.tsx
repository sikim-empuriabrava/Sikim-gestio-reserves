import { redirect } from 'next/navigation';
import { OperationalPageHeader } from '@/components/operational/OperationalUI';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { WeeklyRoutinesManager } from './WeeklyRoutinesManager';

export const dynamic = 'force-dynamic';

export default async function AdminRoutinesPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/admin/rutinas')}`);
  }

  return (
    <>
      <OperationalPageHeader
        eyebrow="Admin"
        title="Rutinas semanales"
        description="Configura plantillas para generar tareas recurrentes de cocina y mantenimiento y lanza las de una semana concreta evitando duplicados."
      />

      <WeeklyRoutinesManager />
    </>
  );
}
