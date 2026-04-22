# Group event status CHECK constraint

El esquema debe mantener **un único CHECK** de `status` con el set amplio (`draft`, `pending`, `confirmed`, `completed`, `cancelled`, `no_show`). La app y la vista de calendar-sync necesitan todos estos valores, y un CHECK más estricto provoca fallos cuando se envían estados válidos desde la UI o los endpoints de la API.

Contexto en el código:
- `src/app/api/group-events/create/route.ts`
- `src/app/api/group-events/update/route.ts`

## Fase 2A (reservas ↔ cheffing)

- `group_events` sigue siendo la cabecera oficial de la reserva.
- `group_event_offerings` pasa a ser la referencia real de asignaciones de oferta (menús/carta).
- `group_events.menu_text` se mantiene como snapshot de compatibilidad y ahora se regenera automáticamente vía trigger desde `group_event_offerings`.
- En esta fase, la UI activa de reservas usa únicamente asignaciones `cheffing_menu` (no `cheffing_card` todavía).
