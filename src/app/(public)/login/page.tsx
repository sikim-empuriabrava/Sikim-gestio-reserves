'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

const DEFAULT_NEXT = '/reservas?view=week';
const AFORO_NEXT = '/disco/aforo-en-directo';
const AFORO_PWA_COOKIE = 'sikim_aforo_pwa=1';
const OPERATIONS_EMAIL_DOMAIN = 'sikimempuriabrava.com';
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

type NormalizedOperationalUsername =
  | {
      isValid: true;
      normalized: string;
      email: string;
    }
  | {
      isValid: false;
      normalized: string;
      error: string;
    };

function normalizeOperationalUsername(rawValue: string): NormalizedOperationalUsername {
  const normalized = rawValue.trim().toLowerCase();
  const noSpaces = !/\s/.test(normalized);
  const hasValidChars = USERNAME_PATTERN.test(normalized);
  const isValid = Boolean(normalized) && noSpaces && hasValidChars;

  if (!isValid) {
    return {
      isValid: false,
      normalized,
      error:
        'Usuario inválido. Usa solo letras minúsculas, números, punto, guion o guion bajo, sin espacios.',
    };
  }

  return {
    isValid: true,
    normalized,
    email: `${normalized}@${OPERATIONS_EMAIL_DOMAIN}`,
  };
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [operationalUsername, setOperationalUsername] = useState('');
  const [operationalPassword, setOperationalPassword] = useState('');
  const [passwordLoginError, setPasswordLoginError] = useState<string | null>(null);
  const browserMissingEnv = useMemo(() => {
    const missing: string[] = [];
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
      missing.push('NEXT_PUBLIC_SUPABASE_URL');
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
      missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    return missing;
  }, []);
  const supabase = useMemo(
    () => (browserMissingEnv.length > 0 ? null : createSupabaseBrowserClient()),
    [browserMissingEnv.length],
  );
  const error = searchParams.get('error');
  const nextRaw = searchParams.get('next');
  const [fallbackNext, setFallbackNext] = useState<string | null>(null);
  const nextPath = nextRaw ?? fallbackNext;
  const isPreparing = !nextRaw && !fallbackNext;
  const missingEnv = useMemo(() => {
    const missingRaw = searchParams.get('missing');
    const queryMissing = missingRaw
      ? missingRaw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
    const combined = [...queryMissing, ...browserMissingEnv];
    return Array.from(new Set(combined)).filter(Boolean);
  }, [searchParams, browserMissingEnv]);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const hasAforoCookie = document.cookie.includes(AFORO_PWA_COOKIE);
    setFallbackNext(isStandalone || hasAforoCookie ? AFORO_NEXT : DEFAULT_NEXT);
  }, []);

  useEffect(() => {
    if (!nextRaw && fallbackNext) {
      router.replace(`/login?next=${encodeURIComponent(fallbackNext)}`);
    }
  }, [nextRaw, router, fallbackNext]);

  useEffect(() => {
    if (error === 'not_allowed') return;
    if (!supabase) return;
    if (isPreparing || !nextPath) return;

    let cancelled = false;

    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) {
        window.location.assign(nextPath);
      }
    };

    run();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        window.location.assign(nextPath);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase, nextPath, error, isPreparing]);

  const handleLogin = async () => {
    if (isPreparing || !supabase) return;

    setIsLoadingGoogle(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath ?? DEFAULT_NEXT)}`;

    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });
    } catch (error) {
      console.error(error);
      alert('No se pudo iniciar sesión con Google');
      setIsLoadingGoogle(false);
    }
  };

  const handleLoginSelectAccount = async () => {
    if (isPreparing || !supabase) return;

    setIsLoadingGoogle(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath ?? DEFAULT_NEXT)}`;

    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { prompt: 'select_account' } satisfies Record<string, string>,
        },
      });
    } catch (error) {
      console.error(error);
      alert('No se pudo iniciar sesión con Google');
      setIsLoadingGoogle(false);
    }
  };

  const handleOperationalLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPreparing || !supabase) return;

    setPasswordLoginError(null);
    const usernameInfo = normalizeOperationalUsername(operationalUsername);
    if (!usernameInfo.isValid) {
      setPasswordLoginError(usernameInfo.error);
      return;
    }

    if (!operationalPassword.trim()) {
      setPasswordLoginError('Introduce la contraseña.');
      return;
    }

    setIsLoadingPassword(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameInfo.email,
        password: operationalPassword,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error(error);
      setPasswordLoginError('Usuario o contraseña incorrectos.');
      setIsLoadingPassword(false);
    }
  };

  const isAnyLoading = isLoadingGoogle || isLoadingPassword;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6">
      <div className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-wide text-primary-200">Acceso</p>
        <h1 className="text-3xl font-bold text-white">Inicia sesión</h1>
        <p className="text-sm text-slate-400">
          Conéctate con tu cuenta de Google para gestionar las reservas.
        </p>
        {error === 'not_allowed' ? (
          <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-100">
            No tienes acceso habilitado. Contacta con un administrador para darte permisos.
          </p>
        ) : null}
        {error === 'config' || missingEnv.length > 0 ? (
          <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-100">
            {missingEnv.length > 0 ? (
              <>
                Configuración incompleta en servidor. Faltan:{' '}
                <span className="font-semibold">{missingEnv.join(', ')}</span>. Revisa las variables de entorno en
                Vercel (Project Settings → Environment Variables) o contacta con administración.
              </>
            ) : (
              <>No se pudo validar la configuración de Supabase. Revisa la configuración o contacta con administración.</>
            )}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={handleLogin}
        disabled={isAnyLoading || isPreparing || !supabase}
        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100 disabled:cursor-not-allowed"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 256 262"
          className="h-5 w-5"
        >
          <path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.282 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" />
          <path fill="#34A853" d="M130.55 261.1c35.248 0 64.849-11.605 86.466-31.622l-41.196-31.9c-11.045 7.688-25.823 13.055-45.27 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" />
          <path fill="#FBBC05" d="M56.281 156.383c-2.756-8.123-4.351-16.827-4.351-25.829 0-8.994 1.595-17.698 4.206-25.82l-.073-1.73-40.663-31.58-1.334.635C4.9 88.152 0 108.62 0 130.554c0 21.935 4.9 42.402 13.929 58.495z" />
          <path fill="#EB4335" d="M130.55 50.479c24.55 0 41.05 10.61 50.479 19.468l36.844-35.97C195.259 12.91 165.798 0 130.55 0 79.49 0 35.393 29.3 13.929 72.06l40.208 31.75c10.59-31.477 39.891-54.33 76.413-54.33" />
        </svg>
        {isPreparing ? 'Preparando…' : isLoadingGoogle ? 'Redirigiendo…' : 'Continuar con Google'}
      </button>

      <button
        type="button"
        onClick={handleLoginSelectAccount}
        disabled={isAnyLoading || isPreparing || !supabase}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-200 disabled:cursor-not-allowed"
      >
        Elegir otra cuenta de Google
      </button>

      <button
        type="button"
        onClick={() => setShowPasswordLogin((prev) => !prev)}
        disabled={isAnyLoading || isPreparing || !supabase}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-100 shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed"
      >
        {showPasswordLogin ? 'Ocultar usuario + contraseña' : 'Entrar con usuario y contraseña'}
      </button>

      {showPasswordLogin ? (
        <form onSubmit={handleOperationalLogin} className="w-full space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <label className="block space-y-1 text-left text-sm text-slate-300">
            <span className="font-semibold text-slate-200">Usuario</span>
            <input
              type="text"
              autoComplete="username"
              value={operationalUsername}
              onChange={(event) => setOperationalUsername(event.target.value)}
              placeholder="usuario.puerta"
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
              disabled={isAnyLoading || isPreparing || !supabase}
            />
          </label>
          <label className="block space-y-1 text-left text-sm text-slate-300">
            <span className="font-semibold text-slate-200">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={operationalPassword}
              onChange={(event) => setOperationalPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
              disabled={isAnyLoading || isPreparing || !supabase}
            />
          </label>
          <button
            type="submit"
            disabled={isAnyLoading || isPreparing || !supabase}
            className="w-full rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingPassword ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="text-xs text-slate-400">Introduce solo tu usuario, sin @sikimempuriabrava.com.</p>
          {passwordLoginError ? (
            <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-100">{passwordLoginError}</p>
          ) : null}
        </form>
      ) : null}

      <p className="text-xs text-slate-500">Serás redirigido a Google para completar el inicio de sesión.</p>
    </div>
  );
}
