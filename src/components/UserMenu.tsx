'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Props = {
  email?: string | null;
};

type ThemePreference = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'sikim-theme-preference';
const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'dark', label: 'Oscuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Sistema' },
];

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  if (!window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference;
}

function applyTheme(preference: ThemePreference) {
  const theme = resolveTheme(preference);

  try {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    // Keep the control usable if the document root cannot be updated.
  }
}

function ThemePreferenceControl() {
  const [preference, setPreference] = useState<ThemePreference>('light');

  useEffect(() => {
    let storedPreference: string | null = null;

    try {
      storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      storedPreference = null;
    }

    const nextPreference = isThemePreference(storedPreference) ? storedPreference : 'light';

    setPreference(nextPreference);
    applyTheme(nextPreference);
  }, []);

  useEffect(() => {
    if (preference !== 'system') return;
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => applyTheme('system');

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [preference]);

  const handlePreferenceChange = (nextPreference: ThemePreference) => {
    setPreference(nextPreference);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    } catch {
      // The theme still applies for this page view if storage is unavailable.
    }

    applyTheme(nextPreference);
  };

  return (
    <div
      className="flex shrink-0 rounded-lg border p-0.5"
      style={{ borderColor: 'var(--sikim-border)', backgroundColor: 'var(--sikim-surface-subtle)' }}
      role="radiogroup"
      aria-label="Tema de la aplicacion"
    >
      {THEME_OPTIONS.map((option) => {
        const isSelected = preference === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => handlePreferenceChange(option.value)}
            className="rounded-md px-2 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sikim-focus-ring)] sm:text-xs"
            style={{
              backgroundColor: isSelected ? 'var(--sikim-accent-subtle)' : 'transparent',
              color: isSelected ? 'var(--sikim-accent-hover)' : 'var(--sikim-text-secondary)',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

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
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-lg shadow-slate-900/40 sm:w-auto sm:flex-nowrap sm:gap-3">
      {isAuthenticated ? (
        <>
          <Link
            href="/account"
            className="min-w-0 flex-1 truncate font-semibold hover:text-primary-200 sm:max-w-[24ch] sm:flex-none"
            title={sessionEmail ?? undefined}
          >
            {sessionEmail}
          </Link>
          <ThemePreferenceControl />
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
