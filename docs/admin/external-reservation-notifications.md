# Notificaciones push de reservas externas

Este documento define el envio interno de notificaciones push cuando entra una solicitud desde el motor publico de reservas.

## Objetivo

- Avisar internamente cuando una reserva externa llegue como solicitud pendiente.
- Limitar los avisos a usuarios autorizados.
- Guardar las suscripciones Web Push por dispositivo sin exponer claves de servidor al cliente.
- Mantener el envio como best-effort: un fallo push no bloquea la creacion de la reserva.

## Permiso de usuario

`public.app_allowed_users.notify_external_reservations` indica que el usuario puede recibir avisos push de nuevas solicitudes externas.

El valor por defecto es `false`. Un admin debe activarlo desde `/admin/usuarios` en el permiso `Notificaciones reservas externas`.

Este permiso no sustituye a `can_reservas` y no crea roles nuevos.

La regla de envio exige:

1. `app_allowed_users.is_active = true`
2. `role = 'admin' OR can_reservas = true`
3. `notify_external_reservations = true`
4. al menos un dispositivo con subscription activa

## Suscripciones de dispositivo

`public.web_push_subscriptions` almacena las suscripciones Web Push de cada dispositivo.

Columnas principales:

- `user_email`: usuario interno, con FK a `public.app_allowed_users(email)` y `on delete cascade`.
- `endpoint`: endpoint tecnico de la subscription, unico.
- `p256dh` y `auth`: claves tecnicas de la subscription.
- `device_label`: etiqueta opcional para identificar el dispositivo.
- `user_agent`: navegador/dispositivo reportado.
- `is_active`: permite desactivar una subscription sin borrarla.
- `last_seen_at` y `disabled_at`: trazabilidad operativa.

`endpoint`, `p256dh` y `auth` no son secretos de aplicacion, pero deben tratarse como datos sensibles internos.

## Acceso y RLS

RLS esta habilitado en `public.web_push_subscriptions`.

No hay policies amplias para `anon` ni `authenticated`.

El acceso directo queda revocado para `anon` y `authenticated`, y se concede a `service_role`, porque las subscriptions se guardan y se consultan mediante endpoints server-side. La service role nunca debe exponerse al cliente.

## Activacion del dispositivo

La activacion del dispositivo se hace desde `/admin/notificaciones`.

Un usuario autorizado vera si el navegador soporta push, si el permiso del navegador esta concedido o bloqueado, y si este dispositivo tiene una subscription activa.

Hay dos niveles distintos:

- Permiso de usuario: `notify_external_reservations` en `/admin/usuarios`, combinado con usuario activo y `role = 'admin' OR can_reservas = true`.
- Dispositivo activo: subscription Web Push guardada en `public.web_push_subscriptions` para el navegador actual.

Desactivar el dispositivo marca la subscription como `is_active = false`, rellena `disabled_at` y tambien intenta ejecutar `subscription.unsubscribe()` en el navegador.

## Variables

Para registrar el navegador y enviar push se necesitan estas variables:

- `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_SUBJECT`

`NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` se expone al cliente para crear la subscription. `WEB_PUSH_VAPID_PRIVATE_KEY` y `WEB_PUSH_VAPID_SUBJECT` solo se usan server-side.

Si falta alguna variable necesaria para enviar push, `POST /api/external-reservation-requests` registra un warning server-side, no envia la notificacion y mantiene la respuesta de exito si la solicitud se creo correctamente.

No se deben crear `.env`, `.env.local` ni guardar secretos en el repo. La private key no debe exponerse al cliente.

## Endpoints internos

`/api/notifications/push-subscription` permite:

- `GET`: devuelve si el usuario puede recibir notificaciones, si la VAPID public key esta configurada y, cuando se aporta `endpoint`, si ese dispositivo esta activo.
- `POST`: valida la subscription del navegador y hace upsert en `public.web_push_subscriptions` con `user_email`, `endpoint`, `p256dh`, `auth`, `device_label`, `user_agent`, `is_active = true`, `last_seen_at = now()` y `disabled_at = null`.
- `DELETE`: valida permisos y marca como inactiva la subscription del propio usuario para el `endpoint` indicado.

Los endpoints usan service role solo server-side y no muestran `endpoint`, `p256dh` ni `auth` completos en la UI.

## Service worker

El service worker global `/aforo-sw.js` incluye handlers minimos de `push` y `notificationclick`.

Al recibir un push muestra una notification. Al hacer click abre la URL incluida en el payload o `/reservas` como fallback.

No cachea HTML privado.

## Envio automatico

`POST /api/external-reservation-requests` llama al helper server-side despues de crear correctamente:

1. `group_events`
2. `external_reservation_submissions`
3. la asignacion automatica de carta o menu, si aplica
4. el linking CRM best-effort

El helper busca destinatarios en `public.app_allowed_users` con:

1. `is_active = true`
2. `notify_external_reservations = true`
3. `role = 'admin' OR can_reservas = true`

Despues busca subscriptions en `public.web_push_subscriptions` con:

1. `is_active = true`
2. `user_email` dentro de los destinatarios autorizados

No envia notificaciones a usuarios sin permiso ni a subscriptions desactivadas.

## Payload

El payload enviado al service worker es JSON:

```json
{
  "title": "Nueva solicitud externa",
  "body": "2 pax \u00b7 21:00 \u00b7 Test Reserva",
  "url": "/reservas/grupo/<groupEventId>",
  "tag": "external-reservation-<groupEventId>"
}
```

La notificacion abre `/reservas/grupo/[id]`.

El payload no incluye telefono, email ni comentarios de la reserva.

## Subscriptions invalidas

Si el proveedor Web Push responde con `404` o `410`, la subscription se marca como inactiva:

- `is_active = false`
- `disabled_at = now()`

No se borra fisicamente la fila.

Otros errores se registran server-side y la subscription se mantiene activa para futuros intentos.

## Fases siguientes opcionales

1. Plantillas de payload para diferenciar tipos de aviso.
2. Panel operativo para revisar dispositivos activos por usuario, si hace falta.
