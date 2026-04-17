'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Props = {
  email?: string | null;
};

export function UserMenu({ email: initialEmail }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [sessionEmail, setSessionEmail] = useState<string | null>(initialEmail ?? null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isAuthenticated = Boolean(sessionEmail);
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!isMounted) return;
        setSessionEmail(data.user?.email ?? null);
      })
      .catch((error) => {
        console.error('Error obteniendo el usuario', error);
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

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      const response = await fetch('/auth/logout', { method: 'GET' });
      if (!response.ok) {
        console.error('Error al cerrar sesión');
      } else {
        setSessionEmail(null);
        router.replace('/login');
        router.refresh();
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isLoginPage) {
    return null;
  }

  return (
    <div className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-lg shadow-slate-900/40 sm:w-auto sm:gap-3">
      {isAuthenticated ? (
        <>
          <Link
            href="/account"
            className="min-w-0 flex-1 truncate font-semibold hover:text-primary-200 sm:max-w-[24ch] sm:flex-none"
            title={sessionEmail ?? undefined}
          >
            {sessionEmail}
          </Link>
          <span className="hidden text-slate-500 sm:inline">•</span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="shrink-0 text-xs font-semibold text-slate-300 transition hover:text-red-200 disabled:opacity-60"
          >
            {isLoggingOut ? 'Saliendo…' : 'Cerrar sesión'}
          </button>
        </>
      ) : (
        <Link href="/login" className="font-semibold text-slate-300 hover:text-primary-200">
          Inicia sesión
        </Link>
      )}
    </div>
  );
}
