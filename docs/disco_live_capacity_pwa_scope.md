# PWA limitada a Disco · Aforo en directo (MVP)

## Estado actual
La experiencia PWA está **acotada exclusivamente** a la ruta:

- `/disco/aforo-en-directo`

Esto significa que **Sikim no se convierte en una PWA global** todavía; la instalación permanece parcial y limitada al módulo de Aforo.

## Qué incluye este MVP
- Manifest específico de Aforo (`Sikim Aforo`) servido como recurso real estático en:
  - `/disco/aforo-en-directo/manifest.webmanifest`
  - origen de archivo: `public/disco/aforo-en-directo/manifest.webmanifest`
- `start_url` limitado a `/disco/aforo-en-directo`.
- `scope` del manifest configurado como `/` para permitir el flujo instalado por `/login` y `/auth/callback`.
- Modo de visualización `standalone`.
- Iconos de instalación PWA servidos desde assets estáticos reales en `public/branding/`:
  - `/branding/sikim-app-icon-192.png` (192x192)
  - `/branding/sikim-app-icon-512.png` (512x512)
  - `/branding/sikim-app-icon-maskable-512.png` (512x512, `purpose: maskable`)
  - Apple touch icon: `/branding/sikim-app-apple-180.png` (180x180) en metadata de la página de Aforo.
  - Este enfoque evita inconsistencias de render/cropping del pipeline dinámico y mejora la estabilidad del icono instalado en Android/iOS.
- Service Worker mínimo (`/aforo-sw.js`) con cache prudente de assets estáticos (`style`, `script`, `font`, `image`).
- Registro del Service Worker **solo** al renderizar `/disco/aforo-en-directo`.
- CTA propio de instalación en la pantalla de Aforo (`Instalar app`), encapsulado en cliente y mostrado solo en `/disco/aforo-en-directo`.
- En la UI operativa, las acciones de sesión (`Abrir sesión` / `Cerrar sesión`) quedan en una franja superior separada para no competir visualmente con los botones de conteo rápido.
- En Android/Chrome, el CTA usa `beforeinstallprompt` (capturado con `preventDefault`) para disparar `prompt()` manualmente cuando el navegador lo permite.
- En iPhone/Safari se mantiene el flujo manual nativo (`Compartir → Añadir a pantalla de inicio`) con ayuda textual breve, sin forzar instalación programática.
- Modo temporal de troubleshooting PWA: panel debug visible en desarrollo o activando `?pwaDebug=1` para diagnosticar `beforeinstallprompt`/estado de instalación.
- El icono de pestaña (favicon global) usa branding real de Sikim desde rutas públicas:
  - `/branding/sikim-app-logo.png`
  - `/branding/sikim-app-logo.svg`
- `/branding/` está exento de middleware/auth para que el favicon global cargue también en `/login` y páginas públicas.
- La PWA se mantiene parcial y limitada operativamente a Aforo: `start_url`, middleware, cookie/allowed paths, comportamiento de ruta, Service Worker y CTA de instalación están acotados a este flujo.
- La PWA no habilita modo invitado: si se abre instalada sin sesión activa, el usuario debe iniciar sesión y volver a `/disco/aforo-en-directo`.

## Aislamiento visual de standalone
- El cliente de Aforo activa la clase `aforo-pwa-active` en `<html>` mientras la pantalla está montada.
- Los ajustes visuales de modo instalado se aplican únicamente cuando se cumplen ambas condiciones:
  1. `display-mode: standalone`
  2. `html.aforo-pwa-active`
- Con esto se evita afectar futuras PWAs parciales o un standalone global de toda la app.

## Seguridad y cache del Service Worker
- La PWA de Aforo **no cachea HTML protegido** de `/disco/aforo-en-directo`.
- Las navegaciones HTML de Aforo no tienen fallback offline desde cache.
- En offline la pantalla operativa puede no renderizarse, por decisión deliberada de seguridad.
- La limpieza de caches en `activate` se limita a claves propias del SW (`sikim-aforo-sw-*`) para no interferir con otras caches del mismo origen.
- Las llamadas live (`GET/POST /api/disco/live-capacity`) siguen pasando por autenticación y no se cachean; el panel usa polling ligero solo mientras la app está visible.

## Qué NO incluye (fuera de alcance)
- No hay PWA global en todo Sikim.
- No hay sincronización offline de negocio ni cola offline compleja.
- No hay cache agresivo de APIs de datos live.
- No hay push notifications.

## Detalles técnicos de scope
1. El manifest de Aforo define:
   - `start_url: /disco/aforo-en-directo`
   - `scope: /`
   - El `scope` amplio permite que una PWA instalada pueda completar `/login` y `/auth/callback` sin salirse del contexto instalado.
2. El Service Worker se registra con:
   - `scope: /disco/aforo-en-directo`
3. Middleware y cookie PWA restringen las rutas permitidas del contexto instalado a `/login`, `/auth/callback`, `/disco/aforo-en-directo` y APIs mínimas necesarias.
4. El SW evita interceptar `POST` y llamadas `/api/*` para no afectar autenticación ni flujo de datos live.

## Limitación real a tener en cuenta
Algunas plataformas (especialmente iOS Safari) aplican variaciones en cuándo muestran la opción de instalación y en cómo cachean recursos. El enfoque actual minimiza impacto global y mantiene el comportamiento operativo actual, pero la UX exacta de instalación puede variar según versión de SO/navegador.

## Evolución futura sugerida (PWA general)
Cuando se quiera una PWA global, habrá que definir explícitamente:
- manifest raíz único para toda la app,
- estrategia de cache por módulo,
- políticas de actualización de SW,
- soporte offline por caso de uso,
- consideraciones de push y seguridad operativa.
