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
- `RESERVATION_EMAIL_WHATSAPP_FOOTER_ICON_URL`
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
- `whatsappFooterIconUrl`
- `instagramIconUrl`
- `facebookIconUrl`

Las URLs de imagen deben apuntar a assets publicos (`http://` o `https://`) para que funcionen en clientes de email. Si faltan, el HTML mantiene una cabecera de marca compatible con email sin depender de assets locales.

`RESERVATION_EMAIL_HERO_IMAGE_URL` debe apuntar preferiblemente a una imagen ya recortada al formato de cabecera del email. El template la renderiza como una imagen completa de ancho maximo `640px`, con `height:auto`, sin depender de CSS avanzado como `object-fit` u `object-position`, porque esos estilos no son fiables en todos los clientes de email.

Cuando se busca maxima fidelidad al diseno aprobado, el asset de `RESERVATION_EMAIL_HERO_IMAGE_URL` debe ser una imagen precompuesta que ya incluya el logo Sikim integrado sobre la fotografia. En Supabase Storage se recomienda una ruta publica estable como:

```txt
email-assets/reservation-confirmation/hero-with-logo.jpg
```

Si el asset usa una curva inferior, exportarlo con transparencia alfa real o con el mismo fondo crema final del email. No debe llevar un damero visible ni una zona blanca opaca distinta al fondo, porque eso rompe la continuidad visual entre hero y contenido. Para la version con curva transparente se puede usar una ruta publica como:

```txt
email-assets/reservation-confirmation/Hero w logo transparent.png
```

Si el hero ya lleva el logo integrado, configurar tambien:

```txt
RESERVATION_EMAIL_HERO_INCLUDES_LOGO=true
```

Con `RESERVATION_EMAIL_HERO_IMAGE_URL` y `RESERVATION_EMAIL_HERO_INCLUDES_LOGO=true`, la plantilla renderiza solo el hero y no renderiza ningun logo separado debajo.

Si `RESERVATION_EMAIL_HERO_INCLUDES_LOGO` falta o no es exactamente `true`, se mantiene el comportamiento compatible: el hero se renderiza arriba y el logo/fallback de marca se renderiza despues en una fila separada.

El template no hace overlay del logo sobre el hero con CSS. No depender de `background-image`, `position:absolute`, `object-fit` u otros overlays avanzados en email, porque no son fiables entre clientes.

`RESERVATION_EMAIL_LOGO_IMAGE_URL` es opcional. Sirve como fallback para mostrar el logo por separado debajo del hero, o como cabecera de marca cuando no hay hero. No debe considerarse un mecanismo de overlay sobre la imagen principal.

Los iconos de WhatsApp, Instagram y Facebook tambien pueden apuntar a imagenes publicas de Supabase Storage mediante `RESERVATION_EMAIL_WHATSAPP_ICON_URL`, `RESERVATION_EMAIL_WHATSAPP_FOOTER_ICON_URL`, `RESERVATION_EMAIL_INSTAGRAM_ICON_URL` y `RESERVATION_EMAIL_FACEBOOK_ICON_URL`. Si falta `RESERVATION_EMAIL_WHATSAPP_FOOTER_ICON_URL`, el footer reutiliza `RESERVATION_EMAIL_WHATSAPP_ICON_URL`. Si faltan todos, la plantilla usa iconos inline compatibles como fallback.

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

No incluye `Sala`, notas internas, alergias, comentarios, tracking, datos de facturacion ni IDs internos.

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
