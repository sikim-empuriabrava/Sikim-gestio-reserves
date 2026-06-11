# Variables de entorno

Este repo no debe guardar secretos reales en `.env`, `.env.local` ni archivos versionados.

## Confirmaciones de reserva por email

La confirmacion automatica por email de reservas externas confirmadas usa Resend desde codigo server-side.

Variables necesarias:

- `RESERVATION_EMAIL_CONFIRMATIONS_ENABLED=true`
- `RESEND_API_KEY=...`
- `RESERVATION_EMAIL_FROM=Sikim Empuriabrava <reservas@sikimempuriabrava.com>`
- `RESERVATION_EMAIL_REPLY_TO=admin@sikimempuriabrava.com`
- `RESERVATION_EMAIL_GOOGLE_MAPS_URL=https://www.google.com/maps/search/?api=1&query=Sikim%20Empuriabrava`

`RESERVATION_EMAIL_REPLY_TO` es opcional. Si falta, el payload a Resend se envia sin `reply_to`.

`RESERVATION_EMAIL_GOOGLE_MAPS_URL` es opcional. Si falta, la plantilla usa el fallback seguro:

```txt
https://www.google.com/maps/search/?api=1&query=Sikim%20Empuriabrava
```

Si `RESERVATION_EMAIL_CONFIRMATIONS_ENABLED` no es exactamente `true`, o faltan `RESEND_API_KEY` / `RESERVATION_EMAIL_FROM`, no se llama a Resend. El sistema registra la notificacion como `provider_not_configured` con `provider = resend` y `error_message = Email provider is not configured`.
