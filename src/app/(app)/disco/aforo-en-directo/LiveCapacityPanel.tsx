'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type CapacitySession = {
  id: string;
  status: 'open' | 'closed';
  opened_at: string;
  opened_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  current_count: number;
  peak_count: number;
};

type CapacityEvent = {
  id: string;
  delta: number;
  resulting_count: number;
  actor_email: string | null;
  note: string | null;
  created_at: string;
};

type LiveCapacityState = {
  activeSession: CapacitySession | null;
  recentEvents: CapacityEvent[];
  latestEvent: CapacityEvent | null;
};

type Props = {
  initialState: LiveCapacityState;
  canManage: boolean;
};

type PendingAdjust = {
  id: number;
  delta: number;
  status: 'queued' | 'sending';
  createdAt: string;
};

const RECENT_EVENTS_LIMIT = 12;

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function LiveCapacityPanel({ initialState, canManage }: Props) {
  const [serverState, setServerState] = useState<LiveCapacityState>(initialState);
  const [pendingAdjustments, setPendingAdjustments] = useState<PendingAdjust[]>([]);
  const [loadingAction, setLoadingAction] = useState<'open_session' | 'close_session' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const nextAdjustmentIdRef = useRef(1);
  const isProcessingAdjustmentsRef = useRef(false);
  const pendingAdjustmentsRef = useRef<PendingAdjust[]>([]);

  useEffect(() => {
    pendingAdjustmentsRef.current = pendingAdjustments;
  }, [pendingAdjustments]);

  const state = useMemo<LiveCapacityState>(() => {
    if (!serverState.activeSession) return serverState;
    const activeSession = { ...serverState.activeSession };

    const nextState: LiveCapacityState = {
      activeSession,
      recentEvents: [...serverState.recentEvents],
      latestEvent: serverState.latestEvent,
    };

    for (const adjustment of pendingAdjustments) {
      const nextCount = Math.max(0, activeSession.current_count + adjustment.delta);
      activeSession.current_count = nextCount;
      activeSession.peak_count = Math.max(activeSession.peak_count, nextCount);

      const optimisticEvent: CapacityEvent = {
        id: `optimistic-${adjustment.id}`,
        delta: adjustment.delta,
        resulting_count: nextCount,
        actor_email: 'Guardando...',
        note: null,
        created_at: adjustment.createdAt,
      };
      nextState.recentEvents = [optimisticEvent, ...nextState.recentEvents].slice(0, RECENT_EVENTS_LIMIT);
      nextState.latestEvent = optimisticEvent;
    }

    return nextState;
  }, [pendingAdjustments, serverState]);

  const activeSession = state.activeSession;
  const isSessionOpen = Boolean(activeSession);

  const sessionStatusLabel = useMemo(() => {
    if (!activeSession) return 'No hay sesión abierta';
    return activeSession.status === 'open' ? 'Sesión abierta' : 'Sesión cerrada';
  }, [activeSession]);

  const toUserFriendlyError = (actionError: unknown) => {
    const text = actionError instanceof Error ? actionError.message : 'Error inesperado';
    if (text.includes('below zero')) {
      return 'No se puede restar por debajo de 0.';
    }
    if (text.includes('no open session')) {
      return 'No hay sesión abierta.';
    }
    if (text.includes('already an open session')) {
      return 'Ya existe una sesión abierta para esta discoteca.';
    }
    return text;
  };

  const processAdjustmentsQueue = async () => {
    if (isProcessingAdjustmentsRef.current) return;
    isProcessingAdjustmentsRef.current = true;

    try {
      while (true) {
        const nextAdjust = pendingAdjustmentsRef.current.find((item) => item.status === 'queued');
        if (!nextAdjust) break;

        setPendingAdjustments((prev) =>
          prev.map((item) => (item.id === nextAdjust.id ? { ...item, status: 'sending' } : item)),
        );

        try {
          const response = await fetch('/api/disco/live-capacity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'adjust', delta: nextAdjust.delta }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(body?.error || 'No se pudo completar la operación');
          }

          setServerState((prev) => body.state ?? prev);
          setPendingAdjustments((prev) => prev.filter((item) => item.id !== nextAdjust.id));
          setMessage('Aforo actualizado.');
        } catch (actionError) {
          setPendingAdjustments((prev) => prev.filter((item) => item.id !== nextAdjust.id));
          setError(toUserFriendlyError(actionError));
          setMessage(null);
        }
      }
    } finally {
      isProcessingAdjustmentsRef.current = false;
    }
  };

  const queueAdjustAction = (delta: number) => {
    const currentCount = state.activeSession?.current_count ?? 0;
    if (currentCount + delta < 0) {
      setError('No se puede restar por debajo de 0.');
      setMessage(null);
      return;
    }

    const nextAdjustment: PendingAdjust = {
      id: nextAdjustmentIdRef.current++,
      delta,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };

    setError(null);
    setMessage(null);
    setPendingAdjustments((prev) => [...prev, nextAdjustment]);
    queueMicrotask(() => {
      void processAdjustmentsQueue();
    });
  };

  const submitAction = async (payload: { action: 'open_session' | 'close_session' }) => {
    setLoadingAction(payload.action);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/disco/live-capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo completar la operación');
      }

      setServerState((prev) => body.state ?? prev);

      if (payload.action === 'open_session') setMessage('Sesión abierta.');
      if (payload.action === 'close_session') setMessage('Sesión cerrada.');
    } catch (actionError) {
      setError(toUserFriendlyError(actionError));
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Estado</p>
          <p className="mt-2 text-lg font-semibold text-white">{sessionStatusLabel}</p>
        </article>

        <article className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Aforo actual</p>
          <p className="mt-2 text-5xl font-extrabold leading-none text-emerald-300">
            {activeSession?.current_count ?? 0}
          </p>
        </article>

        <article className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Pico sesión</p>
          <p className="mt-2 text-2xl font-bold text-white">{activeSession?.peak_count ?? 0}</p>
          <p className="mt-1 text-xs text-slate-400">Apertura: {formatDateTime(activeSession?.opened_at)}</p>
        </article>
      </div>

      {canManage ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            disabled={isSessionOpen || loadingAction !== null || pendingAdjustments.length > 0}
            onClick={() => submitAction({ action: 'open_session' })}
            className="rounded-lg border border-emerald-700/70 bg-emerald-900/30 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingAction === 'open_session' ? 'Abriendo...' : 'Abrir sesión'}
          </button>

          <button
            type="button"
            disabled={!isSessionOpen || loadingAction !== null || pendingAdjustments.length > 0}
            onClick={() => submitAction({ action: 'close_session' })}
            className="rounded-lg border border-amber-700/70 bg-amber-900/30 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingAction === 'close_session' ? 'Cerrando...' : 'Cerrar sesión'}
          </button>

          <button
            type="button"
            disabled={!isSessionOpen || loadingAction !== null}
            onClick={() => queueAdjustAction(1)}
            className="rounded-lg border border-sky-700/70 bg-sky-900/30 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            +1
          </button>

          <button
            type="button"
            disabled={!isSessionOpen || loadingAction !== null}
            onClick={() => queueAdjustAction(5)}
            className="rounded-lg border border-sky-700/70 bg-sky-900/30 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            +5
          </button>

          <button
            type="button"
            disabled={!isSessionOpen || (activeSession?.current_count ?? 0) <= 0 || loadingAction !== null}
            onClick={() => queueAdjustAction(-1)}
            className="rounded-lg border border-rose-700/70 bg-rose-900/30 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            -1
          </button>

          <button
            type="button"
            disabled={!isSessionOpen || (activeSession?.current_count ?? 0) <= 0 || loadingAction !== null}
            onClick={() => queueAdjustAction(-5)}
            className="rounded-lg border border-rose-700/70 bg-rose-900/30 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            -5
          </button>
        </div>
      ) : (
        <p className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-300">
          Tienes permiso de lectura. Las acciones de operación están restringidas.
        </p>
      )}

      {(error || message) && (
        <div className="space-y-2">
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        </div>
      )}

      {pendingAdjustments.length > 0 ? (
        <p className="text-xs text-slate-400">Sincronizando ajustes… ({pendingAdjustments.length} pendientes)</p>
      ) : null}

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Últimos movimientos</h2>
        {state.recentEvents.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Sin eventos todavía para la sesión actual.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {state.recentEvents.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">
                    {event.delta > 0 ? `+${event.delta}` : event.delta} → {event.resulting_count}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {event.actor_email ?? 'Usuario no identificado'}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{formatDateTime(event.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
