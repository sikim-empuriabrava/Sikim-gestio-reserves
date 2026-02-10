import { redirect } from 'next/navigation';

import { getAllowlistRoleForUserEmail, getDefaultModulePath, isAdmin } from '@/lib/auth/requireRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CheffingNav } from '@/app/(cheffing)/cheffing/components/CheffingNav';

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

  if (!isAdmin(allowlistInfo.role) && !allowedUser?.can_cheffing) {
    redirect(getDefaultModulePath(allowedUser));
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-10 lg:px-0">
      <header className="rounded-2xl border border-slate-800/80 bg-slate-900/70 px-6 py-5 shadow-lg shadow-slate-900/30">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Cheffing</h1>
            <p className="text-sm text-slate-400">Gestión de cocina y escandallos</p>
          </div>
          <CheffingNav />
        </div>
      </header>

      <main className="flex-1 space-y-6">{children}</main>
    </div>
  );
}
