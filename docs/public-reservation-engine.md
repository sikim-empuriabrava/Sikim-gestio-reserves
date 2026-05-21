# Motor publico de reservas

## Objetivo

El motor publico de reservas permite recibir solicitudes externas desde canales de captacion como:

- Instagram / Linktree.
- Web publica.
- Google Maps.
- WhatsApp.
- Anuncios.
- QR futuro.

Este motor no sustituye al motor interno de reservas. Su responsabilidad es captar solicitudes ligeras, registrar su procedencia y enviarlas a revision operativa. La app interna sigue siendo la fuente de verdad para la gestion real de reservas, CRM, Google Calendar, Supabase migrations, schema snapshot y revision por Carla/equipo.

## Separacion de repos y proyectos

`Reserves_extern` es la app publica de solicitudes. Debe exponer solo rutas publicas, formularios publicos y logica segura para captar una solicitud externa.

`Sikim-gestio-reserves` es la app interna. Mantiene la DB, CRM, Google Calendar, reservas internas, migraciones de Supabase, schema snapshot y flujos de revision operativa.

El proyecto publico no debe contener rutas internas, componentes de backoffice, reglas sensibles de negocio, service role keys, logica privada de CRM, logica privada de Calendar ni accesos directos no controlados a datos internos.

## Rutas publicas

La app publica expone:

- `/`
- `/reservar`
- `POST /api/reservation-request`

Actualmente `POST /api/reservation-request` es un endpoint placeholder y responde `501 Not implemented` hasta implementar el backend real.

## Formulario V1

Campos obligatorios:

- Fecha deseada.
- Hora aproximada.
- Numero de personas.
- Nombre y apellidos.
- Telefono.
- Aceptacion de privacidad/contacto operativo.

Campos opcionales:

- Email.
- Comentario.

En V1 externa no se diferencia entre "nombre de reserva" y "nombre de cliente/contacto". La UI publica debe pedir un unico campo `Nombre y apellidos`.

Cuando se cree la solicitud real:

```txt
group_events.name = nombre_y_apellidos
group_events.customer_name = nombre_y_apellidos
group_events.customer_phone = telefono
group_events.customer_email = email opcional
```

Carla podra editar el nombre operativo desde la app interna si hace falta.

## Estado de la solicitud

Decision recomendada para V1:

```txt
group_events.status = pending
```

No crear `external_pending` como status real en V1.

La UI interna debera mostrar estas reservas como `Solicitud externa pendiente` cuando exista una fila relacionada en `external_reservation_submissions`.

Razon:

- `status` representa la fase operativa de la reserva.
- `external_reservation_submissions` representa origen, procedencia y metadata de captacion.
- Evita mezclar estado operativo con canal de captacion.
- Reduce cambios en Calendar sync, constraints, vistas y filtros.

## Modelo DB futuro

Se propone crear una tabla futura `external_reservation_submissions` para guardar la metadata de origen y consentimiento de cada solicitud externa.

Campos conceptuales:

- `id`
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
- `privacy_accepted_at`
- `marketing_consent`
- `marketing_consent_at`
- `marketing_consent_source`
- `ip_hash`
- `user_agent`
- `submitted_at`
- `created_at`
- `updated_at`

Relacion:

```txt
external_reservation_submissions.group_event_id -> group_events.id
```

Este PR no debe crear la migracion todavia.

## CRM

Las solicitudes externas deben alimentar CRM desde V1.

Al crear una solicitud:

- Guardar snapshot en `group_events.customer_*`.
- Intentar vincular o crear cliente CRM.
- Actualizar `group_events.customer_id`.
- Mantener snapshots historicos en la reserva para preservar como llego la solicitud en ese momento.

## Google Calendar

Una solicitud externa entra como `pending`.

Las reservas `pending` no deben sincronizar con Google Calendar.

Cuando Carla/equipo confirme internamente la solicitud, la reserva pasa a `confirmed` y entonces se usa el flujo normal de calendar sync existente.

## Tracking y procedencia

La app publica debe capturar:

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
- `submitted_at`
- `source_label`

Regla de interpretacion recomendada:

1. UTM explicito.
2. Click IDs.
3. Referrer.
4. Direct / Unknown.

Ejemplos de `source_label`:

- Instagram Bio.
- Meta Ads.
- Google Maps.
- Website.
- WhatsApp.
- QR.
- Google Ads.
- TikTok Ads.
- Direct / Unknown.

## Seguridad y anti-spam

El endpoint real debe incluir:

- Validacion server-side estricta.
- Sanitizacion.
- Limites de longitud.
- No aceptar HTML en comentarios.
- Honeypot.
- Form token.
- Rate limit por contacto/IP hash.
- Errores genericos.
- No exponer service role al cliente.
- No exponer rutas internas.
- No crear reservas confirmadas directamente.

## Idioma

La app publica debe detectar idioma por navegador/movil y permitir selector manual.

Debe guardarse `preferred_language` junto a la solicitud externa.

Idiomas iniciales recomendados:

- `ca`
- `es`
- `fr`
- `en`
- `de`
- `nl`
- `it`

## Notificaciones internas PWA

Fase futura, no implementar todavia.

Carla/admin podra activar notificaciones en la PWA interna. Una nueva solicitud externa disparara una push notification y la notificacion abrira la solicitud en la app interna.

## WhatsApp/SMS al confirmar

Fase futura, no implementar todavia.

Al confirmar una reserva externa, se podria enviar un WhatsApp/SMS automatico al cliente. Requiere proveedor externo y no forma parte de V1 inicial.

## Fases recomendadas

1. Bootstrap publico en `Reserves_extern` - ya hecho.
2. Documento de arquitectura interna - este PR.
3. Migracion/modelo DB en `Sikim-gestio-reserves`.
4. Endpoint real en `Reserves_extern`.
5. Integracion visual interna en `/reservas`.
6. Notificaciones PWA internas.
7. WhatsApp/SMS al confirmar.

## Limites de alcance de este PR

Este PR es solo documentacion.

No se debe:

- Modificar codigo funcional.
- Crear migraciones.
- Tocar Supabase.
- Tocar schema snapshot.
- Tocar auth.
- Tocar RLS.
- Tocar Google Calendar.
- Tocar CRM code.
- Tocar `package.json` ni `package-lock.json`.
- Instalar dependencias.
