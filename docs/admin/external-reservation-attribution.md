# Admin: atribucion de reservas externas

La app interna expone el dashboard `/admin/reservas-externas/atribucion` para que un usuario con rol `admin` pueda analizar de donde llegan las solicitudes creadas por el motor publico de reservas.

## Que es la atribucion propia

La atribucion propia usa los datos que ya llegan con cada solicitud externa y los cruza con la reserva operativa interna. En esta fase sirve para responder dentro de la app:

- cuantas solicitudes externas han entrado;
- que origenes generan mas solicitudes;
- que campanas UTM generan mas solicitudes;
- cuantas solicitudes quedan pendientes, confirmadas, canceladas o no show;
- cuantos pax genera cada canal;
- que reserva operativa corresponde a cada solicitud.

## Diferencia con pixeles Meta o Google

Este dashboard no es un pixel publicitario y no mide conversiones desde el navegador del cliente.

La atribucion propia se basa en datos server-side guardados en `public.external_reservation_submissions` cuando el motor publico envia la solicitud a la app interna. Meta Pixel, Google Tag o conversion APIs son otra capa: permiten optimizacion publicitaria y medicion en plataformas externas, pero requieren una fase posterior con consentimiento, cookies/legal y configuracion de eventos.

Esta pantalla no anade:

- Meta Pixel;
- Google Tag;
- cookies;
- cambios de consentimiento;
- tracking nuevo en el formulario publico.

## Campos usados

La base del dashboard es `public.external_reservation_submissions`.

Campos de atribucion usados:

- `group_event_id`
- `source_label`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `referrer`
- `landing_page`
- `fbclid`
- `gclid`
- `ttclid`
- `preferred_language`
- `submitted_at`

La reserva operativa se obtiene con:

```txt
external_reservation_submissions.group_event_id = group_events.id
```

Campos operativos usados desde `public.group_events`:

- `id`
- `name`
- `event_date`
- `entry_time`
- `status`
- `total_pax`
- `created_at`

La pantalla no muestra telefono porque el objetivo es marketing/atribucion. El detalle de la reserva sigue siendo el lugar operativo para datos de contacto.

## Rangos

El dashboard acepta `range` por query param:

- `/admin/reservas-externas/atribucion?range=7d`
- `/admin/reservas-externas/atribucion?range=30d`
- `/admin/reservas-externas/atribucion?range=month`
- `/admin/reservas-externas/atribucion?range=all`

El rango por defecto es `30d`.

Los rangos se aplican sobre `external_reservation_submissions.submitted_at`.

## Metricas

- Solicitudes externas: total de filas de `external_reservation_submissions` dentro del rango.
- Pendientes: filas vinculadas a `group_events.status = 'pending'`.
- Confirmadas: filas vinculadas a `group_events.status in ('confirmed', 'completed')`.
- Canceladas / no show: filas vinculadas a `group_events.status in ('cancelled', 'no_show')`.
- Pax generados: suma de `group_events.total_pax` dentro del rango.

## Rankings

El ranking por origen agrupa por `source_label`. Si el valor esta vacio, usa el fallback `Direct / Unknown`.

El ranking por campana solo incluye filas con `utm_campaign` informado. Se agrupa por combinacion:

```txt
utm_source + utm_medium + utm_campaign
```

Esto evita mezclar una misma campana si llega desde canales o medios distintos.

El ranking por idioma agrupa por `preferred_language`; si falta, muestra `No detectado`.

## Acceso

La ruta cuelga de `/admin`, asi que queda protegida por el middleware y por la comprobacion server-side del layout de Admin. No crea roles nuevos y no modifica `app_allowed_users`.

## Alcance

Esta fase solo crea analitica interna con datos ya guardados. No toca `Reserves_extern`, no cambia el formulario publico, no toca `POST /api/external-reservation-requests`, no crea migraciones y no modifica snapshots de esquema.

Meta/Google pixels, cookies, consentimiento y tags quedan para una fase posterior especifica.
