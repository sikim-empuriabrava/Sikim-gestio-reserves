# Group event status CHECK constraint

El esquema debe mantener **un único CHECK** de `status` con el set amplio (`draft`, `pending`, `confirmed`, `completed`, `cancelled`, `no_show`). La app y la vista de calendar-sync necesitan todos estos valores, y un CHECK más estricto provoca fallos cuando se envían estados válidos desde la UI o los endpoints de la API.

Contexto en el código:
- `src/app/api/group-events/create/route.ts`
- `src/app/api/group-events/update/route.ts`

## Fase 2B (reservas ↔ cheffing, detalle estructurado)

- `group_events` sigue siendo la cabecera oficial de la reserva.
- `group_event_offerings` es la referencia real de asignaciones de oferta principal (`cheffing_menu` / `cheffing_card`).
- `group_event_offering_selections` guarda el detalle real operativo para cocina dentro de cada oferta de menú (`menu_second`, `custom_menu`, `kids_menu`).
- `group_event_offering_selection_doneness` guarda los puntos de cocción por selección cuando aplique.
- `group_events.menu_text` es **snapshot derivado** (compatibilidad para calendario/cocina/tareas), regenerado automáticamente desde la estructura completa de ofertas + selecciones + doneness.
- El alta/edición de reservas con ofertas Cheffing se ejecuta mediante RPCs transaccionales en Postgres (`create_group_event_with_cheffing_offerings` y `update_group_event_with_cheffing_offerings`) para evitar estados parciales.
- Payload recomendado de escritura: `offeringAssignments` con `secondSelections` para `cheffing_menu`.
- Regla de menús inactivos en edición: se permiten **solo si ya estaban vinculados históricamente** a la reserva; no se admiten nuevas altas de menús inactivos.
- `/api/reservas/offering-catalog` es el contrato principal para `/reservas/nueva`.
- `/api/menus` se mantiene como compatibilidad legacy para flujos antiguos.
