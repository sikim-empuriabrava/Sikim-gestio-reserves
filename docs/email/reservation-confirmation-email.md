# Email de confirmacion de reserva externa

## Objetivo

La plantilla de confirmacion de reserva externa vive en:

```txt
src/lib/server/customer-notifications/reservationConfirmationEmailTemplate.ts
```

El modulo de plantilla no envia emails. Solo construye el payload preparado para un proveedor como Resend:

```ts
buildReservationConfirmationEmail(input) => {
  language,
  subject,
  html,
  text,
}
```

## Envio automatico

El envio server-side vive en:

```txt
src/lib/server/customer-notifications/externalReservationConfirmationEmail.ts
```

Se ejecuta en la app interna cuando una reserva operativa externa pasa a:

```txt
group_events.status = 'confirmed'
```

La ruta de actualizacion de reservas llama al helper de forma best-effort. Si Resend falla, si falta configuracion o si el cliente no tiene email valido, la reserva ya confirmada no debe volver a error para el usuario interno.

## Configuracion

El envio real requiere variables de entorno de servidor:

- `RESERVATION_EMAIL_CONFIRMATIONS_ENABLED=true`
- `RESEND_API_KEY`
- `RESERVATION_EMAIL_FROM`

Opcionales:

- `RESERVATION_EMAIL_REPLY_TO`
- `RESERVATION_EMAIL_LOCATION_URL`
- `RESERVATION_EMAIL_GOOGLE_MAPS_URL` como alias compatible si no se define `RESERVATION_EMAIL_LOCATION_URL`
- `RESERVATION_EMAIL_HERO_IMAGE_URL`
- `RESERVATION_EMAIL_HERO_INCLUDES_LOGO`
- `RESERVATION_EMAIL_LOGO_IMAGE_URL`
- `RESERVATION_EMAIL_WHATSAPP_ICON_URL`
- `RESERVATION_EMAIL_WHATSAPP_HELP_ICON_URL`
- `RESERVATION_EMAIL_INSTAGRAM_ICON_URL`
- `RESERVATION_EMAIL_FACEBOOK_ICON_URL`

Ejemplos esperados, sin secrets:

```txt
RESERVATION_EMAIL_FROM="Sikim Empuriabrava <booking@sikimempuriabrava.com>"
RESERVATION_EMAIL_REPLY_TO="booking@sikimempuriabrava.com"
```

Si `RESERVATION_EMAIL_CONFIRMATIONS_ENABLED` no es `true`, falta `RESEND_API_KEY` o falta `RESERVATION_EMAIL_FROM`, no se llama a Resend y se guarda `Email provider is not configured` en el tracking.

## Tracking e idempotencia

La plantilla solo genera el contenido del email. La decision de envio, los intentos y la idempotencia del flujo externo V1 viven en `public.external_reservation_submissions`.

Los campos `confirmation_email_sent_at`, `confirmation_email_attempted_at`, `confirmation_email_to`, `confirmation_email_language`, `confirmation_email_provider`, `confirmation_email_provider_id` y `confirmation_email_error` preparan la idempotencia del flujo: si `confirmation_email_sent_at` ya existe, el envio automatico no debe reenviar la confirmacion.

`confirmation_email_language` se deriva de `preferred_language` y `confirmation_email_provider` es inicialmente `resend`. Si `preferred_language` es nulo o invalido, se usa `es` y ese idioma resuelto se guarda en el tracking.

`customer_reservation_notifications` queda fuera del alcance de este flujo V1. No se elimina ni se migra aqui, pero no es la fuente principal de idempotencia para confirmaciones externas.

## Resend

El proveedor inicial es Resend, sin dependencia nueva. El helper llama a:

```txt
POST https://api.resend.com/emails
```

Con payload:

```ts
{
  from,
  to: [recipient],
  subject,
  html,
  text,
  ...(replyTo ? { reply_to: replyTo } : {})
}
```

Y headers:

```ts
{
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
  "Idempotency-Key": `external-reservation-confirmation-${groupEventId}`
}
```

El `id` devuelto por Resend se guarda en `confirmation_email_provider_id`.

## Arquitectura

- Un unico template HTML base, construido con tablas y estilos inline.
- La version visual real usa un fondo claro calido. El color crema principal es `#fff7ef` y se aplica al fondo exterior, contenedor principal, zona bajo el hero y footer para evitar que clientes de email lo interpreten como una plantilla oscura.
- La card de resumen muestra solo `Fecha`, `Hora` y `Personas`, con separadores verticales, labels en dorado y valores en serif. No renderiza iconos decorativos en esos bloques para evitar imagenes rotas en Gmail movil y otros clientes de email.
- El CTA `Como llegar` se renderiza solo como texto maquetado dentro del boton. No usa icono decorativo para evitar placeholders o imagenes rotas.
- Un diccionario `TRANSLATIONS` para `ca`, `es`, `fr`, `en`, `de`, `nl`, `it`.
- `normalizeReservationEmailLanguage` acepta variantes como `en-GB` o `EN_us` y hace fallback a `es`.
- Las fechas se formatean con `Intl.DateTimeFormat` y estos locales:
  - `ca -> ca-ES`
  - `es -> es-ES`
  - `fr -> fr-FR`
  - `en -> en-GB`
  - `de -> de-DE`
  - `nl -> nl-NL`
  - `it -> it-IT`

## CTA de ubicacion

El input publico preferido es `locationUrl`.

Si no se proporciona una URL `https://` valida, se usa la constante local:

```txt
https://www.google.com/maps/search/?api=1&query=Sikim%20Empuriabrava
```

Esta URL ya existia en la documentacion/env del repo como valor de Google Maps para el email. El input `googleMapsUrl` se mantiene como alias de compatibilidad para el sender existente.

## Imagenes

La plantilla acepta:

- `heroImageUrl`
- `heroIncludesLogo`
- `logoImageUrl`
- `whatsappIconUrl`
- `whatsappHelpIconUrl`
- `instagramIconUrl`
- `facebookIconUrl`

Las URLs de imagen deben apuntar a assets publicos (`http://` o `https://`) para que funcionen en clientes de email. Si faltan, el HTML mantiene una cabecera de marca compatible con email sin depender de assets locales.

`RESERVATION_EMAIL_HERO_IMAGE_URL` debe apuntar preferiblemente a una imagen rectangular ya recortada al formato de cabecera del email. El template la renderiza como una imagen completa de ancho maximo `640px`, con `height:auto`, sin depender de curvas, transparencias, overlays, `background-image`, `object-fit` u otros trucos de maquetacion poco fiables en clientes de email.

Cuando se busca maxima fidelidad al diseno aprobado, el asset de `RESERVATION_EMAIL_HERO_IMAGE_URL` debe ser una imagen precompuesta que ya incluya el logo Sikim integrado sobre la fotografia. En Supabase Storage se recomienda una ruta publica estable como:

```txt
email-assets/reservation-confirmation/hero-with-logo.jpg
```

Si el hero ya lleva el logo integrado, configurar tambien:

```txt
RESERVATION_EMAIL_HERO_INCLUDES_LOGO=true
```

Con `RESERVATION_EMAIL_HERO_IMAGE_URL` y `RESERVATION_EMAIL_HERO_INCLUDES_LOGO=true`, la plantilla renderiza solo el hero y no renderiza ningun logo separado debajo.

Si `RESERVATION_EMAIL_HERO_INCLUDES_LOGO` falta o no es exactamente `true`, se mantiene el comportamiento compatible: el hero se renderiza arriba y el logo/fallback de marca se renderiza despues en una fila separada.

El template no hace overlay del logo sobre el hero con CSS. Si no hay hero, se usa el fallback de marca del template. No depender de `background-image`, `position:absolute`, `object-fit` u otros overlays avanzados en email, porque no son fiables entre clientes.

`RESERVATION_EMAIL_LOGO_IMAGE_URL` es opcional. Sirve como fallback para mostrar el logo por separado debajo del hero, o como cabecera de marca cuando no hay hero. No debe considerarse un mecanismo de overlay sobre la imagen principal.

Los iconos de Instagram, Facebook y WhatsApp tambien pueden apuntar a imagenes publicas de Supabase Storage, siempre via variables de entorno y nunca hardcodeando URLs de Storage en codigo:

- `RESERVATION_EMAIL_INSTAGRAM_ICON_URL` para el icono Instagram del footer.
- `RESERVATION_EMAIL_FACEBOOK_ICON_URL` para el icono Facebook del footer.
- `RESERVATION_EMAIL_WHATSAPP_ICON_URL` para el icono WhatsApp del footer.
- `RESERVATION_EMAIL_WHATSAPP_HELP_ICON_URL` para el icono verde del bloque de ayuda/cancelacion.

La plantilla valida que esas variables sean URLs `http://` o `https://`. Si falta una URL o no es valida, el footer usa fallback textual `IG`, `FB` o `WA`; el bloque de ayuda usa fallback textual `WA`. Para `Fecha`, `Hora`, `Personas` y `Como llegar` no se renderiza ningun icono decorativo: si no hay asset valido, simplemente no hay icono. Los enlaces de destino siguen siendo los enlaces oficiales de Instagram, Facebook y WhatsApp definidos en la plantilla.

Los assets pueden vivir en Supabase Storage publico siempre que la URL final se configure como env var de servidor en Vercel o en el entorno local de prueba. No se usan icon fonts, librerias externas ni CDNs de iconos. No se deben commitear secrets ni URLs privadas.

## Contenido

Incluye:

- titular de reserva confirmada;
- saludo y confirmacion;
- Fecha;
- Hora;
- Personas;
- bloque de ayuda para modificar o cancelar con CTA de WhatsApp;
- CTA principal de ubicacion;
- footer con Sikim Empuriabrava e Instagram, Facebook y WhatsApp.

No incluye `Sala`, `Ver reserva`, `Te esperamos`, notas internas, alergias, comentarios, tracking, datos de facturacion ni IDs internos.

La frase "Te esperamos para disfrutar de una experiencia mediterranea unica" no forma parte de la plantilla.

## Verificacion manual rapida

Ejecutar el test focalizado:

```txt
node src/lib/server/customer-notifications/reservationConfirmationEmailTemplate.test.mjs
```

Checks generales esperados en el PR:

```txt
npm.cmd run lint
npm.cmd run build
git diff --check
```
