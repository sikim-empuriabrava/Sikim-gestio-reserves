import { AppSidebar } from '@/components/AppSidebar';
import { UserMenu } from '@/components/UserMenu';
import { getAllowlistRoleForUserEmail } from '@/lib/auth/requireRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { redirect } from 'next/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Segunda barrera server-side por si el middleware falla y evitar renderizar el panel sin allowlist.
  if (!user) {
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
  const roleLabel = allowedUser?.role === 'admin' ? 'Administrador' : 'Equipo';

  return (
    <div className="aforo-standalone-shell min-h-screen bg-background text-stone-100 lg:flex">
      <aside className="aforo-standalone-chrome hidden w-[18rem] shrink-0 border-r border-stone-800/80 bg-[#14120f]/95 lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="flex h-[5.5rem] items-center gap-3 border-b border-stone-800/80 px-5">
            <div className="relative h-8 w-9 shrink-0" aria-hidden="true">
              <span className="absolute left-1 top-3 h-3 w-7 -skew-x-12 rounded-[3px] bg-violet-500/85 shadow-sm shadow-violet-950/35" />
              <span className="absolute left-3 top-1 h-3 w-7 -skew-x-12 rounded-[3px] bg-amber-300/75 shadow-sm shadow-amber-950/30" />
            </div>
            <div className="min-w-0">
              <p className="text-[1.75rem] font-semibold leading-none tracking-normal text-stone-50">Sikim</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Operativa</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <AppSidebar allowedUser={allowedUser} />
          </div>

          <div className="border-t border-stone-800/80 px-4 py-4">
            <div className="rounded-xl border border-stone-800/80 bg-stone-950/35 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/70">Sistema interno</p>
              <p className="mt-1 text-sm text-stone-300">Gestion de servicio y equipo</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="aforo-standalone-chrome border-b border-stone-800/80 bg-[#14120f]/85 px-4 py-3 shadow-[0_16px_48px_-42px_rgba(0,0,0,0.9)] sm:px-5 lg:px-8 xl:px-10">
          <div className="mx-auto flex w-full max-w-[1540px] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <details className="group rounded-xl border border-stone-800/90 bg-stone-950/55 px-3 py-2 shadow-lg shadow-black/20">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-stone-100 [&::-webkit-details-marker]:hidden">
                  Menu
                  <span className="text-stone-500 transition-transform duration-200 group-open:rotate-180">v</span>
                </summary>
                <div className="mt-3 max-h-[70vh] overflow-y-auto border-t border-stone-800/70 pt-3">
                  <AppSidebar allowedUser={allowedUser} />
                </div>
              </details>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-100">Sikim</p>
                <p className="text-xs text-stone-500">Operativa interna</p>
              </div>
            </div>

            <div className="hidden min-w-0 lg:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/70">Sikim</p>
              <p className="mt-0.5 text-sm text-stone-400">Reservas, servicio y equipo</p>
            </div>

            <div className="min-w-0 flex-1 md:flex-none">
              <UserMenu email={user?.email} roleLabel={roleLabel} />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-5 lg:px-8 lg:py-7 xl:px-10">
          <div className="mx-auto w-full max-w-[1540px] space-y-6">{children}</div>
        </main>

        <footer className="aforo-standalone-chrome aforo-live-capacity-hide-footer border-t border-stone-800/80 px-4 py-5 text-xs font-medium uppercase tracking-[0.18em] text-stone-600 sm:px-5 lg:px-8 xl:px-10">
          <div className="mx-auto w-full max-w-[1540px]">Sikim - Gestion interna</div>
        </footer>
      </div>
    </div>
  );
}
