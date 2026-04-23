import { AppSidebar } from '@/components/AppSidebar';
import { UserMenu } from '@/components/UserMenu';
import { getAllowlistRoleForUserEmail } from '@/lib/auth/requireRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = headers();
  const allowGuestAforo = requestHeaders.get('x-sikim-allow-guest-aforo') === '1';
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Segunda barrera server-side por si el middleware falla y evitar renderizar el panel sin allowlist.
  if (!user) {
    if (allowGuestAforo) {
      return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 lg:px-0">{children}</main>;
    }
    redirect('/login?error=unauthorized&next=%2Freservas');
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    redirect('/login?error=not_allowed');
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    redirect('/login?error=not_allowed');
  }

  const allowedUser = allowlistInfo.allowedUser;

  return (
    <div className="aforo-standalone-shell mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-8 lg:px-0">
      <aside className="aforo-standalone-chrome hidden w-64 shrink-0 lg:block">
        <div className="sticky top-8">
          <AppSidebar allowedUser={allowedUser} />
        </div>
      </aside>

      <div className="flex w-full flex-col gap-6">
        <header className="aforo-standalone-chrome flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/70 px-4 py-4 shadow-lg shadow-slate-900/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary-500/40 bg-primary-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-100">
                MVP listo para Vercel
              </p>
              <div>
                <h1 className="text-2xl font-bold text-white">Gestor interno de reservas</h1>
                <p className="text-sm text-slate-400">Visualiza, crea y sigue las reservas en tiempo real.</p>
              </div>
            </div>

            <div className="flex w-full min-w-0 items-center gap-3 self-start md:w-auto md:self-auto">
              <div className="lg:hidden">
                <details className="group rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 shadow-lg shadow-slate-950/40">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-100">
                    Menú
                    <span className="text-slate-400 transition duration-200 group-open:rotate-180">▾</span>
                  </summary>
                  <div className="pt-3">
                    <AppSidebar allowedUser={allowedUser} />
                  </div>
                </details>
              </div>
              <div className="min-w-0 flex-1 md:flex-none">
                <UserMenu email={user?.email} />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-6">{children}</main>

        <footer className="aforo-standalone-chrome aforo-live-capacity-hide-footer border-t border-slate-800/80 pt-6 text-sm text-slate-500">
          Interfaz MVP – pendiente de integrar con base de datos.
        </footer>
      </div>
    </div>
  );
}
