# Auditoría de permisos y seguridad

Fecha: 2025-02-14

## Alcance
- Revisión de **Route Handlers** en `src/app/api/**/route.ts`.
- Revisión de **SSR (Server Components / layouts / pages)** con uso de admin client o lecturas sensibles.

## 1) Tabla de endpoints

| Archivo | Método | Tipo de acceso | Valida auth | Valida allowlist | Usa admin client | mergeResponseCookies | Observaciones / riesgos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `src/app/api/group-events/service-outcome/route.ts` | POST | admin-only | `auth.getUser()` | `getAllowlistRoleForUserEmail` + `isAdmin` | Sí | Sí | Actualiza outcome de grupo; validaciones correctas antes de usar admin client. |
| `src/app/api/group-events/create/route.ts` | POST | admin-only | `auth.getUser()` | `getAllowlistRoleForUserEmail` + `isAdmin` | Sí | Sí | Inserta en `group_events` y `group_room_allocations`. |
| `src/app/api/group-events/today/route.ts` | GET | allowlisted | `auth.getUser()` | `getAllowlistRoleForUserEmail` | Sí | Sí | Lee `group_events` para el día actual. |
| `src/app/api/group-events/update/route.ts` | POST | admin-only | `auth.getUser()` | `getAllowlistRoleForUserEmail` + `isAdmin` | Sí | Sí | Actualiza `group_events`. |
| `src/app/api/day-status/route.ts` | GET | allowlisted | `auth.getUser()` | `getAllowlistRoleForUserEmail` | Sí | Sí | Lee `v_day_status` por fecha. |
| `src/app/api/day-status/route.ts` | POST | admin-only | `auth.getUser()` | `getAllowlistRoleForUserEmail` + `isAdmin` | Sí | Sí | Upsert en `day_status` y lectura posterior de `v_day_status`. |
| `src/app/api/rooms/route.ts` | GET | allowlisted | `auth.getUser()` | `getAllowlistRoleForUserEmail` | Sí | Sí | Lee `rooms` activos. |
| `src/app/api/routines/route.ts` | GET | allowlisted | `auth.getUser()` | `getAllowlistRoleForUserEmail` | Sí | Sí | Lee `routines` con filtros opcionales. |
| `src/app/api/routines/route.ts` | POST | admin-only | `auth.getUser()` | `getAllowlistRoleForUserEmail` + `isAdmin` | Sí | Sí | Inserta en `routines`. |
| `src/app/api/routines/[id]/route.ts` | PATCH | admin-only | `auth.getUser()` | `getAllowlistRoleForUserEmail` + `isAdmin` | Sí | Sí | Actualiza `routines` por id. |
| `src/app/api/routines/[id]/route.ts` | DELETE | admin-only | `auth.getUser()` | `getAllowlistRoleForUserEmail` + `isAdmin` | Sí | Sí | Ejecuta RPC `delete_routine_template`. |
| `src/app/api/routines/generate-week/route.ts` | POST | admin-only | `auth.getUser()` | `getAllowlistRoleForUserEmail` + `isAdmin` | Sí | Sí | Ejecuta RPC de generación semanal. |
| `src/app/api/routine-packs/route.ts` | GET | allowlisted | `auth.getUser()` | `getAllowlistRoleForUserEmail` | Sí | Sí | Lee `routine_packs`. |
| `src/app/api/routine-packs/route.ts` | POST | admin-only | `auth.getUser()` | `getAllowlistRoleForUserEmail` + `isAdmin` | Sí | Sí | Inserta en `routine_packs`. |
| `src/app/api/routine-packs/[id]/route.ts` | PATCH | admin-only | `auth.getUser()` | `getAllowlistRoleForUserEmail` + `isAdmin` | Sí | Sí | Actualiza `routine_packs` por id. |
| `src/app/api/routine-packs/[id]/route.ts` | DELETE | admin-only | `auth.getUser()` | `getAllowlistRoleForUserEmail` + `isAdmin` | Sí | Sí | Ejecuta RPC `delete_routine_pack`. |
| `src/app/api/calendar-sync/route.ts` | POST | admin-only | `auth.getUser()` | `getAllowlistRoleForUserEmail` + `isAdmin` | Sí | Sí | Orquesta sync con Google Calendar y actualiza `group_events`. |
| `src/app/api/tasks/route.ts` | GET | allowlisted | `auth.getUser()` | `getAllowlistRoleForUserEmail` | Sí | Sí | Lee `tasks` con filtros. |
| `src/app/api/tasks/route.ts` | POST | admin-only | `auth.getUser()` | `getAllowlistRoleForUserEmail` + `isAdmin` | Sí | Sí | Inserta en `tasks`. |
| `src/app/api/tasks/[id]/route.ts` | PATCH | allowlisted | `auth.getUser()` | `getAllowlistRoleForUserEmail` | Sí | Sí | Actualiza estado/prioridad por id. |
| `src/app/api/tasks/[id]/status/route.ts` | POST | allowlisted | `auth.getUser()` | `getAllowlistRoleForUserEmail` | Sí | Sí | Actualiza estado por id. |
| `src/app/api/debug/whoami/route.ts` | GET | allowlisted | `auth.getUser()` | `getAllowlistRoleForUserEmail` | Sí | Sí | Devuelve info de allowlist del usuario. |
| `src/app/api/menus/route.ts` | GET | allowlisted | `auth.getUser()` | `getAllowlistRoleForUserEmail` | Sí | Sí | Lee menús disponibles. |
| `src/app/api/health/route.ts` | GET | public | n/a | n/a | No | n/a | Endpoint de health sin auth. |
| `src/app/api/version/route.ts` | GET | public | n/a | n/a | No | n/a | Expone metadatos de despliegue. |

## 2) Tabla SSR

| Archivo | Tipo | Usa admin client | Qué datos lee | Protegido por layout allowlist | Observaciones / riesgos |
| --- | --- | --- | --- | --- | --- |
| `src/app/(app)/layout.tsx` | layout (server) | Sí (indirecto via allowlist) | `auth.getUser()` + `app_allowed_users` (allowlist) | Sí (este layout aplica el guard) | Guard central para todo `(app)`; usa admin client en el helper de allowlist. |
| `src/app/(app)/admin/layout.tsx` | layout (server) | Sí (indirecto via allowlist) | `auth.getUser()` + `app_allowed_users` (allowlist) | Sí (este layout aplica guard + admin role) | Restringe a admin antes de renderizar `/admin`. |
| `src/app/(app)/debug-supabase/page.tsx` | page (server) | Sí | `group_events` (últimas 50) | Sí (layout `(app)`) | Página de debug con datos sensibles; depende de `ENABLE_DEBUG_PAGES`. |
| `src/app/(app)/debug-calendar-sync/page.tsx` | page (server) | Sí | `v_group_events_calendar_sync` | Sí (layout `(app)`) | Página de debug con datos de sync; depende de `ENABLE_DEBUG_PAGES`. |
| `src/app/(app)/mantenimiento/page.tsx` | page (server) | Sí | `day_status` (notas mantenimiento) | Sí (layout `(app)`) | Lee notas del día con admin client. |
| `src/app/(app)/mantenimiento/rutinas/page.tsx` | page (server) | Sí | `tasks` (rutinas mantenimiento) | Sí (layout `(app)`) | Lee tareas por semana y área. |
| `src/app/(app)/mantenimiento/tareas/page.tsx` | page (server) | Sí | `tasks` (mantenimiento) | Sí (layout `(app)`) | Lee tareas de mantenimiento. |
| `src/app/(app)/cocina/page.tsx` | page (server) | Sí | `day_status` (notas cocina) + `/api/group-events/today` | Sí (layout `(app)`) | Datos de reservas y notas del día. |
| `src/app/(app)/cocina/tareas/page.tsx` | page (server) | Sí | `tasks` (cocina) | Sí (layout `(app)`) | Lee tareas de cocina. |
| `src/app/(app)/reservas/page.tsx` | page (server) | Sí | `v_day_status`, `v_group_events_daily_detail` | Sí (layout `(app)`) | Lecturas amplias de reservas y notas por día/semana/mes. |
| `src/app/(app)/reservas/grupo/[id]/page.tsx` | page (server) | Sí | `group_events` (detalle completo de reserva) | Sí (layout `(app)`) | Detalle completo de reserva por id. |

## 3) Top issues (priorizado)

- **P2** – Las páginas de debug (`/debug-supabase`, `/debug-calendar-sync`) usan admin client y exponen datos sensibles cuando `ENABLE_DEBUG_PAGES=true`. Actualmente solo están protegidas por allowlist genérico (no por rol admin). Considerar exigir rol admin o un flag adicional de seguridad. (Archivos: `src/app/(app)/debug-supabase/page.tsx`, `src/app/(app)/debug-calendar-sync/page.tsx`).
- **P0/P1** – No se detectaron: no hay uso de `getSession` en route handlers, no hay retornos sin `mergeResponseCookies`, ni uso de admin client antes de guardas de auth/allowlist en handlers revisados.
