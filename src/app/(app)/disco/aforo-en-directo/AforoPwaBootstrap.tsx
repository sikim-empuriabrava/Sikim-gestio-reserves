'use client';

import { useEffect } from 'react';

const AFORO_SW_URL = '/aforo-sw.js';
const AFORO_SCOPE = '/disco/aforo-en-directo';
const AFORO_PWA_ACTIVE_CLASS = 'aforo-pwa-active';
const AFORO_ROUTE_ACTIVE_CLASS = 'aforo-live-capacity-route';
const AFORO_PWA_COOKIE = 'sikim_aforo_pwa=1; path=/; max-age=86400; samesite=lax';

export function AforoPwaBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!window.location.pathname.startsWith(AFORO_SCOPE)) {
      return;
    }

    document.documentElement.classList.add(AFORO_PWA_ACTIVE_CLASS, AFORO_ROUTE_ACTIVE_CLASS);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

    if (isStandalone) {
      document.cookie = AFORO_PWA_COOKIE;
    }

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register(AFORO_SW_URL, {
        scope: AFORO_SCOPE,
      });
    }

    return () => {
      document.documentElement.classList.remove(AFORO_PWA_ACTIVE_CLASS, AFORO_ROUTE_ACTIVE_CLASS);
    };
  }, []);

  return null;
}
