'use client';

import { useEffect, useState } from 'react';

type ThemePreference = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'sikim-theme-preference';
const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'dark', label: 'Oscuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Sistema' },
];

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  if (!window.matchMedia) return 'dark';

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference;
}

function applyTheme(preference: ThemePreference) {
  const theme = resolveTheme(preference);

  try {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    // Keep Cheffing usable if the document root cannot be updated.
  }
}

export function CheffingThemeControl() {
  const [preference, setPreference] = useState<ThemePreference>('dark');

  useEffect(() => {
    let storedPreference: string | null = null;

    try {
      storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      storedPreference = null;
    }

    const nextPreference = isThemePreference(storedPreference) ? storedPreference : 'dark';

    setPreference(nextPreference);
    applyTheme(nextPreference);
  }, []);

  useEffect(() => {
    if (preference !== 'system') return;
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => applyTheme('system');

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [preference]);

  const handlePreferenceChange = (nextPreference: ThemePreference) => {
    setPreference(nextPreference);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    } catch {
      // The theme still applies for this page view if storage is unavailable.
    }

    applyTheme(nextPreference);
  };

  return (
    <div
      className="cheffing-theme-control flex w-max shrink-0 rounded-xl border p-0.5"
      role="radiogroup"
      aria-label="Tema de la aplicacion"
    >
      {THEME_OPTIONS.map((option) => {
        const isSelected = preference === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => handlePreferenceChange(option.value)}
            className={isSelected ? 'is-selected' : undefined}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
