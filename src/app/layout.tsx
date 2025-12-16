import type { Metadata } from 'next';
import './globals.css';
import { Navigation } from '@/components/Navigation';
import { UserMenu } from '@/components/UserMenu';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Gestor de Reservas | Sikim',
  description: 'Dashboard interno para gestionar reservas de restaurante y discoteca.',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="es">
      <body className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 font-sans">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(34,211,238,0.15),transparent_30%)]" />
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-8 lg:px-0">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary-500/40 bg-primary-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-100">
                MVP listo para Vercel
              </p>
              <div>
                <h1 className="text-3xl font-bold text-white">Gestor interno de reservas</h1>
                <p className="text-sm text-slate-400">Visualiza, crea y sigue las reservas en tiempo real.</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <Navigation />
              <UserMenu email={user?.email} />
            </div>
          </header>
          <main className="flex-1 pb-10">{children}</main>
          <footer className="border-t border-slate-800/80 pt-6 text-sm text-slate-500">Interfaz MVP – pendiente de integrar con base de datos.</footer>
        </div>
      </body>
    </html>
  );
}
