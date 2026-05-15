'use client';

import { useEffect } from 'react';

const SERVICE_WORKER_URL = '/aforo-sw.js';

export function PwaBootstrap() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    void navigator.serviceWorker.register(SERVICE_WORKER_URL, {
      scope: '/',
    });
  }, []);

  return null;
}
