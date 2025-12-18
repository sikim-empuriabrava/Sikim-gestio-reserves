import { redirect } from 'next/navigation';
import { MaintenanceCalendarWeek } from './MaintenanceCalendarWeek';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MaintenanceCalendarPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/mantenimiento/calendario')}`);
  }

  return (
    <div className="space-y-6">
      <MaintenanceCalendarWeek />
    </div>
  );
}
