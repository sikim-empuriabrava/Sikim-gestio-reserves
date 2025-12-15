'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';

type Props = {
  email?: string | null;
};

export function UserMenu({ email }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isAuthenticated = Boolean(email);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-lg shadow-slate-900/40">
      <Link href="/account" className="font-semibold hover:text-primary-200">
        {email ?? 'Cuenta'}
      </Link>
      <span className="text-slate-500">•</span>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut || !isAuthenticated}
        className="text-xs font-semibold text-slate-300 transition hover:text-red-200 disabled:opacity-60"
      >
        {isLoggingOut ? 'Saliendo…' : 'Cerrar sesión'}
      </button>
    </div>
  );
}
