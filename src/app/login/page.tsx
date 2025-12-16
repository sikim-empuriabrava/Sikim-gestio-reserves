'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

const DEFAULT_NEXT = '/reservas?view=week';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const error = searchParams.get('error');
  const nextRaw = searchParams.get('next');
  const nextPath = nextRaw ?? DEFAULT_NEXT;
  const isPreparing = !nextRaw;

  useEffect(() => {
    if (!nextRaw) {
      router.replace(`/login?next=${encodeURIComponent(DEFAULT_NEXT)}`);
    }
  }, [nextRaw, router]);

  const handleLogin = async () => {
    if (isPreparing) return;

    setIsLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

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
      setIsLoading(false);
    }
  };

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
      </div>

      <button
        type="button"
        onClick={handleLogin}
        disabled={isLoading || isPreparing}
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
        {isPreparing ? 'Preparando…' : isLoading ? 'Redirigiendo…' : 'Continuar con Google'}
      </button>

      <p className="text-xs text-slate-500">Serás redirigido a Google para completar el inicio de sesión.</p>
    </div>
  );
}
