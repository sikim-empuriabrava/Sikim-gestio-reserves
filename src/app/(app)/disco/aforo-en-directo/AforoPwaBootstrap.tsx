'use client';

import { useEffect } from 'react';

const AFORO_SCOPE = '/disco/aforo-en-directo';
const AFORO_PWA_ACTIVE_CLASS = 'aforo-pwa-active';
const AFORO_ROUTE_ACTIVE_CLASS = 'aforo-live-capacity-route';

export function AforoPwaBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!window.location.pathname.startsWith(AFORO_SCOPE)) {
      return;
    }

    document.documentElement.classList.add(AFORO_PWA_ACTIVE_CLASS, AFORO_ROUTE_ACTIVE_CLASS);

    return () => {
      document.documentElement.classList.remove(AFORO_PWA_ACTIVE_CLASS, AFORO_ROUTE_ACTIVE_CLASS);
    };
  }, []);

  return null;
}
