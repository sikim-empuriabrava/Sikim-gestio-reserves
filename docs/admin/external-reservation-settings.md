# Admin: configuracion de reservas externas

La app interna expone la pantalla `/admin/reservas-externas` para que un usuario con rol `admin` pueda decidir que oferta y que sala de cena se asignan automaticamente a las solicitudes que llegan desde el motor publico de reservas.

## Que guarda

La configuracion se guarda en `public.external_reservation_settings`, usando la fila singleton `id = true`.

La pantalla permite:

- desactivar la asignacion automatica;
- activar una carta Cheffing;
- activar un menu Cheffing;
- elegir una sala de cena por defecto o dejarla sin sala.

La carta/menu por defecto y la sala por defecto son configuraciones distintas. Desactivar la asignacion de carta/menu no obliga a limpiar la sala por defecto.

## Efecto operativo

- Si la asignacion de carta/menu esta desactivada, las nuevas reservas externas entran como `pending` sin oferta automatica.
- Si esta activada, `POST /api/external-reservation-requests` lee `external_reservation_settings` y aplica la carta o menu configurado en futuras solicitudes.
- Si `default_room_id` apunta a una sala de cena activa, el endpoint crea tambien una fila en `group_room_allocations` para que la reserva entre ya ubicada.
- La migracion inicial intenta usar la sala activa `medi` cuando existe exactamente una coincidencia con `lower(name) = 'medi'`.
- Si no hay sala configurada, la sala esta inactiva o falla la asignacion, la reserva entra igualmente como `pending` y se puede completar manualmente.
- El cambio no modifica reservas externas ya creadas; solo afecta a nuevas entradas.

## Validacion

- Solo se pueden seleccionar cartas activas de `cheffing_cards`.
- Solo se pueden seleccionar menus activos de `cheffing_menus`.
- Solo se pueden seleccionar salas activas de cena de `rooms`.
- La validacion final se hace server-side antes de persistir cambios.

## Seguridad

- La ruta cuelga de `/admin`, asi que queda protegida por el middleware y por la comprobacion server-side del layout de Admin.
- El guardado usa el patron interno de route handlers autenticados y opera con Supabase desde el servidor.
- No hay service role en cliente y no se hardcodea ninguna carta, menu o sala.
