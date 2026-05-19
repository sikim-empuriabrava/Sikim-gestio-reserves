# Formato de reservas en Google Calendar y borradores

## Evento de Google Calendar

La sincronizacion se ejecuta desde `src/app/api/calendar-sync/route.ts`.

El endpoint recibe `groupEventId`, lee `v_group_events_calendar_sync` y decide la accion:

- `create` si la reserva esta en `confirmed` o `completed` y no tiene `calendar_event_id`.
- `update` si la reserva esta en `confirmed` o `completed` y ya tiene `calendar_event_id`.
- `delete` si la reserva esta en `draft`, `pending` o `cancelled` y tiene `calendar_event_id`.
- `noop` para el resto de casos. Si `calendar_deleted_externally` esta marcado, tambien devuelve `noop`, salvo cuando un estado interno no sincronizable conserva `calendar_event_id` y necesita limpieza.

Despues carga datos de `group_events`, sala de cena desde `group_room_allocations`, zona de fiesta desde `group_events.party_room_id`
y nombres de ofertas desde `group_event_offerings.display_name_snapshot`.

## Nombre de reserva y cliente/contacto

`group_events.name` es el nombre operativo de la reserva. Identifica el evento concreto para el equipo y se usa como
nombre principal en el calendario interno, Google Calendar e informes. Ejemplos: `Cumpleanos Laura`,
`Graduacion INS Castello`, `Empresa Garcia`.

Los datos de cliente/contacto viven separados en `group_events.customer_name`, `group_events.customer_phone` y
`group_events.customer_email`. Representan la persona que gestiona la reserva y quedan preparados como base futura de
CRM, sin crear todavia una tabla `customers`.

Google Calendar usa el nombre de reserva en el titulo. Los datos de cliente/contacto, cuando existen, se anaden a la
descripcion y se omiten si estan vacios.

## Modalidades internas

`group_events.event_mode` admite:

- `dinner`: cena/comida normal. Usa sala de cena/restaurante en `group_room_allocations`. No usa `party_room_id`.
- `dinner_private_party`: cena/comida con fiesta privada posterior. Conserva sala de cena y comida; usa `party_room_id` para la zona de fiesta (`Pub` o `Disco`).
- `private_party_only`: solo fiesta privada. No usa sala de cena ni ofertas/comida; usa `party_room_id` para la zona de fiesta (`Pub` o `Disco`).

La sala de cena/restaurante y la zona de fiesta son conceptos distintos:

- Sala de cena: donde come el grupo; se guarda con el sistema actual de `group_room_allocations`.
- Zona de fiesta: `Pub` o `Disco`; se guarda en `group_events.party_room_id`.

### Titulo

El titulo se construye asi:

```txt
{nombre reserva} · {pax} pax · {hora} · {oferta}
```

Si hay varias ofertas, se compactan con `+`:

```txt
Garcia · 28 pax · 21:00 · Menú A + Carta Bebidas
```

Si no hay oferta vinculada, el titulo no anade separadores vacios:

```txt
Garcia · 28 pax · 21:00
```

Para reservas internas con `event_mode = private_party_only`, el titulo usa la modalidad como oferta:

```txt
Garcia · 40 pax · 23:30 · Solo fiesta privada
```

Para `event_mode = dinner_private_party`, el titulo usa la modalidad como sufijo:

```txt
Garcia · 40 pax · 21:00 · Cena + fiesta privada
```

El titulo empieza directamente por el nombre/grupo guardado en la reserva. No se anade el prefijo `Reserva`.

### Descripcion

La descripcion mantiene la informacion operativa, pero omite lineas o secciones sin valor util. Se consideran vacios:

- `null`
- `undefined`
- texto en blanco
- `-`
- `--`
- `---`
- raya larga
- `n/a`

Se mantienen los datos poblados de grupo, cliente/contacto, telefono, email, pax, hora de entrada, sala/zona, oferta, menu/carta, segundo plato legacy, alergenos, notas de cocina, montaje, facturacion, deposito, uso privado, estado y `Group ID`.

Los campos booleanos de privado solo aparecen si son `true`; no se muestran bloques de "No" para casos normales.

En `dinner_private_party`, Calendar muestra `Modalidad: Cena + fiesta privada`, `Sala cena: ...`, `Zona fiesta: Pub/Disco`
y mantiene oferta, menu/comida, montaje, facturacion, deposito, estado y `Group ID`.

En `private_party_only`, Calendar muestra `Modalidad: Solo fiesta privada`, `Zona fiesta: Pub/Disco`, no sincroniza bloques
de menu/comida y sigue incluyendo montaje, facturacion, deposito, uso privado, estado y `Group ID` cuando existan.

## Borradores de reservas

La tabla `group_events` admite estos estados:

```txt
draft, pending, confirmed, completed, cancelled, no_show
```

El alta desde `/reservas/nueva` tiene dos acciones explicitas:

- `Crear reserva confirmada`: guarda `status: 'confirmed'` y llama a `/api/calendar-sync`.
- `Guardar borrador`: guarda `status: 'draft'` y no llama a `/api/calendar-sync`.

La pantalla de edicion `/reservas/grupo/[id]` muestra un selector de estado con:

```txt
Borrador, Confirmado, Completado, Cancelado
```

Ese selector permite guardar una reserva existente como `draft`.

## Cancelar vs eliminar

`Cancelada` (`status = cancelled`) es el estado operativo para una reserva real anulada por el cliente. Se conserva en
Sikim como histórico de trabajo, y si tenía `calendar_event_id`, `/api/calendar-sync` elimina el evento externo y limpia
el identificador.

`Eliminar reserva` es una acción destructiva distinta para registros creados por error, duplicados o pruebas. Se ejecuta
desde `/reservas/grupo/[id]`, pide confirmación en modal y llama a `DELETE /api/group-events/[id]`. Si hay
`calendar_event_id`, primero intenta borrar el evento de Google Calendar; si ese borrado falla, la reserva no se elimina
de Sikim. Al borrar `group_events`, las relaciones directas de sala, staffing y ofertas estructuradas se limpian por las
FK `ON DELETE CASCADE` verificadas en el esquema.

No hay autosave tipo Gmail en `/reservas/nueva`: abandonar el formulario no crea ni persiste una reserva parcial.

No hay un mecanismo de borrador local o remoto para recuperar formularios abandonados.

## Sincronizacion de borradores

`v_group_events_calendar_sync` solo considera sincronizables `confirmed` y `completed` para crear/actualizar eventos.

Un `draft` sin `calendar_event_id` no se sincroniza con Google Calendar porque la vista devuelve `noop`.

Un `pending` sin `calendar_event_id` tampoco se sincroniza con Google Calendar por la misma razon.

Si una reserva previamente sincronizada se edita a `draft`, `pending` o `cancelled`, la vista devuelve `delete` y `/api/calendar-sync` borra el evento externo y limpia `calendar_event_id`.

Una reserva pasa a ser sincronizable cuando su estado es `confirmed` o `completed`. Si un borrador pasa a `confirmed`, `/api/calendar-sync` crea el evento porque no hay `calendar_event_id`.

Una reserva `dinner_private_party` o `private_party_only` se comporta igual que cualquier otra reserva para borradores:
no se sincroniza si esta en `draft` y si esta `confirmed` o `completed` se crea/actualiza en Google Calendar.

## Limitaciones actuales

- El titulo usa `group_event_offerings.display_name_snapshot`; si una reserva legacy solo tiene `menu_text` y no tiene filas en `group_event_offerings`, el titulo no intenta deducir una oferta desde texto libre.
- La sincronizacion sigue siendo manual desde los flujos actuales de creacion/edicion que llaman a `/api/calendar-sync`.
- El estado `pending` existe en el modelo, pero no aparece en el selector de edicion actual.
- La migracion de borradores solo reemplaza `v_group_events_calendar_sync`; no cambia tablas, RLS, policies ni RPCs.

## Recomendaciones operativas

- Para que una reserva aparezca en Google Calendar, mantenerla en `Confirmado` o `Completado`.
- Usar `Borrador` para reservas internas que deben verse en Sikim pero aun no deben salir a Google Calendar.
- Si una reserva sincronizada vuelve a `Borrador`, guardar cambios lanza `/api/calendar-sync`, borra el evento externo y limpia `calendar_event_id`.
