# Disco - Aforo en directo e historico

## Estado actual del bloque

Actualmente el modulo Disco incluye tres rutas operativas:

1. **Aforo en directo** (`/disco/aforo-en-directo`)
   - abrir sesion de aforo;
   - sumar/restar aforo con refresco automatico conservador entre usuarios autenticados;
   - cerrar sesion;
   - ver estado actual, pico de sesion, hora del pico y ultimos eventos.

2. **Historico de aforo** (`/disco/historico-aforo`)
   - dashboard de sesiones cerradas;
   - pestanas `Sesiones` e `Insights`;
   - tabla/listado de sesiones cerradas;
   - filtros rapidos por rango (`Hoy`, `Ultimos 7 dias`, `Ultimos 30 dias`, `Todas`);
   - filtros manuales por fecha (`from`/`to`);
   - filtros por dia de la semana mediante `weekdays`;
   - query params compartibles para conservar tab, rango, fechas y weekdays;
   - metricas/KPIs agregados del rango filtrado;
   - graficos con Recharts para evolucion media, entradas registradas por sesion, pico maximo por sesion y comparativa por dia de semana.

3. **Detalle de sesion** (`/disco/historico-aforo/[sessionId]`)
   - resumen de la sesion cerrada;
   - metricas de pico, aforo final, entradas registradas, salidas y movimientos;
   - grafico de evolucion temporal de la sesion;
   - cronologia completa de movimientos con delta, resultado, usuario y nota.

## Modelo de datos reutilizado

No se anaden tablas nuevas para el historico. Se reutiliza el modelo del MVP de aforo en directo:

1. `public.discotheque_capacity_sessions`
   - sesion por recinto (`venue_slug`);
   - estado `open/closed`;
   - contadores `current_count` y `peak_count`;
   - metadatos de apertura/cierre.

2. `public.discotheque_capacity_events`
   - eventos crudos (`delta`, `resulting_count`) por sesion;
   - actor, nota opcional y timestamp;
   - FK a sesion con borrado en cascada.

3. Funciones SQL atomicas existentes:
   - `open_discotheque_capacity_session(...)`;
   - `adjust_discotheque_capacity(...)`;
   - `close_discotheque_capacity_session(...)`.

## Permisos aplicados

- **Aforo en directo**:
  - lectura: admin o `view_live_capacity` / `manage_live_capacity`;
  - operacion: admin o `manage_live_capacity`;
  - no existe acceso anonimo/publico: cualquier acceso sin sesion a `/disco/aforo-en-directo` pasa por login.
- **Historico de aforo**:
  - acceso restringido a **admin** en el codigo actual (`requireCapacityHistoryAdmin`);
  - no hay flags granulares especificos para historico en `app_allowed_users`.

### Fuente de verdad de autorizacion

- La autorizacion sensible se resuelve contra `app_allowed_users` (no desde `user_metadata`).
- `role = admin` actua como bypass total de permisos de modulo.
- Para usuarios no admin en Disco:
  - `view_live_capacity = true` permite ver `/disco/aforo-en-directo`;
  - `manage_live_capacity = true` permite operar acciones (abrir/cerrar sesion, sumar/restar aforo);
  - `manage_live_capacity` tambien habilita lectura del modulo (implica capacidad de ver).

### Login operativo (puerta/aforo)

- Se mantiene el login Google OAuth existente.
- Se anade login secundario por usuario + contrasena usando Supabase Auth Email/Password.
- El uso operativo puede hacerse con un usuario/contrasena compartible y permisos limitados, pero sigue siendo un acceso autenticado y controlado por `app_allowed_users`.
- El campo usuario se normaliza (`trim`, `lowercase`, sin espacios y con caracteres limitados) y se transforma a:
  - `${usuario}@sikimempuriabrava.com`
- El inicio de sesion se ejecuta con `signInWithPassword`.

## Metricas del historico

En el historico se muestran metricas por sesion y agregadas por rango filtrado:

- `total_entries`: entradas registradas, calculadas como suma de deltas positivos;
- `total_exits`: salidas registradas, calculadas como suma absoluta de deltas negativos;
- `event_count`: movimientos registrados;
- `duration_minutes`: minutos entre apertura y cierre;
- `peak_count`: pico maximo guardado en la sesion;
- `current_count`: aforo final al cerrar la sesion;
- `peak_time_at`: primer movimiento que alcanza el pico maximo;
- promedios agregados: pico medio, aforo final medio y duracion media;
- mejores sesiones por pico maximo y por entradas registradas;
- dia con mayor afluencia registrada en el rango;
- hora aproximada de mayor aforo medio, derivada de la evolucion media por franjas de 15 minutos.

Importante: estas metricas no identifican personas unicas. El sistema registra movimientos y entradas/salidas; una misma persona puede salir y volver a entrar.

## Timezone operativo

El historico usa `Europe/Madrid` como zona horaria operativa (`DISCO_TIME_ZONE`) y formateo con `Intl.DateTimeFormat`.

No se deben introducir offsets fijos tipo `+1` o `+2`: los cambios de horario de verano/invierno deben quedar delegados a la base IANA del runtime.

## Fuera de alcance explicito

- exportacion CSV;
- realtime/subscriptions para historico;
- correlacion con facturacion o POS;
- permisos granulares especificos para historico;
- identificacion de personas unicas.

## UI adaptativa en Aforo en directo (solo este bloque)

La pantalla `/disco/aforo-en-directo` adapta su interfaz de forma automatica en cliente usando tres senales:

- ancho de viewport (`window.innerWidth`);
- puntero principal tactil (`matchMedia('(pointer: coarse)')`);
- modo PWA instalada (`matchMedia('(display-mode: standalone)')`, con soporte iOS standalone).

Se definen tres modos de UI para **LiveCapacityPanel**:

- `compact`: cuando esta en standalone o cuando el viewport es `< 768`;
- `comfortable`: cuando el viewport es `>= 768` y `< 1280`;
- `full`: cuando el viewport es `>= 1280`.

Esta logica esta encapsulada en un hook cliente y no se aplica como politica global del resto de la app; su alcance queda limitado al bloque de Aforo en directo.

## Refresco y pico de sesion

- `LiveCapacityPanel` consulta `GET /api/disco/live-capacity` cada pocos segundos mientras la pantalla esta visible.
- El polling se omite durante ajustes locales pendientes para no pisar la respuesta optimista del operador.
- La hora del pico se deriva de `discotheque_capacity_events` buscando el primer evento de la sesion activa cuyo `resulting_count` coincide con `peak_count`.
- Si `peak_count` es `0` o no existe evento coincidente, la UI muestra `-`.
