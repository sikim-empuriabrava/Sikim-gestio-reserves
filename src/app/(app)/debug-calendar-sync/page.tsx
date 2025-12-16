import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { SyncNowButton } from './SyncNowButton';

type CalendarSyncRow = {
  group_event_id: string;
  event_date: string;
  entry_time: string | null;
  group_name: string;
  total_pax: number | null;
  status: string;
  calendar_event_id: string | null;
  desired_calendar_action: 'create' | 'update' | 'delete' | 'noop';
  needs_calendar_sync: boolean;
};

export default async function DebugCalendarSyncPage() {
  if (process.env.ENABLE_DEBUG_PAGES !== 'true') {
    notFound();
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('v_group_events_calendar_sync')
    .select('*')
    .order('event_date', { ascending: true })
    .order('entry_time', { ascending: true });

  if (error) {
    console.error('[DebugCalendarSync] error', error);
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-4">Debug Calendar Sync – Error</h1>
        <p className="text-red-500 text-sm">{error.message}</p>
      </div>
    );
  }

  const rows = (data ?? []) as CalendarSyncRow[];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Debug Calendar Sync</h1>
      <p className="text-sm text-slate-400">
        Vista de la tabla <code>v_group_events_calendar_sync</code>. Aquí puedes ver qué acción quiere hacer cada grupo respecto a Google Calendar.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          No hay filas en la vista <code>v_group_events_calendar_sync</code>.
        </p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900 text-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Hora</th>
                <th className="px-3 py-2 text-left">Grupo</th>
                <th className="px-3 py-2 text-right">Pax</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Calendar ID</th>
                <th className="px-3 py-2 text-left">Acción</th>
                <th className="px-3 py-2 text-left">¿Sync?</th>
                <th className="px-3 py-2 text-left">Group ID</th>
                <th className="px-3 py-2 text-left">Sync ahora</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.group_event_id} className="border-t border-slate-800">
                  <td className="px-3 py-1">{row.event_date}</td>
                  <td className="px-3 py-1">
                    {row.entry_time ?? <span className="text-slate-500">—</span>}
                  </td>
                  <td className="px-3 py-1">{row.group_name}</td>
                  <td className="px-3 py-1 text-right">{row.total_pax ?? 0}</td>
                  <td className="px-3 py-1">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-1 text-xs text-slate-500">
                    {row.calendar_event_id ?? '—'}
                  </td>
                  <td className="px-3 py-1">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs">
                      {row.desired_calendar_action}
                    </span>
                  </td>
                  <td className="px-3 py-1">
                    {row.needs_calendar_sync ? 'Sí' : 'No'}
                  </td>
                  <td className="px-3 py-1 text-xs text-slate-500">
                    {row.group_event_id}
                  </td>
                  <td className="px-3 py-1">
                    <SyncNowButton groupEventId={row.group_event_id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
