# PWA limitada a Disco - Aforo en directo

## Estado actual

La experiencia PWA esta acotada exclusivamente a la ruta:

- `/disco/aforo-en-directo`

Esto significa que Sikim no se convierte en una PWA global; la instalacion permanece parcial y limitada al modulo de Aforo.

La PWA tampoco habilita acceso anonimo. Si se abre instalada sin sesion activa, el usuario debe iniciar sesion y volver a `/disco/aforo-en-directo`.

## Acceso operativo restringido

El uso operativo de puerta/aforo puede hacerse con un usuario/contrasena compartible y permisos limitados. Ese usuario sigue siendo una cuenta autenticada:

- debe iniciar sesion;
- debe existir en `app_allowed_users`;
- debe estar activo;
- debe tener permisos adecuados;
- `view_live_capacity` permite ver aforo en directo;
- `manage_live_capacity` permite operar acciones (abrir/cerrar sesion y sumar/restar aforo).

Evitar documentar este flujo como acceso publico o anonimo. La formulacion correcta es: acceso operativo restringido mediante usuario compartible con permisos limitados.

El historico de aforo no forma parte de la PWA operativa y sigue restringido a admin en el codigo actual.

## Que incluye

- Manifest especifico de Aforo (`Sikim Aforo`) servido como recurso real estatico en:
  - `/disco/aforo-en-directo/manifest.webmanifest`
  - origen de archivo: `public/disco/aforo-en-directo/manifest.webmanifest`
- `start_url` limitado a `/disco/aforo-en-directo`.
- `scope` del manifest configurado como `/` para permitir el flujo instalado por `/login` y `/auth/callback`.
- Modo de visualizacion `standalone`.
- Iconos de instalacion PWA servidos desde assets estaticos reales en `public/branding/`:
  - `/branding/sikim-app-icon-192.png` (192x192)
  - `/branding/sikim-app-icon-512.png` (512x512)
  - `/branding/sikim-app-icon-maskable-512.png` (512x512, `purpose: maskable`)
  - Apple touch icon: `/branding/sikim-app-apple-180.png` (180x180) en metadata de la pagina de Aforo.
- Service Worker minimo (`/aforo-sw.js`) con cache prudente de assets estaticos (`style`, `script`, `font`, `image`).
- Registro del Service Worker solo al renderizar `/disco/aforo-en-directo`.
- CTA propio de instalacion en la pantalla de Aforo (`Instalar app`), encapsulado en cliente y mostrado solo en `/disco/aforo-en-directo`.
- En la UI operativa, las acciones de sesion (`Abrir sesion` / `Cerrar sesion`) quedan en una franja superior separada para no competir visualmente con los botones de conteo rapido.
- En Android/Chrome, el CTA usa `beforeinstallprompt` (capturado con `preventDefault`) para disparar `prompt()` manualmente cuando el navegador lo permite.
- En iPhone/Safari se mantiene el flujo manual nativo (`Compartir -> Anadir a pantalla de inicio`) con ayuda textual breve, sin forzar instalacion programatica.
- Modo temporal de troubleshooting PWA: panel debug visible en desarrollo o activando `?pwaDebug=1` para diagnosticar `beforeinstallprompt`/estado de instalacion.
- El icono de pestana (favicon global) usa branding real de Sikim desde rutas publicas:
  - `/branding/sikim-app-logo.png`
  - `/branding/sikim-app-logo.svg`
- `/branding/` esta exento de middleware/auth para que el favicon global cargue tambien en `/login` y paginas publicas.
- La PWA se mantiene parcial y limitada operativamente a Aforo: `start_url`, middleware, cookie/allowed paths, comportamiento de ruta, Service Worker y CTA de instalacion estan acotados a este flujo.

## Aislamiento visual de standalone

- El cliente de Aforo activa la clase `aforo-pwa-active` en `<html>` mientras la pantalla esta montada.
- Los ajustes visuales de modo instalado se aplican unicamente cuando se cumplen ambas condiciones:
  1. `display-mode: standalone`
  2. `html.aforo-pwa-active`
- Con esto se evita afectar futuras PWAs parciales o un standalone global de toda la app.

## Seguridad y cache del Service Worker

- La PWA de Aforo no cachea HTML protegido de `/disco/aforo-en-directo`.
- Las navegaciones HTML de Aforo no tienen fallback offline desde cache.
- En offline la pantalla operativa puede no renderizarse, por decision deliberada de seguridad.
- La limpieza de caches en `activate` se limita a claves propias del SW (`sikim-aforo-sw-*`) para no interferir con otras caches del mismo origen.
- Las llamadas live (`GET/POST /api/disco/live-capacity`) siguen pasando por autenticacion y no se cachean.
- El Service Worker evita interceptar `POST` y llamadas `/api/*` para no afectar autenticacion ni flujo de datos live.
- El panel usa polling ligero solo mientras la app esta visible.

## Que NO incluye (fuera de alcance)

- No hay PWA global en todo Sikim.
- No hay acceso anonimo/publico al aforo.
- No hay PWA para `/disco/historico-aforo` ni para `/disco/historico-aforo/[sessionId]`.
- No hay sincronizacion offline de negocio ni cola offline compleja.
- No hay cache agresivo de APIs de datos live.
- No hay push notifications.

## Detalles tecnicos de scope

1. El manifest de Aforo define:
   - `start_url: /disco/aforo-en-directo`
   - `scope: /`
   - El `scope` amplio permite que una PWA instalada pueda completar `/login` y `/auth/callback` sin salirse del contexto instalado.
2. El Service Worker se registra con:
   - `scope: /disco/aforo-en-directo`
3. Middleware y cookie PWA restringen las rutas permitidas del contexto instalado a `/login`, `/auth/callback`, `/disco/aforo-en-directo` y APIs minimas necesarias.
4. El SW evita interceptar `POST` y llamadas `/api/*` para no afectar autenticacion ni flujo de datos live.

## Limitacion real a tener en cuenta

Algunas plataformas, especialmente iOS Safari, aplican variaciones en cuando muestran la opcion de instalacion y en como cachean recursos. El enfoque actual minimiza impacto global y mantiene el comportamiento operativo actual, pero la UX exacta de instalacion puede variar segun version de SO/navegador.

## Evolucion futura sugerida (PWA general)

Cuando se quiera una PWA global, habra que definir explicitamente:

- manifest raiz unico para toda la app;
- estrategia de cache por modulo;
- politicas de actualizacion de SW;
- soporte offline por caso de uso;
- consideraciones de push y seguridad operativa.
