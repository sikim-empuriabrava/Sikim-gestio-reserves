import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gestor de Reservas | Sikim',
  description: 'Dashboard interno para gestionar reservas de restaurante y discoteca.',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 font-sans text-slate-100">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(34,211,238,0.15),transparent_30%)]" />
        <div className="relative min-h-screen">{children}</div>
      </body>
    </html>
  );
}
