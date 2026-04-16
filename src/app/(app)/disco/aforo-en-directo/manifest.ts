import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/disco/aforo-en-directo',
    name: 'Sikim Aforo',
    short_name: 'Sikim Aforo',
    description: 'Control operativo de puerta para el aforo en directo de Sikim.',
    start_url: '/disco/aforo-en-directo',
    scope: '/disco/aforo-en-directo',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    orientation: 'portrait',
    lang: 'es-ES',
    icons: [
      {
        src: '/disco/aforo-en-directo/pwa-icon-192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/disco/aforo-en-directo/pwa-icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/disco/aforo-en-directo/pwa-apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
