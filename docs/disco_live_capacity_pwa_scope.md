# PWA limitada a Disco · Aforo en directo (MVP)

## Estado actual
La experiencia PWA está **acotada exclusivamente** a la ruta:

- `/disco/aforo-en-directo`

Esto significa que **Sikim no se convierte en una PWA global** todavía.

## Qué incluye este MVP
- Manifest específico de Aforo (`Sikim Aforo`) servido en:
  - `/disco/aforo-en-directo/manifest.webmanifest`
- `start_url` y `scope` limitados a `/disco/aforo-en-directo`.
- Modo de visualización `standalone`.
- Iconos generados para instalación (`icon` y `apple-icon`) dentro del segmento de Aforo.
- Service Worker mínimo (`/aforo-sw.js`) con cache prudente de shell/navegación de Aforo y assets estáticos.
- Registro del Service Worker **solo** al renderizar `/disco/aforo-en-directo`.

## Qué NO incluye (fuera de alcance)
- No hay PWA global en todo Sikim.
- No hay sincronización offline de negocio ni cola offline compleja.
- No hay cache agresivo de APIs de datos live.
- No hay push notifications.

## Detalles técnicos de scope
1. El manifest de Aforo define:
   - `start_url: /disco/aforo-en-directo`
   - `scope: /disco/aforo-en-directo`
2. El Service Worker se registra con:
   - `scope: /disco/aforo-en-directo`
3. El SW evita interceptar `POST` y llamadas `/api/*` para no afectar autenticación ni flujo de datos live.

## Limitación real a tener en cuenta
Algunas plataformas (especialmente iOS Safari) aplican variaciones en cuándo muestran la opción de instalación y en cómo cachean recursos. El enfoque actual minimiza impacto global y mantiene el comportamiento operativo actual, pero la UX exacta de instalación puede variar según versión de SO/navegador.

## Evolución futura sugerida (PWA general)
Cuando se quiera una PWA global, habrá que definir explícitamente:
- manifest raíz único para toda la app,
- estrategia de cache por módulo,
- políticas de actualización de SW,
- soporte offline por caso de uso,
- consideraciones de push y seguridad operativa.
