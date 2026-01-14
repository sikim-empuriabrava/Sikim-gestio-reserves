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
    redirect('/login?error=unauthorized');
  }

  const email = user.email?.trim().toLowerCase();

  const { allowlisted } = await getAllowlistRoleForUserEmail(email);

  if (!allowlisted) {
    redirect('/login?error=not_allowed');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-8 lg:px-0">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-8">
          <AppSidebar />
        </div>
      </aside>

      <div className="flex w-full flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/70 px-4 py-4 shadow-lg shadow-slate-900/30">
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

            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="lg:hidden">
                <details className="group rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 shadow-lg shadow-slate-950/40">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-100">
                    Menú
                    <span className="text-slate-400 transition duration-200 group-open:rotate-180">▾</span>
                  </summary>
                  <div className="pt-3">
                    <AppSidebar />
                  </div>
                </details>
              </div>
              <UserMenu email={user?.email} />
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-6">{children}</main>

        <footer className="border-t border-slate-800/80 pt-6 text-sm text-slate-500">Interfaz MVP – pendiente de integrar con base de datos.</footer>
      </div>
    </div>
  );
}
