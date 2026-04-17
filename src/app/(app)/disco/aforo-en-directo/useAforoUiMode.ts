'use client';

import { useEffect, useState } from 'react';

export type AforoUiMode = 'compact' | 'comfortable' | 'full';

export type AforoUiContext = {
  uiMode: AforoUiMode;
  isStandalone: boolean;
  isTouchPrimary: boolean;
  viewportWidth: number | null;
};

const COMPACT_MAX_WIDTH = 768;
const FULL_MIN_WIDTH = 1280;

const DEFAULT_CONTEXT: AforoUiContext = {
  uiMode: 'comfortable',
  isStandalone: false,
  isTouchPrimary: false,
  viewportWidth: null,
};

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

function getStandaloneState(query: MediaQueryList) {
  const iosStandalone =
    typeof navigator !== 'undefined' &&
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return query.matches || iosStandalone;
}

function resolveUiMode(isStandalone: boolean, viewportWidth: number): AforoUiMode {
  if (isStandalone || viewportWidth < COMPACT_MAX_WIDTH) return 'compact';
  if (viewportWidth >= FULL_MIN_WIDTH) return 'full';
  return 'comfortable';
}

export function useAforoUiMode(): AforoUiContext {
  const [context, setContext] = useState<AforoUiContext>(DEFAULT_CONTEXT);

  useEffect(() => {
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)');

    const readContext = () => {
      const viewportWidth = window.innerWidth;
      const isStandalone = getStandaloneState(standaloneQuery);
      const isTouchPrimary = coarsePointerQuery.matches;

      setContext({
        viewportWidth,
        isStandalone,
        isTouchPrimary,
        uiMode: resolveUiMode(isStandalone, viewportWidth),
      });
    };

    const subscribeMedia = (query: MediaQueryList, handler: () => void) => {
      const legacyQuery = query as LegacyMediaQueryList;

      if (typeof legacyQuery.addEventListener === 'function') {
        legacyQuery.addEventListener('change', handler);
        return () => legacyQuery.removeEventListener('change', handler);
      }

      legacyQuery.addListener?.(handler as (event: MediaQueryListEvent) => void);
      return () => legacyQuery.removeListener?.(handler as (event: MediaQueryListEvent) => void);
    };

    readContext();

    window.addEventListener('resize', readContext);
    const unsubscribeStandalone = subscribeMedia(standaloneQuery, readContext);
    const unsubscribePointer = subscribeMedia(coarsePointerQuery, readContext);

    return () => {
      window.removeEventListener('resize', readContext);
      unsubscribeStandalone();
      unsubscribePointer();
    };
  }, []);

  return context;
}
