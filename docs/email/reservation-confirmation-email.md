# Email de confirmacion de reserva externa

## Objetivo

La plantilla de confirmacion de reserva externa vive en:

```txt
src/lib/server/customer-notifications/reservationConfirmationEmailTemplate.ts
```

El modulo no envia emails. Solo construye el payload preparado para un proveedor como Resend:

```ts
buildReservationConfirmationEmail(input) => {
  language,
  subject,
  html,
  text,
}
```

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
- `logoImageUrl`

Ambas deben apuntar a imagenes publicas (`http://` o `https://`) para que funcionen en clientes de email. Si faltan, el HTML mantiene una cabecera de marca compatible con email sin depender de assets locales.

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
