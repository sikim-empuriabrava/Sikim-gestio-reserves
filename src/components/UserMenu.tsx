'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Props = {
  email?: string | null;
  roleLabel?: string | null;
};

function getAccountInitials(email: string | null) {
  if (!email) return 'SK';

  const localPart = email.split('@')[0]?.replace(/[^a-z0-9]/gi, ' ') ?? '';
  const parts = localPart.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return localPart.slice(0, 2).toUpperCase() || 'SK';
}

export function UserMenu({ email: initialEmail, roleLabel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [sessionEmail, setSessionEmail] = useState<string | null>(initialEmail ?? null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isAuthenticated = Boolean(sessionEmail);
  const isLoginPage = pathname === '/login';
  const accountInitials = getAccountInitials(sessionEmail);

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
        console.error('Error al cerrar sesion');
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

  if (!isAuthenticated) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-xl border border-stone-800/80 bg-stone-950/55 px-3 py-2 text-sm font-semibold text-stone-300 transition-colors duration-200 hover:border-primary-400/45 hover:bg-stone-900/80 hover:text-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/25"
      >
        Inicia sesion
      </Link>
    );
  }

  return (
    <div className="flex w-full min-w-0 items-center justify-end">
      <div className="flex max-w-full min-w-0 items-center gap-2 rounded-xl border border-stone-800/80 bg-stone-950/45 p-1.5 text-sm text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] sm:gap-3">
        <Link
          href="/account"
          className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-stone-100 transition-colors duration-200 hover:bg-stone-900/75 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/25"
          title={sessionEmail ?? undefined}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-500/80 text-xs font-semibold text-white shadow-sm shadow-violet-950/40">
            {accountInitials}
          </span>
          <span className="min-w-0">
            <span className="block max-w-[18ch] truncate text-sm font-semibold leading-5 sm:max-w-[28ch]">{sessionEmail}</span>
            <span className="block text-xs leading-4 text-stone-500">{roleLabel ?? 'Cuenta'}</span>
          </span>
        </Link>

        <div className="h-8 w-px shrink-0 bg-stone-800/90" aria-hidden="true" />

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold text-stone-400 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/25 active:translate-y-px disabled:pointer-events-none disabled:opacity-60"
        >
          {isLoggingOut ? 'Saliendo...' : 'Salir'}
        </button>
      </div>
    </div>
  );
}
