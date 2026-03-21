'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

type ToastInput = {
  type: ToastType;
  title: string;
};

type ToastItem = ToastInput & {
  id: string;
};

type CheffingToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const CheffingToastContext = createContext<CheffingToastContextValue | null>(null);

const TOAST_DURATION_MS = 3000;

const toastToneClasses: Record<ToastType, string> = {
  success: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100',
  error: 'border-rose-400/50 bg-rose-500/15 text-rose-100',
  info: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100',
};

const getToastId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function CheffingToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = getToastId();
      setToasts((prev) => [...prev, { ...toast, id }]);
      window.setTimeout(() => removeToast(id), TOAST_DURATION_MS);
    },
    [removeToast],
  );

  const value = useMemo<CheffingToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <CheffingToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,360px)] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-lg shadow-slate-950/40 backdrop-blur ${toastToneClasses[toast.type]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold leading-5">{toast.title}</p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="rounded-full border border-slate-300/30 px-2 py-0.5 text-xs text-slate-100/90 transition hover:border-slate-200/70 hover:text-white"
                aria-label="Cerrar notificación"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </CheffingToastContext.Provider>
  );
}

export function useCheffingToast() {
  const context = useContext(CheffingToastContext);
  if (!context) {
    throw new Error('useCheffingToast debe usarse dentro de CheffingToastProvider.');
  }
  return context;
}
