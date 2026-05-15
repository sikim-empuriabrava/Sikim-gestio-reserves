# PWA global segura

## Estado actual

Sikim se publica como PWA global de la app interna, no como una PWA limitada al modulo de Aforo.

- Manifest principal: `/manifest.webmanifest`.
- `start_url`: `/`.
- `scope`: `/`.
- Modo: `standalone`.
- Iconos: assets estaticos de `public/branding/`.
- Service Worker: `/aforo-sw.js`, registrado con scope `/`.

El nombre del Service Worker conserva el nombre historico de Aforo por compatibilidad con instalaciones anteriores, pero su comportamiento es global y conservador.

## Auth y permisos

La PWA no habilita acceso anonimo. Cualquier pantalla interna sigue requiriendo:

- sesion activa de Supabase;
- usuario presente en `app_allowed_users`;
- `is_active = true`;
- permisos del modulo correspondiente.

Sin sesion, las rutas internas redirigen a `/login`. Esto aplica tanto en navegador normal como en standalone/PWA.

Si un usuario inicia sesion pero no esta allowlisted o esta inactivo, se devuelve a `/login?error=not_allowed` y el flujo de callback cierra la sesion para no mantenerlo dentro de una sesion sin permisos.

La ruta raiz `/` es permission-aware:

- admin y usuarios con Reservas: `/reservas?view=week`;
- usuarios con Aforo segun la prioridad operativa actual: `/disco/aforo-en-directo`;
- usuarios con Mantenimiento: `/mantenimiento`;
- usuarios con Cocina: `/cocina`;
- usuarios con Cheffing: `/cheffing`.

Los usuarios con solo permisos de aforo (`view_live_capacity` o `manage_live_capacity`, sin permisos de Reservas, Cocina, Mantenimiento ni Cheffing, y sin rol admin) se envian tras login a:

- `/disco/aforo-en-directo`

Admin y usuarios con permisos mixtos mantienen el flujo general existente.

## Cache

La PWA es online-first para datos privados.

El Service Worker no cachea:

- navegaciones HTML;
- respuestas de `/api/*`;
- contenido de negocio;
- imagenes servidas por optimizadores o rutas no estaticas.

Solo cachea assets estaticos seguros:

- scripts, estilos y fuentes bajo `/_next/static/`;
- imagenes de branding bajo `/branding/` y la ruta legacy de branding de Aforo;
- `favicon.ico`.

Las respuestas protegidas pasan por middleware con cabeceras `no-store` para reducir el riesgo de ver pantallas internas antiguas al cerrar sesion o reabrir la PWA. El middleware no fuerza `no-store` sobre assets publicos seguros como manifest, iconos, favicon, Service Worker o `/_next/static/`.

## Aforo en PWA

La pantalla `/disco/aforo-en-directo` conserva:

- CTA de instalacion;
- ajustes visuales propios de standalone;
- permisos `view_live_capacity` y `manage_live_capacity`;
- datos live online, sin modo offline privado.

El historico de aforo sigue fuera del uso operativo de puerta y se mantiene restringido a admin.
