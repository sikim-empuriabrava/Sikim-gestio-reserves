import type { Metadata } from 'next';
import { PwaBootstrap } from '@/components/PwaBootstrap';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gestor de Reservas | Sikim',
  description: 'Dashboard interno para gestionar reservas de restaurante y discoteca.',
  manifest: '/manifest.webmanifest',
  themeColor: '#020617',
  icons: {
    icon: [
      {
        url: '/branding/sikim-app-logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        url: '/branding/sikim-app-logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
    shortcut: [
      {
        url: '/branding/sikim-app-logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        url: '/branding/sikim-app-logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
    apple: [
      {
        url: '/branding/sikim-app-apple-180.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sikim',
  },
  formatDetection: {
    telephone: false,
  },
};

export const dynamic = 'force-dynamic';

const themeInitScript = `
(function () {
  var storageKey = 'sikim-theme-preference';
  var fallbackPreference = 'light';
  var allowed = { dark: true, light: true, system: true };

  function resolveTheme(preference) {
    if (preference === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }

    return preference === 'light' ? 'light' : 'dark';
  }

  try {
    var storedPreference = window.localStorage.getItem(storageKey);
    var preference = allowed[storedPreference] ? storedPreference : fallbackPreference;
    var theme = resolveTheme(preference);

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = fallbackPreference;
    document.documentElement.style.colorScheme = fallbackPreference;
  }
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans">
        <PwaBootstrap />
        <div className="sikim-app-background" aria-hidden="true" />
        <div className="relative min-h-screen">{children}</div>
      </body>
    </html>
  );
}
