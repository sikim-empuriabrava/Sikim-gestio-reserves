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
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 lg:px-0 lg:py-8">
        <header className="rounded-2xl border border-slate-800/80 bg-slate-950/70 px-6 py-5 shadow-lg shadow-slate-950/25">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <Link
                href={backToAppHref}
                className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                ← Volver a la app
              </Link>
              <h1 className="text-2xl font-bold text-white">Cheffing</h1>
              <p className="text-sm text-slate-400">Gestión de cocina y escandallos</p>
            </div>
            <CheffingNav />
          </div>
        </header>

        <main className="flex-1 space-y-6">{children}</main>
      </div>
    </CheffingToastProvider>
  );
}
