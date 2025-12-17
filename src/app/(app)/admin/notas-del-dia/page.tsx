import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DayNotesEditor } from './DayNotesEditor';

export const dynamic = 'force-dynamic';

export default async function AdminDayNotesPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/admin/notas-del-dia')}`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Notas del día</h1>
        <p className="text-slate-400">
          Define las notas diarias para Cocina y Mantenimiento. Usa el selector de fecha para revisar o actualizar un día
          concreto.
        </p>
      </div>
      <DayNotesEditor />
    </div>
  );
}
