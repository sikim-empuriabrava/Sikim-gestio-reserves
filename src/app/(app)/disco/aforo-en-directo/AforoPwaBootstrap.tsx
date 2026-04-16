'use client';

import { useEffect } from 'react';

const AFORO_SW_URL = '/aforo-sw.js';
const AFORO_SCOPE = '/disco/aforo-en-directo';

export function AforoPwaBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    if (!window.location.pathname.startsWith(AFORO_SCOPE)) {
      return;
    }

    void navigator.serviceWorker.register(AFORO_SW_URL, {
      scope: AFORO_SCOPE,
    });
  }, []);

  return null;
}
