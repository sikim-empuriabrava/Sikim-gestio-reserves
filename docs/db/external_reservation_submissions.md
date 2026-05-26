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

## Oferta por defecto para reservas externas

`public.external_reservation_settings` is a singleton configuration table for the default catalog offering that `POST /api/external-reservation-requests` can apply automatically.

- The singleton is enforced with `id boolean primary key default true` plus `check (id = true)`, so only the global `true` row is valid.
- The route reads `external_reservation_settings` with `where id = true`.
- If there is no row, `is_enabled = false`, or the configured offering is incomplete, the reservation still enters normally and no `group_event_offerings` row is created.
- If `default_offering_kind = 'cheffing_card'` and the configured `default_cheffing_card_id` exists and is active, the route creates a `group_event_offerings` row with `assigned_pax = partySize`, `display_name_snapshot = cheffing_cards.name`, `unit_price_snapshot = null`, `sort_order = 0` and a minimal `snapshot_payload` marking the assignment as automatic.
- If `default_offering_kind = 'cheffing_menu'` and the configured `default_cheffing_menu_id` exists and is active, the route creates a `group_event_offerings` row with `assigned_pax = partySize`, `display_name_snapshot = cheffing_menus.name`, `unit_price_snapshot = cheffing_menus.price_per_person`, `sort_order = 0` and the same automatic-assignment snapshot.
- The initial seed tries to point the configuration to the active cheffing card whose name is exactly `Carta Plats`.
- The current intended operational default is therefore `Carta Plats` whenever that card exists, is active and the singleton is enabled.
- If `Carta Plats` does not exist or is not active, the singleton row is seeded with no default offering and `is_enabled = false`.
- If a configured default card or menu later loses its valid FK reference, normalization leaves the row without offering and forces `is_enabled = false`.
- `is_enabled = true` only makes sense when a valid default offering is configured.
- No cheffing card or menu ID is hardcoded in application code; the ingest resolves the default offering through this table at request time.
- If the table points to a card or menu that no longer exists or is no longer active, the route logs a server-side warning, skips the offering assignment and still accepts the reservation.
- If creating `group_event_offerings` fails unexpectedly, the route logs a server-side error and still accepts the reservation so the team can assign the card or menu manually from the internal UI.
- The operational fallback is that Carla can assign the card or menu manually after the reservation lands as `pending`.

## Captured metadata

The table stores source labels, UTM fields, click identifiers, referrer, landing page, preferred language, privacy acceptance, optional marketing consent metadata, an IP hash and user agent.

V1 intentionally does not store a raw request payload with PII.

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

1. Insert a pending operational reservation into `public.group_events`.
2. Insert the matching attribution row into `public.external_reservation_submissions`.
3. Read `public.external_reservation_settings` and, when the singleton is enabled and points to an active configured card or menu, insert the matching `public.group_event_offerings` row.
4. Attempt CRM linking with `linkGroupEventCustomerFromSnapshot` on a best-effort basis.

If step 2 fails after the reservation row was created, the handler attempts to delete the just-created `group_events` row to avoid leaving an orphan reservation without external provenance.

If step 3 fails because the settings are missing, disabled, incomplete or point to an inactive catalog item, the handler keeps the reservation and submission rows intact and only skips the automatic offering assignment.

If step 3 fails with an unexpected insert error in `group_event_offerings`, the handler logs the failure and still returns success so the customer request is not lost.

## Access model

RLS is enabled on `public.external_reservation_submissions`.

Direct access for `anon` and `authenticated` is revoked. The table is granted to `service_role` for controlled server-side writes.

The future public endpoint must write server-side and must not expose the `service_role` key to the client. The public `Reserves_extern` app should not write directly with the anon key.
