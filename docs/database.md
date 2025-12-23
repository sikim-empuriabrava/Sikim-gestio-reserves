# Database schema snapshot

Generado: 2025-12-23T15:42:22Z

## Tablas
### app_allowed_users
RLS: habilitado

| Columna | Tipo | Nullable | Default |
| --- | --- | --- | --- |
| `email` | `text` | No |  |
| `role` | `text` | No | `'staff'::text` |
| `is_active` | `boolean` | No | `true` |
| `created_at` | `timestamp with time zone` | No | `now()` |
| `id` | `uuid` | No | `gen_random_uuid()` |

### day_status
RLS: deshabilitado

| Columna | Tipo | Nullable | Default |
| --- | --- | --- | --- |
| `event_date` | `date` | No |  |
| `validated_by` | `text` | Sí |  |
| `validated_at` | `timestamp with time zone` | No | `now()` |
| `day_notes` | `text` | Sí |  |
| `is_validated` | `boolean` | No | `false` |
| `events_last_reviewed_at` | `timestamp with time zone` | Sí |  |
| `cocina_notes` | `text` | Sí |  |
| `mantenimiento_notes` | `text` | Sí |  |
| `last_validated_at` | `timestamp with time zone` | Sí | `now()` |
| `last_validated_by` | `text` | Sí |  |
| `notes_general` | `text` | Sí |  |
| `notes_kitchen` | `text` | Sí |  |
| `notes_maintenance` | `text` | Sí |  |
| `validated` | `boolean` | No | `false` |
| `last_edited_at` | `timestamp with time zone` | Sí | `now()` |

### group_events
RLS: deshabilitado

| Columna | Tipo | Nullable | Default |
| --- | --- | --- | --- |
| `id` | `uuid` | No | `gen_random_uuid()` |
| `name` | `text` | No |  |
| `event_date` | `date` | No |  |
| `entry_time` | `time without time zone` | No |  |
| `has_private_dining_room` | `boolean` | No | `false` |
| `has_private_party` | `boolean` | No | `false` |
| `adults` | `integer` | No | `0` |
| `children` | `integer` | No | `0` |
| `total_pax` | `integer` | Sí | `(adults + children)` |
| `seconds_confirmed` | `boolean` | No | `false` |
| `second_course_type` | `text` | Sí |  |
| `menu_text` | `text` | Sí |  |
| `allergens_and_diets` | `text` | Sí |  |
| `extras` | `text` | Sí |  |
| `setup_notes` | `text` | Sí |  |
| `deposit_amount` | `numeric(10,2)` | Sí |  |
| `deposit_status` | `text` | Sí |  |
| `invoice_data` | `text` | Sí |  |
| `status` | `text` | No | `'confirmed'::text` |
| `created_at` | `timestamp with time zone` | No | `now()` |
| `updated_at` | `timestamp with time zone` | No | `now()` |
| `calendar_event_id` | `text` | Sí |  |
| `calendar_deleted_externally` | `boolean` | No | `false` |
| `service_outcome` | `group_service_outcome` | No | `'normal'::group_service_outcome` |
| `service_outcome_notes` | `text` | Sí |  |
| `menu_id` | `uuid` | Sí |  |

### group_room_allocations
RLS: deshabilitado

| Columna | Tipo | Nullable | Default |
| --- | --- | --- | --- |
| `id` | `uuid` | No | `gen_random_uuid()` |
| `group_event_id` | `uuid` | No |  |
| `room_id` | `uuid` | No |  |
| `adults` | `integer` | No | `0` |
| `children` | `integer` | No | `0` |
| `total_pax` | `integer` | Sí | `(adults + children)` |
| `override_capacity` | `boolean` | No | `false` |
| `notes` | `text` | Sí |  |
| `created_at` | `timestamp with time zone` | No | `now()` |
| `updated_at` | `timestamp with time zone` | No | `now()` |

### group_staffing_plans
RLS: deshabilitado

| Columna | Tipo | Nullable | Default |
| --- | --- | --- | --- |
| `id` | `uuid` | No | `gen_random_uuid()` |
| `group_event_id` | `uuid` | No |  |
| `staffing_ratio_id` | `uuid` | No |  |
| `total_pax` | `integer` | No |  |
| `recommended_waiters` | `integer` | No | `0` |
| `recommended_runners` | `integer` | No | `0` |
| `recommended_bartenders` | `integer` | No | `0` |
| `created_at` | `timestamp with time zone` | No | `now()` |
| `updated_at` | `timestamp with time zone` | No | `now()` |

### menu_second_courses
RLS: deshabilitado

| Columna | Tipo | Nullable | Default |
| --- | --- | --- | --- |
| `id` | `uuid` | No | `gen_random_uuid()` |
| `menu_id` | `uuid` | No |  |
| `code` | `text` | No |  |
| `name` | `text` | No |  |
| `description_kitchen` | `text` | No |  |
| `needs_doneness_points` | `boolean` | No | `false` |
| `sort_order` | `integer` | No | `0` |
| `created_at` | `timestamp with time zone` | No | `now()` |
| `updated_at` | `timestamp with time zone` | No | `now()` |

### menus
RLS: deshabilitado

| Columna | Tipo | Nullable | Default |
| --- | --- | --- | --- |
| `id` | `uuid` | No | `gen_random_uuid()` |
| `code` | `text` | No |  |
| `display_name` | `text` | No |  |
| `price_eur` | `numeric(10,2)` | No |  |
| `starters_text` | `text` | Sí |  |
| `dessert_text` | `text` | Sí |  |
| `drinks_text` | `text` | Sí |  |
| `created_at` | `timestamp with time zone` | No | `now()` |
| `updated_at` | `timestamp with time zone` | No | `now()` |

### rooms
RLS: deshabilitado

| Columna | Tipo | Nullable | Default |
| --- | --- | --- | --- |
| `id` | `uuid` | No | `gen_random_uuid()` |
| `name` | `text` | No |  |
| `capacity_seated` | `integer` | No | `0` |
| `capacity_standing` | `integer` | Sí | `0` |
| `sort_order` | `integer` | No | `0` |
| `is_active` | `boolean` | No | `true` |
| `created_at` | `timestamp with time zone` | No | `now()` |
| `updated_at` | `timestamp with time zone` | No | `now()` |

### routines
RLS: deshabilitado

| Columna | Tipo | Nullable | Default |
| --- | --- | --- | --- |
| `id` | `uuid` | No | `gen_random_uuid()` |
| `area` | `task_area` | No |  |
| `title` | `text` | No |  |
| `description` | `text` | Sí |  |
| `day_of_week` | `integer` | No |  |
| `priority` | `task_priority` | No | `'normal'::task_priority` |
| `is_active` | `boolean` | No | `true` |
| `created_at` | `timestamp with time zone` | No | `now()` |
| `updated_at` | `timestamp with time zone` | No | `now()` |

### staffing_ratios
RLS: deshabilitado

| Columna | Tipo | Nullable | Default |
| --- | --- | --- | --- |
| `id` | `uuid` | No | `gen_random_uuid()` |
| `name` | `text` | No |  |
| `waiter_per_pax` | `integer` | No |  |
| `runner_per_pax` | `integer` | No |  |
| `min_bartenders` | `integer` | No | `1` |
| `private_party_extra_bartender_per_pax` | `integer` | No |  |
| `is_active` | `boolean` | No | `true` |
| `valid_from` | `date` | Sí |  |
| `valid_to` | `date` | Sí |  |
| `created_at` | `timestamp with time zone` | No | `now()` |
| `updated_at` | `timestamp with time zone` | No | `now()` |

### tasks
RLS: deshabilitado

| Columna | Tipo | Nullable | Default |
| --- | --- | --- | --- |
| `id` | `uuid` | No | `gen_random_uuid()` |
| `area` | `task_area` | No |  |
| `title` | `text` | No |  |
| `description` | `text` | Sí |  |
| `status` | `task_status` | No | `'open'::task_status` |
| `priority` | `task_priority` | No | `'normal'::task_priority` |
| `due_date` | `date` | Sí |  |
| `created_by_email` | `text` | Sí |  |
| `created_at` | `timestamp with time zone` | No | `now()` |
| `updated_at` | `timestamp with time zone` | No | `now()` |


## ENUMs
- `group_service_outcome`: `normal`, `annotation`, `incident`, `no_show`, `note`
- `task_area`: `maintenance`, `kitchen`
- `task_priority`: `low`, `normal`, `high`
- `task_status`: `open`, `in_progress`, `done`

## RLS & Policies
| Tabla | Política | Comando | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- | --- |
| `app_allowed_users` | `read own allowlist row` | SELECT | authenticated | `((is_active = true) AND (email = COALESCE((auth.jwt() ->> 'email'::text), current_setting('request.jwt.claim.email'::text, true))))` | `` |

## Triggers
| Tabla | Trigger | Timing | Eventos |
| --- | --- | --- | --- |
| `group_events` | `set_timestamp_group_events` | BEFORE | UPDATE |
| `group_events` | `trg_group_events_recalculate_staffing` | AFTER | INSERT, UPDATE |
| `group_room_allocations` | `set_timestamp_group_room_allocations` | BEFORE | UPDATE |
| `group_room_allocations` | `trg_set_override_capacity` | BEFORE | INSERT, UPDATE |
| `group_staffing_plans` | `set_timestamp_group_staffing_plans` | BEFORE | UPDATE |
| `menu_second_courses` | `set_updated_at_menu_second_courses` | BEFORE | UPDATE |
| `menus` | `set_updated_at_menus` | BEFORE | UPDATE |
| `rooms` | `set_timestamp_rooms` | BEFORE | UPDATE |
| `routines` | `set_timestamp_routines` | BEFORE | UPDATE |
| `tasks` | `set_timestamp_tasks` | BEFORE | UPDATE |

## Functions
| Función | Args | Devuelve |
| --- | --- | --- |
| `mark_past_events_completed` | `` | `void` |
| `recalculate_group_staffing_plan` | `p_group_event_id uuid` | `void` |
| `set_override_capacity` | `` | `trigger` |
| `set_updated_at` | `` | `trigger` |
| `trg_recalculate_group_staffing_plan` | `` | `trigger` |

## Cómo actualizar
- Local/Codex: `SUPABASE_DB_URL=... bash scripts/db_snapshot.sh`
- GitHub Actions: workflow `db-schema-snapshot` (workflow_dispatch)
