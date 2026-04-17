'use client';

import { useMemo } from 'react';

import { AforoInstallDebugPanel } from './AforoInstallDebugPanel';
import { useAforoInstallPrompt } from './useAforoInstallPrompt';

export function AforoInstallCta() {
  const { isInstallAvailable, isInstalled, isIosLike, canShowManualInstructions, installStatus, installApp, debugInfo } =
    useAforoInstallPrompt();

  const helperText = useMemo(() => {
    if (isInstalled) {
      return 'App instalada.';
    }

    if (canShowManualInstructions) {
      return 'Para instalar en iPhone: Compartir → Añadir a pantalla de inicio.';
    }

    if (installStatus === 'dismissed') {
      return 'Instalación cancelada. Puedes intentarlo de nuevo cuando el navegador la vuelva a ofrecer.';
    }

    if (installStatus === 'error') {
      return 'No se pudo abrir el instalador de la app en este dispositivo.';
    }

    if (!isInstallAvailable && !isIosLike) {
      return null;
    }

    return null;
  }, [canShowManualInstructions, installStatus, isInstallAvailable, isInstalled, isIosLike]);

  if (!isInstallAvailable && !helperText && !debugInfo.debugEnabled) {
    return null;
  }

  return (
    <div className="space-y-2.5">
      {(isInstallAvailable || helperText) && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {isInstallAvailable ? (
              <button
                type="button"
                onClick={() => {
                  void installApp();
                }}
                className="inline-flex min-h-9 items-center rounded-md border border-sky-700/70 bg-sky-900/30 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-900/50"
              >
                Instalar app
              </button>
            ) : null}

            {helperText ? <p className="text-xs text-slate-300">{helperText}</p> : null}
          </div>
        </div>
      )}

      {debugInfo.debugEnabled ? (
        <AforoInstallDebugPanel
          debugInfo={debugInfo}
          onForceInstall={() => {
            void installApp();
          }}
        />
      ) : null}
    </div>
  );
}
