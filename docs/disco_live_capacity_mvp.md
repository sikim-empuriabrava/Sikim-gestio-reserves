# Disco · Aforo (fase 1 + fase 2 básica)

## Estado actual del bloque

Actualmente el módulo Disco incluye dos piezas operativas:

1. **Aforo en directo** (`/disco/aforo-en-directo`)
   - abrir sesión de aforo,
   - sumar/restar aforo en tiempo casi real,
   - cerrar sesión,
   - ver estado actual, pico de sesión y últimos eventos.

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
- **Histórico aforo**: acceso restringido a **admin** en esta iteración.

> En esta fase no se crean nuevos flags de permisos en `app_allowed_users` para histórico.

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
