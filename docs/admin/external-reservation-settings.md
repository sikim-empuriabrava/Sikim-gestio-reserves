# Admin: configuracion de reservas externas

La app interna expone la pantalla `/admin/reservas-externas` para que un usuario con rol `admin` pueda decidir que oferta se asigna automaticamente a las solicitudes que llegan desde el motor publico de reservas.

## Que guarda

La configuracion se guarda en `public.external_reservation_settings`, usando la fila singleton `id = true`.

La pantalla permite:

- desactivar la asignacion automatica;
- activar una carta Cheffing;
- activar un menu Cheffing.

## Efecto operativo

- Si la asignacion automatica esta desactivada, las nuevas reservas externas entran como `pending` sin oferta automatica.
- Si esta activada, `POST /api/external-reservation-requests` lee `external_reservation_settings` y aplica la carta o menu configurado en futuras solicitudes.
- El cambio no modifica reservas externas ya creadas; solo afecta a nuevas entradas.

## Validacion

- Solo se pueden seleccionar cartas activas de `cheffing_cards`.
- Solo se pueden seleccionar menus activos de `cheffing_menus`.
- La validacion final se hace server-side antes de persistir cambios.

## Seguridad

- La ruta cuelga de `/admin`, asi que queda protegida por el middleware y por la comprobacion server-side del layout de Admin.
- El guardado usa el patron interno de route handlers autenticados y opera con Supabase desde el servidor.
- No hay service role en cliente y no se hardcodea ninguna carta o menu.
