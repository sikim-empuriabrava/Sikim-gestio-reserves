# CRM V1

El CRM V1 centraliza clientes nacidos desde reservas sin sustituir el snapshot operativo de cada reserva.

## Modelo

- `public.customers`: entidad principal del cliente. Guarda `display_name`, `notes`, `source`, `created_at` y `updated_at`.
- `public.customer_contacts`: telefonos y emails normalizados por cliente. Permite varios contactos y marca principal por tipo.
- `public.group_events.customer_id`: vincula una reserva con su cliente principal.

## Snapshot de reserva vs cliente CRM

Los campos `group_events.customer_name`, `group_events.customer_phone` y `group_events.customer_email` se mantienen como snapshot historico de lo que se indico en esa reserva. No se eliminan ni se reemplazan por el CRM.

`customers` y `customer_contacts` son la base central para buscar, editar notas y preparar futuras funcionalidades CRM/marketing.

## Backfill

La migracion CRM crea clientes desde reservas existentes solo cuando hay email o telefono. La deduplicacion inicial prioriza email normalizado y, si no existe email, telefono normalizado. Las reservas sin email ni telefono no crean cliente automaticamente para evitar contaminar el CRM con nombres de evento.

## Acceso

Las tablas CRM tienen RLS habilitado y se acceden desde servidor con `service_role`. La UI valida allowlist:

- lectura: `admin` o `can_reservas`;
- escritura: `admin`.
