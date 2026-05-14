ALTER FUNCTION public.generate_weekly_tasks_for_pack(p_week_start date, p_pack_id uuid, p_created_by_email text)
SET search_path = public, pg_temp;

ALTER FUNCTION public.tg_normalize_allowed_user_email()
SET search_path = public, pg_temp;

ALTER FUNCTION public.cheffing_set_purchase_document_effective_at()
SET search_path = public, pg_temp;

ALTER FUNCTION public.cheffing_set_purchase_document_storage_retention()
SET search_path = public, pg_temp;

ALTER FUNCTION public.cheffing_pos_import_status()
SET search_path = public, pg_temp;

ALTER FUNCTION public.tg_set_updated_at()
SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_text_to_numeric(v text)
SET search_path = public, pg_temp;

ALTER FUNCTION public.day_status_sync_legacy_columns()
SET search_path = public, pg_temp;

ALTER FUNCTION public.generate_weekly_tasks(p_week_start date, p_created_by_email text)
SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_split_pipe(v text)
SET search_path = public, pg_temp;

ALTER FUNCTION public.generate_weekly_tasks_auto(p_week_start date, p_created_by_email text)
SET search_path = public, pg_temp;

ALTER FUNCTION public.delete_routine_template(p_routine_id uuid, p_mode text, p_cutoff_week_start date)
SET search_path = public, pg_temp;

ALTER FUNCTION public.app_allowed_users_email_lowercase()
SET search_path = public, pg_temp;

ALTER FUNCTION public.cheffing_pos_refresh_sales_daily(p_from date, p_to date)
SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_norm_purchase_unit(v text)
SET search_path = public, pg_temp;

ALTER FUNCTION public.delete_routine_pack(p_pack_id uuid, p_mode text, p_cutoff_week_start date)
SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_bool_01(v text)
SET search_path = public, pg_temp;

ALTER FUNCTION public.cheffing_enforce_purchase_document_apply_ready()
SET search_path = public, pg_temp;

ALTER FUNCTION public.cheffing_menu_engineering_dish_cost(p_from date, p_to date)
SET search_path = public, pg_temp;

ALTER FUNCTION public.cheffing_set_purchase_line_effective_at()
SET search_path = public, pg_temp;

ALTER FUNCTION public.cheffing_sync_purchase_lines_effective_at()
SET search_path = public, pg_temp;

ALTER FUNCTION public.set_override_capacity()
SET search_path = public, pg_temp;

ALTER FUNCTION public.recalculate_group_staffing_plan(p_group_event_id uuid)
SET search_path = public, pg_temp;

ALTER FUNCTION public.trg_recalculate_group_staffing_plan()
SET search_path = public, pg_temp;

ALTER FUNCTION public.cheffing_apply_purchase_document(p_document_id uuid, p_applied_by text)
SET search_path = public, pg_temp;

ALTER FUNCTION public.set_updated_at()
SET search_path = public, pg_temp;

ALTER FUNCTION public.set_group_event_offerings_updated_at()
SET search_path = public, pg_temp;

ALTER FUNCTION public.refresh_group_event_menu_text(p_group_event_id uuid)
SET search_path = public, pg_temp;

ALTER FUNCTION public.trg_group_event_offerings_sync_menu_text()
SET search_path = public, pg_temp;

ALTER FUNCTION public.mark_past_events_completed()
SET search_path = public, pg_temp;

ALTER FUNCTION public.tg_group_event_offerings_sync_menu_text()
SET search_path = public, pg_temp;
