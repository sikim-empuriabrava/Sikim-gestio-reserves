'use client';

import type { AforoInstallDebugInfo } from './useAforoInstallPrompt';

type Props = {
  debugInfo: AforoInstallDebugInfo;
  onForceInstall: () => void;
};

function valueToText(value: boolean | string | null) {
  if (value === null || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return value;
}

export function AforoInstallDebugPanel({ debugInfo, onForceInstall }: Props) {
  const rows: Array<{ label: string; value: boolean | string | null }> = [
    { label: 'isStandalone', value: debugInfo.isStandalone },
    { label: 'isInstallAvailable', value: debugInfo.isInstallAvailable },
    { label: 'isInstalled', value: debugInfo.isInstalled },
    { label: 'isIosLike', value: debugInfo.isIosLike },
    { label: 'canShowManualInstructions', value: debugInfo.canShowManualInstructions },
    { label: 'installStatus', value: debugInfo.installStatus },
    { label: 'hasDeferredPrompt', value: debugInfo.hasDeferredPrompt },
    { label: 'display-mode: standalone', value: debugInfo.displayModeStandalone },
    { label: 'navigator.standalone', value: debugInfo.navigatorStandalone },
    { label: 'pathname', value: debugInfo.pathname },
    { label: 'androidChromeLike', value: debugInfo.isAndroidChromeLike },
    { label: 'last beforeinstallprompt', value: debugInfo.lastBeforeInstallPromptAt },
    { label: 'last appinstalled', value: debugInfo.lastAppInstalledAt },
    { label: 'userAgent', value: debugInfo.userAgent },
  ];

  return (
    <div className="rounded-lg border border-fuchsia-900/70 bg-slate-950/70 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300">PWA Debug</p>
        {debugInfo.hasDeferredPrompt ? (
          <button
            type="button"
            onClick={onForceInstall}
            className="rounded-md border border-fuchsia-700/70 bg-fuchsia-900/30 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-100 transition hover:bg-fuchsia-900/50"
          >
            Forzar installApp()
          </button>
        ) : null}
      </div>

      <dl className="mt-2 space-y-1.5 text-xs text-slate-300">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[170px_1fr] gap-2">
            <dt className="text-slate-400">{row.label}</dt>
            <dd className="break-words text-slate-200">{valueToText(row.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
