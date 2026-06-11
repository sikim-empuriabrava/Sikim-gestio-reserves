# Architecture notes

## External reservation customer confirmations

Customer confirmation emails are owned by the internal reservation management app.

The public reservation flow only creates a pending operational reservation through `POST /api/external-reservation-requests`. The internal app detects that a reservation is external by checking for a matching row in `public.external_reservation_submissions`.

When an internal admin updates a group reservation through `/api/group-events/update`, the route:

1. reads the previous `group_events.status`;
2. applies the normal reservation update flow;
3. checks that `previousStatus !== 'confirmed'` and the requested new status is `confirmed`;
4. verifies that `external_reservation_submissions.group_event_id = group_events.id` exists;
5. attempts the customer email confirmation as a best-effort side effect.

The side effect does not block the reservation save. Failures are logged server-side and recorded in `public.customer_reservation_notifications` when the idempotency row can be written.

Only the `email` channel and `reservation_confirmed` notification type exist in this phase. SMS, WhatsApp, tracking, cookies/legal and public-site changes are intentionally out of scope.

The Resend provider is called with `fetch`; no SDK or dependency is installed.

The email template lives in:

```txt
src/lib/server/customer-notifications/reservationConfirmationEmailTemplate.ts
```

The template sends only customer-facing reservation basics:

- customer name;
- reservation date;
- reservation time;
- party size;
- Google Maps link.

It must not include comments, extras, allergies, diets, internal notes, invoice data, source attribution, UTM fields, internal IDs or tracking data.
