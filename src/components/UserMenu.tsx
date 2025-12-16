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
    setSessionEmail(initialEmail ?? null);
  }, [initialEmail]);

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
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error al cerrar sesión', error);
      setIsLoggingOut(false);
      return;
    }

    setSessionEmail(null);
    router.push('/login');
  };

  if (!isAuthenticated && isLoginPage) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-lg shadow-slate-900/40">
      {isAuthenticated ? (
        <>
          <Link href="/account" className="font-semibold hover:text-primary-200">
            {sessionEmail}
          </Link>
          <span className="text-slate-500">•</span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="text-xs font-semibold text-slate-300 transition hover:text-red-200 disabled:opacity-60"
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
