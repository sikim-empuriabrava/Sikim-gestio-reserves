import { redirect } from 'next/navigation';
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
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Rutinas semanales</h1>
        <p className="text-slate-400">
          Configura plantillas para generar tareas recurrentes de cocina y mantenimiento y lanza las de una semana
          concreta evitando duplicados.
        </p>
      </div>

      <WeeklyRoutinesManager />
    </div>
  );
}
