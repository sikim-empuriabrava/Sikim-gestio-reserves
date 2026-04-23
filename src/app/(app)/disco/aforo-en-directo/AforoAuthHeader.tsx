'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Props = {
  title: string;
  subtitle?: string;
  initialEmail?: string | null;
};

const AFORO_PAGE_PATH = '/disco/aforo-en-directo';
const LOGIN_PATH = '/login?next=%2Fdisco%2Faforo-en-directo';

export function AforoAuthHeader({ title, subtitle, initialEmail = null }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [sessionEmail, setSessionEmail] = useState<string | null>(initialEmail);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!isMounted) return;
        setSessionEmail(data.user?.email ?? null);
      })
      .catch((error) => {
        console.error('Error obteniendo sesión de aforo', error);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSessionEmail(session?.user?.email ?? null);
      if (!session) {
        setIsLoggingOut(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const isAuthenticated = Boolean(sessionEmail);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      const response = await fetch('/auth/logout', { method: 'GET' });

      if (!response.ok) {
        throw new Error('No se pudo cerrar la sesión');
      }

      setSessionEmail(null);
      router.replace(AFORO_PAGE_PATH);
      router.refresh();
    } catch (error) {
      console.error('Error al cerrar sesión de aforo', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-4 shadow-lg shadow-slate-950/30 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>

        <div className="w-full rounded-xl border border-slate-700/80 bg-slate-950/40 p-3 sm:w-auto sm:min-w-[280px]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p
                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  isAuthenticated
                    ? 'border-emerald-700/70 bg-emerald-950/40 text-emerald-200'
                    : 'border-amber-700/70 bg-amber-950/40 text-amber-200'
                }`}
              >
                {isAuthenticated ? 'Conectado' : 'Sin sesión'}
              </p>
              <p className="mt-2 truncate text-xs text-slate-400">
                {isAuthenticated ? sessionEmail : 'Necesitas autenticarte para operar el aforo.'}
              </p>
            </div>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="min-h-11 shrink-0 rounded-lg border border-rose-700/70 bg-rose-900/40 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-900/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingOut ? 'Cerrando...' : 'Cerrar sesión'}
              </button>
            ) : (
              <a
                href={LOGIN_PATH}
                className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-sky-700/70 bg-sky-900/40 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-900/60"
              >
                Iniciar sesión
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
