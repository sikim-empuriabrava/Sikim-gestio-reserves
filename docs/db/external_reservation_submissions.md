# External reservation submissions

`public.external_reservation_submissions` stores attribution and submission metadata for reservation requests that arrive from public or external entry points.

`public.group_events` remains the operational reservation record. External submissions are linked to the reservation created in `group_events` through `external_reservation_submissions.group_event_id`.

## V1 model

- External requests use `group_events.status = 'pending'` while they wait for internal review.
- This model does not add an `external_pending` status.
- Future internal UI can show "Solicitud externa pendiente" when `group_events.status = 'pending'` and an associated `external_reservation_submissions` row exists.
- `group_events.status` continues to represent the operational reservation phase.
- `external_reservation_submissions` represents origin, acquisition and submission metadata.

## Internal reservation detail UI

The internal reservation detail screen detects an external reservation by looking up an associated `external_reservation_submissions` row for the same `group_event_id`.

When that row exists, the internal UI now surfaces:

- a visible `Solicitud externa` block;
- the operational reservation status together with `source_label`, preferred language and `submitted_at`;
- compact attribution metadata such as `utm_source`, `utm_medium`, `utm_campaign`, referrer and landing page when present;
- the client comment stored in `group_events.extras` as plain text under `Comentario de la solicitud externa`;
- a pending card/menu state in the form when there is no real `group_event_offerings` row yet.

## Internal reservations overview UI

The `/reservas` overview treats an external pending request as:

- `group_events.status = 'pending'`;
- plus an associated `external_reservation_submissions` row with the same `group_event_id`.

For the currently visible period, `/reservas` shows:

- an `Externas pendientes` metric card;
- a compact `Solicitudes externas pendientes` list with date, time, name, pax, phone, source label, short comment and a link to `/reservas/grupo/[id]`.
- a compact `Externa` badge on reservation cards when an associated `external_reservation_submissions` row exists for the same `group_event_id`, including reservations that have already been confirmed.

This overview does not add a new reservation status and does not rely on an `external_pending` value.

## Internal attribution dashboard

Admins can review internal attribution for external reservation requests at `/admin/reservas-externas/atribucion`.

The dashboard reads `external_reservation_submissions` joined to `group_events`, applies the selected range over `submitted_at`, and summarizes requests, operational status, pax, source labels, UTM campaigns and preferred languages.

More detail: [Admin: atribucion de reservas externas](../admin/external-reservation-attribution.md).

## Configuracion interna de tracking futuro

Admins can prepare future pixel/tag IDs at `/admin/reservas-externas/tracking`.

That configuration is stored outside this attribution table, in `public.external_tracking_integrations`, and is documented at [Admin: tracking de reservas externas](../admin/external-reservation-tracking.md).

This separation is intentional:

- `external_reservation_submissions` stores first-party attribution data already received by the internal ingest.
- `external_tracking_integrations` stores future provider configuration such as Meta Pixel, Google Tag, Google Ads Conversion or Google Tag Manager IDs.
- The tracking configuration does not load external scripts or create cookies.
- The safe server-to-server read endpoint for active public tracking configuration is documented at [Admin: tracking de reservas externas](../admin/external-reservation-tracking.md#endpoint-seguro-de-configuración-pública).

## Futuras notificaciones push internas

Las futuras notificaciones push internas se basaran en solicitudes externas pendientes: `group_events.status = 'pending'` mas una fila asociada en `external_reservation_submissions`.

La base de permisos y dispositivos vive fuera de esta tabla:

- `app_allowed_users.notify_external_reservations` controla que usuarios pueden recibir avisos.
- `web_push_subscriptions` guarda las subscriptions activas por dispositivo.

La regla futura de envio exigira usuario activo, rol `admin` o permiso `can_reservas`, permiso `notify_external_reservations` activo y al menos una subscription activa.

Esta fase no envia notificaciones, no crea service worker y no cambia el endpoint publico externo.

## Oferta y sala por defecto para reservas externas

`public.external_reservation_settings` is a singleton configuration table for defaults that `POST /api/external-reservation-requests` can apply automatically.

- The singleton is enforced with `id boolean primary key default true` plus `check (id = true)`, so only the global `true` row is valid.
- The route reads `external_reservation_settings` with `where id = true`.
- If there is no row, `is_enabled = false`, or the configured offering is incomplete, the reservation still enters normally and no `group_event_offerings` row is created.
- If `default_offering_kind = 'cheffing_card'` and the configured `default_cheffing_card_id` exists and is active, the route creates a `group_event_offerings` row with `assigned_pax = partySize`, `display_name_snapshot = cheffing_cards.name`, `unit_price_snapshot = null`, `sort_order = 0` and a minimal `snapshot_payload` marking the assignment as automatic.
- If `default_offering_kind = 'cheffing_menu'` and the configured `default_cheffing_menu_id` exists and is active, the route creates a `group_event_offerings` row with `assigned_pax = partySize`, `display_name_snapshot = cheffing_menus.name`, `unit_price_snapshot = cheffing_menus.price_per_person`, `sort_order = 0` and the same automatic-assignment snapshot.
- The initial seed tries to point the configuration to the active cheffing card whose name is exactly `Carta Plats`.
- The current intended operational default is therefore `Carta Plats` whenever that card exists, is active and the singleton is enabled.
- Admins can update this singleton from the internal screen `/admin/reservas-externas` without touching Supabase manually.
- If `Carta Plats` does not exist or is not active, the singleton row is seeded with no default offering and `is_enabled = false`.
- If a configured default card or menu later loses its valid FK reference, normalization leaves the row without offering and forces `is_enabled = false`.
- `is_enabled = true` only makes sense when a valid default offering is configured.
- No cheffing card or menu ID is hardcoded in application code; the ingest resolves the default offering through this table at request time.
- If the table points to a card or menu that no longer exists or is no longer active, the route logs a server-side warning, skips the offering assignment and still accepts the reservation.
- If creating `group_event_offerings` fails unexpectedly, the route logs a server-side error and still accepts the reservation so the team can assign the card or menu manually from the internal UI.
- The operational fallback is that Carla can assign the card or menu manually after the reservation lands as `pending`.

`external_reservation_settings.default_room_id` stores the default dinner room for external reservations with `event_mode = 'dinner'`.

- The column references `public.rooms(id)` with `on delete set null`.
- The initial seed tries to set `default_room_id` to the active room whose normalized lookup is `lower(name) = 'medi'`.
- The seed only writes the value when exactly one active room named `medi` exists; if none or multiple match, it leaves `default_room_id = null` and the migration still succeeds.
- No room UUID is hardcoded in application code.
- When `default_room_id` points to an active dinner room, the ingest creates a `public.group_room_allocations` row with `group_event_id` set to the new reservation id, `room_id = default_room_id`, `adults = partySize`, `children = 0`, `override_capacity = false` and `notes = null`.
- If there is no configured room, the room is inactive, the room is not a dinner room, or the allocation insert fails, the route logs server-side context and still accepts the reservation as `pending`.
- The operational fallback is that Carla can assign the room manually from the internal detail screen.

## Captured metadata

The table stores source labels, UTM fields, click identifiers, referrer, landing page, preferred language, privacy acceptance, optional marketing consent metadata, an IP hash and user agent.

V1 intentionally does not store a raw request payload with PII.

## Anti-abuse interno

`Reserves_extern` hace el hardening de entrada del formulario publico: sanitizacion, bloqueo de XSS evidente, honeypot, trampa de velocidad, `ipHash` HMAC y timeout hacia el endpoint interno.

`Sikim-gestio-reserves` anade una segunda capa conservadora en `POST /api/external-reservation-requests` antes de crear reservas operativas:

- Deduplicacion exacta: si en las ultimas 24 horas ya existe una solicitud externa asociada a un `group_events` con el mismo telefono normalizado, `event_date`, `entry_time` y `total_pax`, y su estado no es `cancelled` ni `no_show`, no se crea una nueva reserva.
- El telefono solo se normaliza para comparacion anti-abuse: `trim`, eliminacion de espacios, guiones y parentesis, conservando un `+` inicial si existe. El valor original se sigue guardando en `group_events.customer_phone`.
- Rate limit por telefono normalizado: maximo 3 solicitudes en 15 minutos y maximo 10 en 24 horas.
- Rate limit por `ip_hash`, solo si el payload trae `attribution.ipHash`: maximo 5 solicitudes en 15 minutos y maximo 20 en 24 horas.
- Si `ipHash` es `null`, se omite el control por IP y se aplican solo las comprobaciones por telefono.
- En deduplicacion o rate limit, el endpoint responde de forma silenciosa con HTTP `201` y `ok: true` para no cambiar la UX publica ni dar pistas a bots.
- En deduplicacion devuelve el `groupEventId` existente y `deduplicated: true`.
- En rate limit devuelve `groupEventId: null`, `status: "accepted"` y `rateLimited: true`.
- No se guarda IP plana, no se intenta reconstruir IP y los logs server-side evitan telefono completo, email, comentario, token y payload completo.
- Como el anti-abuse se ejecuta antes de insertar `group_events`, tampoco se crean `external_reservation_submissions`, offerings, asignaciones de sala, enlaces CRM ni notificaciones push en esos casos.

## Calendar and CRM

Google Calendar sync continues to be driven by `group_events.status`. Pending reservations are not synced; calendar sync starts only when the reservation reaches the existing confirmed/completed flow.

CRM data continues to come from `group_events.customer_*` fields and `group_events.customer_id`. This table should not become the operational CRM source of truth.

## Internal ingest endpoint

The internal app exposes `POST /api/external-reservation-requests` as a server-to-server ingest endpoint for public reservation requests coming from `Reserves_extern`.

- The route is public at middleware level only so it can skip Supabase session auth.
- The handler itself requires `Authorization: Bearer <secret>`.
- The secret must come from the server-only env var `SIKIM_PUBLIC_RESERVATION_INGEST_SECRET`.
- Missing or invalid bearer auth returns `401`.
- Missing server configuration returns a generic `500`.
- All responses set `Cache-Control: no-store`.

### Request contract

The endpoint accepts a strict JSON payload with:

- `date` (`YYYY-MM-DD`)
- `time` (`HH:mm`)
- `partySize` (`1-80`)
- `contactName`
- `phone`
- `email` optional
- `comment` optional, stored as plain text in `group_events.extras`
- `privacyAccepted` and it must be `true`
- `preferredLanguage` optional: `ca`, `es`, `fr`, `en`, `de`, `nl`, `it`
- `attribution` optional with source label, UTM fields, referrer, landing page, click ids, user agent and IP hash

### Write flow

1. Check internal anti-abuse for exact duplicates, phone limits and optional `ip_hash` limits.
2. Insert a pending operational reservation into `public.group_events`.
3. Insert the matching attribution row into `public.external_reservation_submissions`.
4. Read `public.external_reservation_settings` and, when the singleton is enabled and points to an active configured card or menu, insert the matching `public.group_event_offerings` row.
5. Read `public.external_reservation_settings.default_room_id` and, when it points to an active dinner room, insert the matching `public.group_room_allocations` row.
6. Attempt CRM linking with `linkGroupEventCustomerFromSnapshot` on a best-effort basis.
7. Attempt internal push notification delivery on a best-effort basis.

If step 1 detects an exact duplicate or rate limit, the handler returns a silent success response before creating any reservation, attribution, default offering, default room allocation, CRM link or push notification.

If step 3 fails after the reservation row was created, the handler attempts to delete the just-created `group_events` row to avoid leaving an orphan reservation without external provenance.

If step 4 fails because the settings are missing, disabled, incomplete or point to an inactive catalog item, the handler keeps the reservation and submission rows intact and only skips the automatic offering assignment.

If step 4 fails with an unexpected insert error in `group_event_offerings`, the handler logs the failure and still returns success so the customer request is not lost.

If step 5 fails because the room setting is missing, inactive, not a dinner room or the allocation insert fails unexpectedly, the handler logs the failure and still returns success so the customer request is not lost.

## Access model

RLS is enabled on `public.external_reservation_submissions`.

Direct access for `anon` and `authenticated` is revoked. The table is granted to `service_role` for controlled server-side writes.

The future public endpoint must write server-side and must not expose the `service_role` key to the client. The public `Reserves_extern` app should not write directly with the anon key.
