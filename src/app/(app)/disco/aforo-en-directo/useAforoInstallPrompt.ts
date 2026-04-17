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

export type AforoInstallPromptState = {
  isInstallAvailable: boolean;
  isInstalled: boolean;
  isIosLike: boolean;
  canShowManualInstructions: boolean;
  installStatus: 'idle' | 'accepted' | 'dismissed' | 'error';
  installApp: () => Promise<void>;
};

export function useAforoInstallPrompt(): AforoInstallPromptState {
  const { isStandalone } = useAforoUiMode();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installStatus, setInstallStatus] = useState<'idle' | 'accepted' | 'dismissed' | 'error'>('idle');

  const isIosLike = useMemo(() => isIosSafariLike(), []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setInstallStatus('idle');
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setInstallStatus('accepted');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setInstallStatus(choice.outcome === 'accepted' ? 'accepted' : 'dismissed');
    } catch {
      setInstallStatus('error');
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  return {
    isInstallAvailable: Boolean(deferredPrompt) && !isStandalone,
    isInstalled: isStandalone,
    isIosLike,
    canShowManualInstructions: isIosLike && !isStandalone,
    installStatus,
    installApp,
  };
}
