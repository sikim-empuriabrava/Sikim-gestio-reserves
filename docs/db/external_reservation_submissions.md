# External reservation submissions

`public.external_reservation_submissions` stores attribution and submission metadata for reservation requests that arrive from public or external entry points.

`public.group_events` remains the operational reservation record. External submissions are linked to the reservation created in `group_events` through `external_reservation_submissions.group_event_id`.

## V1 model

- External requests use `group_events.status = 'pending'` while they wait for internal review.
- This model does not add an `external_pending` status.
- Future internal UI can show "Solicitud externa pendiente" when `group_events.status = 'pending'` and an associated `external_reservation_submissions` row exists.
- `group_events.status` continues to represent the operational reservation phase.
- `external_reservation_submissions` represents origin, acquisition and submission metadata.

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
3. Attempt CRM linking with `linkGroupEventCustomerFromSnapshot` on a best-effort basis.

If step 2 fails after the reservation row was created, the handler attempts to delete the just-created `group_events` row to avoid leaving an orphan reservation without external provenance.

## Access model

RLS is enabled on `public.external_reservation_submissions`.

Direct access for `anon` and `authenticated` is revoked. The table is granted to `service_role` for controlled server-side writes.

The future public endpoint must write server-side and must not expose the `service_role` key to the client. The public `Reserves_extern` app should not write directly with the anon key.
