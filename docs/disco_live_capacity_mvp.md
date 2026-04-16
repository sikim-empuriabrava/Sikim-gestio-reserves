# Disco · Aforo en directo (MVP fase 1)

## Alcance de esta fase

Esta iteración implementa solo el bloque **Disco > Aforo en directo** con foco operativo en puerta/seguridad:

- abrir sesión de aforo,
- sumar/restar aforo en tiempo real,
- cerrar sesión,
- ver estado actual, pico de sesión y últimos eventos.

### Fuera de alcance explícito

- histórico multi-sesión,
- dashboards y comparativas,
- agregados por ventana temporal,
- incidencias de mantenimiento,
- realtime avanzado (websocket/subscriptions),
- integración con facturación/POS para analítica.

## Modelo de datos creado

Se añade una migración nueva con:

1. `public.discotheque_capacity_sessions`
   - una sola sesión abierta por `venue_slug` (índice único parcial),
   - contadores `current_count` y `peak_count`,
   - metadatos de apertura/cierre y timestamps.

2. `public.discotheque_capacity_events`
   - eventos crudos (`delta`, `resulting_count`) por sesión,
   - actor y timestamp,
   - FK con `on delete cascade` hacia sesiones.

3. Funciones SQL para operaciones atómicas:
   - `open_discotheque_capacity_session(...)`,
   - `adjust_discotheque_capacity(...)`,
   - `close_discotheque_capacity_session(...)`.

Estas funciones resuelven las validaciones críticas en servidor/DB:
- no abrir doble sesión,
- no operar sin sesión abierta,
- no permitir aforo por debajo de 0,
- actualizar `peak_count` al alza automáticamente.

## Permisos (MVP)

Se añaden dos flags en `public.app_allowed_users`:

- `view_live_capacity`
- `manage_live_capacity`

Regla aplicada en app:

- puede **ver** si es admin o tiene `view_live_capacity` o `manage_live_capacity`,
- puede **operar** (abrir/cerrar/+1/-1) si es admin o tiene `manage_live_capacity`.

Además, se expone este control también en Admin > Usuarios para facilitar altas y ajustes de permisos.

## Navegación

Se añade el grupo sidebar:

- `Disco`
  - `Aforo en directo` (`/disco/aforo-en-directo`)

## Qué queda para la siguiente fase

1. Histórico navegable por fechas/sesiones cerradas.
2. Métricas agregadas y paneles (picos por franja, throughput, etc.).
3. Comparativas entre sesiones/días.
4. Posible polling configurable/realtime si la operativa lo exige.
5. Auditoría extendida (motivos/tipos de ajuste) si negocio lo requiere.
