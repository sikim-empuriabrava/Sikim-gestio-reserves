# Notificaciones push de reservas externas

Este documento define la base interna para futuras notificaciones push cuando entre una solicitud desde el motor publico de reservas.

Este PR no envia notificaciones todavia. Solo prepara permisos, suscripciones de dispositivo y el modelo operativo que usara una fase posterior.

## Objetivo

- Avisar internamente cuando una reserva externa llegue como solicitud pendiente.
- Limitar los avisos a usuarios autorizados.
- Guardar las suscripciones Web Push por dispositivo sin exponer claves de servidor al cliente.

## Permiso de usuario

`public.app_allowed_users.notify_external_reservations` indica que el usuario puede recibir avisos push de nuevas solicitudes externas.

El valor por defecto es `false`. Un admin debe activarlo desde `/admin/usuarios` en el permiso `Notificaciones reservas externas`.

Este permiso no sustituye a `can_reservas` y no crea roles nuevos.

La regla futura de envio exigira:

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

El acceso directo queda revocado para `anon` y `authenticated`, y se concede a `service_role`, porque las subscriptions se guardaran mediante endpoints server-side. La service role nunca debe exponerse al cliente.

## Variables futuras

La activacion del dispositivo se hace desde `/admin/notificaciones`.

Un usuario autorizado vera si el navegador soporta push, si el permiso del navegador esta concedido o bloqueado, y si este dispositivo tiene una subscription activa.

Hay dos niveles distintos:

- Permiso de usuario: `notify_external_reservations` en `/admin/usuarios`, combinado con usuario activo y `role = 'admin' OR can_reservas = true`.
- Dispositivo activo: subscription Web Push guardada en `public.web_push_subscriptions` para el navegador actual.

Desactivar el dispositivo marca la subscription como `is_active = false`, rellena `disabled_at` y tambien intenta ejecutar `subscription.unsubscribe()` en el navegador.

## Variables

Para registrar el navegador se necesita una VAPID public key expuesta al cliente:

- `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`

Si falta, la pantalla muestra que la configuracion esta incompleta y no intenta suscribir el navegador.

Una fase posterior necesitara configurar Web Push con variables server-side:

- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_SUBJECT`

No se crean `.env`, secretos ni dependencias en esta fase. La private key no debe exponerse al cliente.

## Endpoints internos

`/api/notifications/push-subscription` permite:

- `GET`: devuelve si el usuario puede recibir notificaciones, si la VAPID public key esta configurada y, cuando se aporta `endpoint`, si ese dispositivo esta activo.
- `POST`: valida la subscription del navegador y hace upsert en `public.web_push_subscriptions` con `user_email`, `endpoint`, `p256dh`, `auth`, `device_label`, `user_agent`, `is_active = true`, `last_seen_at = now()` y `disabled_at = null`.
- `DELETE`: valida permisos y marca como inactiva la subscription del propio usuario para el `endpoint` indicado.

Los endpoints usan service role solo server-side y no muestran `endpoint`, `p256dh` ni `auth` completos en la UI.

## Service worker

El service worker global `/aforo-sw.js` incluye handlers minimos de `push` y `notificationclick`.

En fases posteriores, al recibir un push mostrara una notification y al hacer click abrira la URL incluida en el payload o `/reservas` como fallback.

No cachea HTML privado.

## Fases siguientes

1. Envio automatico cuando `POST /api/external-reservation-requests` cree una solicitud externa pendiente.
2. Plantillas de payload para diferenciar tipos de aviso.
3. Panel operativo para revisar dispositivos activos por usuario, si hace falta.
