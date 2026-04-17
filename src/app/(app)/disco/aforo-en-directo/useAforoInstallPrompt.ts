'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAforoUiMode } from './useAforoUiMode';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isIosSafariLike() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent.toLowerCase();
  const isiOSDevice = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|opios/.test(ua);

  return isiOSDevice && isSafari;
}

function isAndroidChromeLike(userAgent: string) {
  const ua = userAgent.toLowerCase();
  return /android/.test(ua) && /chrome/.test(ua) && !/edga|opr\//.test(ua);
}

function summarizeUserAgent(userAgent: string) {
  return userAgent.length > 140 ? `${userAgent.slice(0, 140)}…` : userAgent;
}

function toIsoTimestamp(value: number | null) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
}

function debugLog(message: string) {
  console.info(`[aforo-pwa-debug] ${message}`);
}

export type AforoInstallDebugInfo = {
  debugEnabled: boolean;
  isStandalone: boolean;
  isInstallAvailable: boolean;
  isInstalled: boolean;
  isIosLike: boolean;
  canShowManualInstructions: boolean;
  installStatus: 'idle' | 'accepted' | 'dismissed' | 'error';
  hasDeferredPrompt: boolean;
  displayModeStandalone: boolean | null;
  navigatorStandalone: boolean | null;
  pathname: string;
  userAgent: string;
  isAndroidChromeLike: boolean;
  lastBeforeInstallPromptAt: string | null;
  lastAppInstalledAt: string | null;
};

export type AforoInstallPromptState = {
  isInstallAvailable: boolean;
  isInstalled: boolean;
  isIosLike: boolean;
  canShowManualInstructions: boolean;
  installStatus: 'idle' | 'accepted' | 'dismissed' | 'error';
  installApp: () => Promise<void>;
  debugInfo: AforoInstallDebugInfo;
};

export function useAforoInstallPrompt(): AforoInstallPromptState {
  const { isStandalone } = useAforoUiMode();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installStatus, setInstallStatus] = useState<'idle' | 'accepted' | 'dismissed' | 'error'>('idle');
  const [lastBeforeInstallPromptTs, setLastBeforeInstallPromptTs] = useState<number | null>(null);
  const [lastAppInstalledTs, setLastAppInstalledTs] = useState<number | null>(null);
  const [displayModeStandalone, setDisplayModeStandalone] = useState<boolean | null>(null);
  const [navigatorStandalone, setNavigatorStandalone] = useState<boolean | null>(null);
  const [pathname, setPathname] = useState('');
  const [userAgent, setUserAgent] = useState('');
  const [debugEnabled, setDebugEnabled] = useState(process.env.NODE_ENV === 'development');

  const isIosLike = useMemo(() => isIosSafariLike(), []);

  useEffect(() => {
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');

    const readEnvironment = () => {
      setDisplayModeStandalone(standaloneQuery.matches);
      setNavigatorStandalone(
        'standalone' in navigator ? Boolean((navigator as Navigator & { standalone?: boolean }).standalone) : null,
      );
      setPathname(window.location.pathname);
      setUserAgent(navigator.userAgent);
    };

    const hasDebugParam = new URLSearchParams(window.location.search).get('pwaDebug') === '1';
    if (hasDebugParam) {
      setDebugEnabled(true);
    }

    const onDisplayModeChange = () => {
      readEnvironment();
    };

    const onBeforeInstallPrompt = (event: Event) => {
      debugLog('beforeinstallprompt received');
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setLastBeforeInstallPromptTs(Date.now());
      setInstallStatus('idle');
      debugLog('beforeinstallprompt prevented and stored');
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setInstallStatus('accepted');
      setLastAppInstalledTs(Date.now());
      debugLog('appinstalled received');
    };

    readEnvironment();

    standaloneQuery.addEventListener('change', onDisplayModeChange);
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      standaloneQuery.removeEventListener('change', onDisplayModeChange);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      return;
    }

    try {
      debugLog('install prompt opened');
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setInstallStatus(choice.outcome === 'accepted' ? 'accepted' : 'dismissed');
      debugLog(`install prompt outcome: ${choice.outcome}`);
    } catch {
      setInstallStatus('error');
      debugLog('install prompt outcome: error');
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const isInstallAvailable = Boolean(deferredPrompt) && !isStandalone;
  const isInstalled = isStandalone;
  const canShowManualInstructions = isIosLike && !isStandalone;

  return {
    isInstallAvailable,
    isInstalled,
    isIosLike,
    canShowManualInstructions,
    installStatus,
    installApp,
    debugInfo: {
      debugEnabled,
      isStandalone,
      isInstallAvailable,
      isInstalled,
      isIosLike,
      canShowManualInstructions,
      installStatus,
      hasDeferredPrompt: Boolean(deferredPrompt),
      displayModeStandalone,
      navigatorStandalone,
      pathname,
      userAgent: summarizeUserAgent(userAgent),
      isAndroidChromeLike: isAndroidChromeLike(userAgent),
      lastBeforeInstallPromptAt: toIsoTimestamp(lastBeforeInstallPromptTs),
      lastAppInstalledAt: toIsoTimestamp(lastAppInstalledTs),
    },
  };
}
