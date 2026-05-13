import { redirect } from 'next/navigation';
import { OperationalPageHeader } from '@/components/operational/OperationalUI';
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
    <>
      <OperationalPageHeader
        eyebrow="Admin"
        title="Notas del día"
        description="Define las notas diarias para Cocina y Mantenimiento. Usa el selector de fecha para revisar o actualizar un día concreto."
      />
      <DayNotesEditor />
    </>
  );
}
