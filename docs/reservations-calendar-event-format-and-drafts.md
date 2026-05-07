# Formato de reservas en Google Calendar y borradores

## Evento de Google Calendar

### Confirmado por código

La sincronización se ejecuta desde `src/app/api/calendar-sync/route.ts`.

El endpoint recibe `groupEventId`, lee `v_group_events_calendar_sync` y decide la acción:

- `create` si la reserva está en `confirmed` o `completed` y no tiene `calendar_event_id`.
- `update` si la reserva está en `confirmed` o `completed` y ya tiene `calendar_event_id`.
- `delete` si la reserva está en `cancelled` y tiene `calendar_event_id`.
- `noop` para el resto de casos o si `calendar_deleted_externally` está marcado.

Después carga datos de `group_events`, salas desde `group_room_allocations` y, con este PR, nombres de ofertas desde `group_event_offerings.display_name_snapshot`.

## Qué cambia en este PR

### Nuevo título

Antes, el título se construía como:

```txt
{grupo} {pax}px {hora}
```

Ahora se construye así:

```txt
{nombre reserva} · {pax} pax · {hora} · {oferta}
```

Si hay varias ofertas, se compactan con `+`:

```txt
Garcia · 28 pax · 21:00 · Menú A + Carta Bebidas
```

Si no hay oferta vinculada, el título no añade separadores vacíos:

```txt
Garcia · 28 pax · 21:00
```

El título empieza directamente por el nombre/grupo guardado en la reserva. No se añade el prefijo `Reserva`.

### Nueva descripción

La descripción mantiene la información operativa, pero omite líneas o secciones sin valor útil. Se consideran vacíos:

- `null`
- `undefined`
- texto en blanco
- `-`
- `--`
- `---`
- `—`
- `n/a`

Se mantienen los datos poblados de grupo, pax, hora de entrada, sala/zona, oferta, menú/carta, segundo plato legacy, alérgenos, notas de cocina, montaje, facturación, depósito, uso privado, estado y `Group ID`.

Los campos booleanos de privado solo aparecen si son `true`; no se muestran bloques de "No" para casos normales.

## Borradores de reservas

### Confirmado por código

La tabla `group_events` admite estos estados:

```txt
draft, pending, confirmed, completed, cancelled, no_show
```

El alta desde `/reservas/nueva` envía siempre:

```ts
status: 'confirmed'
```

Por tanto, crear una reserva nueva desde la pantalla actual no crea un borrador.

La pantalla de edición `/reservas/grupo/[id]` sí muestra un selector de estado con:

```txt
Borrador, Confirmado, Completado, Cancelado
```

Ese selector permite guardar una reserva existente como `draft`.

### No implementado

No hay botón específico de "Guardar como borrador" en la pantalla de creación.

No hay autosave tipo Gmail en `/reservas/nueva`: abandonar el formulario no crea ni persiste una reserva parcial.

No se ha encontrado un mecanismo de borrador local o remoto para recuperar formularios abandonados.

### Sincronización de borradores

`v_group_events_calendar_sync` solo considera sincronizables `confirmed` y `completed` para crear/actualizar eventos.

Un `draft` no se sincroniza con Google Calendar porque la vista devuelve `noop`.

Un `pending` tampoco se sincroniza con Google Calendar por la misma razón.

Una reserva pasa a ser sincronizable cuando su estado es `confirmed` o `completed`. Si una reserva previamente sincronizada se edita a `draft`, la vista no solicita actualización ni borrado del evento existente; queda como limitación operativa actual.

## Limitaciones actuales

- El título usa `group_event_offerings.display_name_snapshot`; si una reserva legacy solo tiene `menu_text` y no tiene filas en `group_event_offerings`, el título no intenta deducir una oferta desde texto libre.
- La sincronización sigue siendo manual desde los flujos actuales de creación/edición que llaman a `/api/calendar-sync`.
- El estado `pending` existe en el modelo, pero no aparece en el selector de edición actual y no se sincroniza.
- No se cambian esquema, migraciones, RLS ni RPCs en este PR.

## Recomendaciones operativas para Carla/Pau

- Para que una reserva aparezca en Google Calendar, mantenerla en `Confirmado` o `Completado`.
- Usar `Borrador` solo para reservas existentes que no deban entrar todavía en Calendar.
- Evitar pasar a `Borrador` una reserva que ya tiene evento en Calendar sin revisar manualmente el calendario, porque el sistema actual no borra ni actualiza ese evento en estado `draft`.
- Si se necesita un flujo real de borradores, definir una mejora separada: botón explícito en alta, autosave opcional y reglas claras sobre qué ocurre con eventos ya sincronizados.
