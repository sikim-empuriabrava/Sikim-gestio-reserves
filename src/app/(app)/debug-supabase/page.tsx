import { notFound, redirect } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function DebugSupabasePage() {
  if (process.env.ENABLE_DEBUG_PAGES !== 'true') {
    notFound();
  }

  const supabaseServer = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  if (!user) {
    redirect('/login?error=unauthorized&next=%2Fdebug-supabase');
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    redirect('/login?error=not_allowed');
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    redirect('/login?error=not_allowed');
  }

  if (!isAdmin(allowlistInfo.role)) {
    redirect('/?error=forbidden');
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('group_events')
    .select('id, name, event_date, entry_time, total_pax, status')
    .order('event_date', { ascending: true })
    .limit(50);

  if (error) {
    console.error('[Supabase error]', error);
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-4">Debug Supabase – Error</h1>
        <p className="text-red-500 text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold mb-2">
        Debug Supabase – group_events
      </h1>

      {(!data || data.length === 0) && (
        <p className="text-sm text-slate-500">
          No hay registros en la tabla <code>group_events</code> (o la consulta no devolvió datos).
        </p>
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900 text-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Hora</th>
                <th className="px-3 py-2 text-left">Nombre grupo</th>
                <th className="px-3 py-2 text-right">Pax</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">ID</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-t border-slate-800">
                  <td className="px-3 py-1">
                    {row.event_date ?? <span className="text-slate-500">—</span>}
                  </td>
                  <td className="px-3 py-1">
                    {row.entry_time ?? <span className="text-slate-500">—</span>}
                  </td>
                  <td className="px-3 py-1">{row.name}</td>
                  <td className="px-3 py-1 text-right">{row.total_pax ?? 0}</td>
                  <td className="px-3 py-1">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-1 text-xs text-slate-500">
                    {row.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Esta página es solo para pruebas internas. Más adelante se podrá borrar o proteger.
      </p>
    </div>
  );
}
