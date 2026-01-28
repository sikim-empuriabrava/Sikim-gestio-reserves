# Group event status CHECK constraint

El esquema debe mantener **un único CHECK** de `status` con el set amplio (`draft`, `pending`, `confirmed`, `completed`, `cancelled`, `no_show`). La app y la vista de calendar-sync necesitan todos estos valores, y un CHECK más estricto provoca fallos cuando se envían estados válidos desde la UI o los endpoints de la API.

Contexto en el código:
- `src/app/api/group-events/create/route.ts`
- `src/app/api/group-events/update/route.ts`
