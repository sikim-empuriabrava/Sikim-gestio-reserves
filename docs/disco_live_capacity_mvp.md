# Disco · Aforo (fase 1 + fase 2 básica)

## Estado actual del bloque

Actualmente el módulo Disco incluye dos piezas operativas:

1. **Aforo en directo** (`/disco/aforo-en-directo`)
   - abrir sesión de aforo,
   - sumar/restar aforo con refresco automático conservador entre usuarios autenticados,
   - cerrar sesión,
   - ver estado actual, pico de sesión, hora del pico y últimos eventos.

2. **Histórico aforo (básico)** (`/disco/historico-aforo`)
   - lista navegable de sesiones cerradas (últimas 50),
   - filtros rápidos por rango (hoy, 7 días, 30 días, todas),
   - detalle de una sesión con cronología completa de eventos,
   - métricas básicas derivadas por sesión.

## Modelo de datos reutilizado

No se añaden tablas nuevas en esta fase de histórico. Se reutiliza el modelo del MVP de aforo en directo:

1. `public.discotheque_capacity_sessions`
   - sesión por recinto (`venue_slug`),
   - estado `open/closed`,
   - contadores `current_count` y `peak_count`,
   - metadatos de apertura/cierre.

2. `public.discotheque_capacity_events`
   - eventos crudos (`delta`, `resulting_count`) por sesión,
   - actor, nota opcional y timestamp,
   - FK a sesión con borrado en cascada.

3. Funciones SQL atómicas existentes:
   - `open_discotheque_capacity_session(...)`,
   - `adjust_discotheque_capacity(...)`,
   - `close_discotheque_capacity_session(...)`.

## Permisos aplicados

- **Aforo en directo**: mantiene la lógica actual.
  - lectura: admin o `view_live_capacity` / `manage_live_capacity`,
  - operación: admin o `manage_live_capacity`.
  - no existe modo invitado: cualquier acceso sin sesión a `/disco/aforo-en-directo` redirige a `/login?next=/disco/aforo-en-directo`.
- **Histórico aforo**: acceso restringido a **admin** en esta iteración.

> En esta fase no se crean nuevos flags de permisos en `app_allowed_users` para histórico.

### Fuente de verdad de autorización

- La autorización sensible se resuelve contra `app_allowed_users` (no desde `user_metadata`).
- `role = admin` actúa como bypass total de permisos de módulo.
- Para usuarios no admin en Disco:
  - `view_live_capacity = true` permite ver `/disco/aforo-en-directo`.
  - `manage_live_capacity = true` permite operar acciones (abrir/cerrar sesión, sumar/restar aforo).
  - `manage_live_capacity` también habilita lectura del módulo (implica capacidad de ver).

### Login operativo (puerta/aforo)

- Se mantiene el login Google OAuth existente.
- Se añade login secundario por usuario + contraseña usando Supabase Auth Email/Password.
- El campo usuario se normaliza (`trim`, `lowercase`, sin espacios y con caracteres limitados) y se transforma a:
  - `${usuario}@sikimempuriabrava.com`
- El inicio de sesión se ejecuta con `signInWithPassword`.

## Métricas básicas del histórico

En cada sesión cerrada se calculan y muestran:

- `total_entries`: suma de deltas positivos,
- `total_exits`: suma absoluta de deltas negativos,
- `event_count`: número total de eventos,
- `duration_minutes`: minutos entre apertura y cierre.

## Fuera de alcance explícito (fase posterior)

- dashboards avanzados y comparativas entre sesiones,
- medias de llegadas/salidas por hora,
- buckets temporales (p.ej. 10 minutos),
- exportación CSV,
- realtime/subscriptions para histórico,
- correlación con facturación o POS,
- permisos granulares específicos para histórico.

## UI adaptativa en Aforo en directo (solo este bloque)

La pantalla `/disco/aforo-en-directo` adapta su interfaz de forma automática en cliente usando tres señales:

- ancho de viewport (`window.innerWidth`),
- puntero principal táctil (`matchMedia('(pointer: coarse)')`),
- modo PWA instalada (`matchMedia('(display-mode: standalone)')`, con soporte iOS standalone).

Se definen tres modos de UI para **LiveCapacityPanel**:

- `compact`: cuando está en standalone o cuando el viewport es `< 768`.
- `comfortable`: cuando el viewport es `>= 768` y `< 1280`.
- `full`: cuando el viewport es `>= 1280`.

Esta lógica está encapsulada en un hook cliente y **no se aplica como política global** del resto de la app; su alcance queda limitado al bloque de Aforo en directo.

## Refresco y pico de sesión

- `LiveCapacityPanel` consulta `GET /api/disco/live-capacity` cada pocos segundos mientras la pantalla está visible.
- El polling se omite durante ajustes locales pendientes para no pisar la respuesta optimista del operador.
- La hora del pico se deriva de `discotheque_capacity_events` buscando el primer evento de la sesión activa cuyo `resulting_count` coincide con `peak_count`.
- Si `peak_count` es `0` o no existe evento coincidente, la UI muestra `—`.
