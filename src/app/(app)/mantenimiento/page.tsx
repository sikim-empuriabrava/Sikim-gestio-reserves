import { redirect } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatLongDate(value: string) {
  const formatter = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return formatter.format(new Date(value));
}

export const dynamic = 'force-dynamic';

export default async function MantenimientoPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/mantenimiento')}`);
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const today = toISODate(new Date());
  const { data } = await supabaseAdmin
    .from('day_status')
    .select('event_date, notes_maintenance, mantenimiento_notes, day_notes')
    .eq('event_date', today)
    .maybeSingle();

  const notes = (data?.notes_maintenance ?? data?.mantenimiento_notes ?? data?.day_notes ?? '').trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mantenimiento</h1>
        <p className="text-slate-400">Dashboard operativo</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Notas de hoy (Mantenimiento)</h2>
          <p className="text-sm text-slate-400">{formatLongDate(today)}</p>
        </div>
        <p className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-100">
          {notes || 'Sin notas para hoy.'}
        </p>
      </div>
    </div>
  );
}
