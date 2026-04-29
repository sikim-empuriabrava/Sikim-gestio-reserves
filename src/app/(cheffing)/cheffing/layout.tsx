import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getAllowlistRoleForUserEmail, getDefaultModulePath, isAdmin } from '@/lib/auth/requireRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CheffingNav } from '@/app/(cheffing)/cheffing/components/CheffingNav';
import { CheffingToastProvider } from '@/app/(cheffing)/cheffing/components/CheffingToastProvider';

export default async function CheffingLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/cheffing')}`);
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
  const backToAppHref = isAdmin(allowlistInfo.role)
    ? '/admin'
    : allowedUser?.can_reservas
      ? '/reservas?view=week'
      : allowedUser?.can_mantenimiento
        ? '/mantenimiento'
        : allowedUser?.can_cocina
          ? '/cocina'
          : '/';

  if (!isAdmin(allowlistInfo.role) && !allowedUser?.can_cheffing) {
    redirect(getDefaultModulePath(allowedUser));
  }

  return (
    <CheffingToastProvider>
      <div className="mx-auto flex min-h-screen max-w-[1520px] flex-col gap-4 px-4 py-4 sm:px-5 lg:px-6 xl:px-8">
        <header className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-950/90 via-slate-950/75 to-slate-900/70 px-4 py-4 shadow-[0_24px_60px_-42px_rgba(2,6,23,0.95)] ring-1 ring-white/[0.03] md:px-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary-300/45 to-transparent"
          />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-[12rem] space-y-1.5">
              <Link
                href={backToAppHref}
                className="inline-flex items-center rounded-full border border-slate-700/80 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-200 shadow-sm shadow-slate-950/20 transition duration-150 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-900/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/25 active:translate-y-px"
              >
                &larr; Volver a la app
              </Link>
              <h1 className="text-[1.55rem] font-semibold leading-tight text-white">Cheffing</h1>
              <p className="max-w-[13rem] text-sm leading-5 text-slate-300">Gestión de cocina y escandallos</p>
            </div>
            <CheffingNav />
          </div>
        </header>

        <main className="flex-1 space-y-6">{children}</main>
      </div>
    </CheffingToastProvider>
  );
}
