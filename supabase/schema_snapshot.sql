--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: group_service_outcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.group_service_outcome AS ENUM (
    'normal',
    'annotation',
    'incident',
    'no_show',
    'note'
);


--
-- Name: task_area; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_area AS ENUM (
    'maintenance',
    'kitchen'
);


--
-- Name: task_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_priority AS ENUM (
    'low',
    'normal',
    'high'
);


--
-- Name: task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_status AS ENUM (
    'open',
    'in_progress',
    'done'
);


--
-- Name: app_allowed_users_email_lowercase(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_allowed_users_email_lowercase() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.email is not null then
    new.email := lower(new.email);
  end if;
  return new;
end;
$$;


--
-- Name: cheffing_apply_purchase_document(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cheffing_apply_purchase_document(p_document_id uuid, p_applied_by text DEFAULT NULL::text) RETURNS TABLE(applied_lines integer, updated_ingredients integer)
    LANGUAGE plpgsql
    AS $$
declare
  v_document record;
  v_applied_at timestamptz := now();
  v_line_count integer;
  v_updated_ingredients integer;
begin
  select d.id, d.status, d.supplier_id, d.effective_at
  into v_document
  from public.cheffing_purchase_documents d
  where d.id = p_document_id
  for update;

  if not found then
    raise exception 'Document % not found', p_document_id;
  end if;

  if v_document.status <> 'draft' then
    raise exception 'Only draft documents can be applied';
  end if;

  if v_document.supplier_id is null then
    raise exception 'Document requires supplier before apply';
  end if;

  select count(*)::integer
  into v_line_count
  from public.cheffing_purchase_document_lines l
  where l.document_id = p_document_id;

  if v_line_count = 0 then
    raise exception 'Document % cannot be applied without lines', p_document_id;
  end if;

  if exists (
    select 1
    from public.cheffing_purchase_document_lines l
    where l.document_id = p_document_id
      and l.line_status <> 'resolved'
  ) then
    raise exception 'Document % cannot be applied while unresolved lines exist', p_document_id;
  end if;

  if exists (
    select 1
    from public.cheffing_purchase_document_lines l
    where l.document_id = p_document_id
      and l.validated_ingredient_id is null
  ) then
    raise exception 'All lines require validated ingredient before apply';
  end if;

  if exists (
    select 1
    from public.cheffing_purchase_document_lines l
    where l.document_id = p_document_id
      and l.raw_unit_price is null
  ) then
    raise exception 'All lines require raw_unit_price in manual V1';
  end if;

  insert into public.cheffing_ingredient_cost_audit (
    ingredient_id,
    purchase_document_id,
    purchase_document_line_id,
    supplier_id,
    previous_cost,
    new_cost,
    document_effective_at,
    applied_by,
    applied_at
  )
  select
    l.validated_ingredient_id as ingredient_id,
    p_document_id as purchase_document_id,
    l.id as purchase_document_line_id,
    v_document.supplier_id,
    i.purchase_price as previous_cost,
    l.raw_unit_price as new_cost,
    v_document.effective_at as document_effective_at,
    p_applied_by,
    v_applied_at
  from public.cheffing_purchase_document_lines l
  join public.cheffing_ingredients i on i.id = l.validated_ingredient_id
  where l.document_id = p_document_id;

  update public.cheffing_purchase_documents d
  set
    status = 'applied',
    applied_by = p_applied_by,
    applied_at = v_applied_at,
    updated_at = now()
  where d.id = p_document_id;

  with affected_ingredients as (
    select distinct l.validated_ingredient_id as ingredient_id
    from public.cheffing_purchase_document_lines l
    where l.document_id = p_document_id
  ),
  ranked_costs as (
    select
      a.ingredient_id,
      a.new_cost,
      row_number() over (
        partition by a.ingredient_id
        order by a.document_effective_at desc, a.new_cost desc, a.applied_at desc, a.id desc
      ) as rn
    from public.cheffing_ingredient_cost_audit a
    join affected_ingredients ai on ai.ingredient_id = a.ingredient_id
  )
  update public.cheffing_ingredients i
  set purchase_price = rc.new_cost,
      updated_at = now()
  from ranked_costs rc
  where i.id = rc.ingredient_id
    and rc.rn = 1;

  get diagnostics v_updated_ingredients = row_count;

  return query select v_line_count, coalesce(v_updated_ingredients, 0);
end;
$$;


--
-- Name: cheffing_enforce_purchase_document_apply_ready(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cheffing_enforce_purchase_document_apply_ready() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.status = 'applied' and (tg_op = 'INSERT' or old.status is distinct from 'applied') then
    if exists (
      select 1
      from public.cheffing_purchase_document_lines l
      where l.document_id = new.id
        and l.line_status <> 'resolved'
    ) then
      raise exception 'Document % cannot be applied while unresolved lines exist', new.id;
    end if;

    if not exists (
      select 1
      from public.cheffing_purchase_document_lines l
      where l.document_id = new.id
    ) then
      raise exception 'Document % cannot be applied without lines', new.id;
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: cheffing_is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cheffing_is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.app_allowed_users
    where is_active = true
      and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and role = 'admin'
  );
$$;


--
-- Name: cheffing_is_allowed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cheffing_is_allowed() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.app_allowed_users
    where is_active = true
      and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (role = 'admin' or can_cheffing = true)
  );
$$;


--
-- Name: cheffing_menu_engineering_dish_cost(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cheffing_menu_engineering_dish_cost(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date) RETURNS TABLE(id uuid, name text, selling_price numeric, cost_per_serving numeric, created_at timestamp with time zone, updated_at timestamp with time zone, units_sold integer)
    LANGUAGE sql STABLE
    AS $$
with item_costs as (
  select
    d.id as dish_id,
    case
      when count(item_lines.id) = 0 then 0::numeric
      when count(item_lines.compatible_cost) = 0 then null::numeric
      else sum(item_lines.compatible_cost)
    end as items_cost_total
  from public.cheffing_dishes d
  left join (
    select
      di.id,
      di.dish_id,
      case
        when di.ingredient_id is not null
          and u_item.dimension = vic.purchase_unit_dimension
          then (vic.cost_net_per_base * (di.quantity * u_item.to_base_factor))
            / nullif(1 - coalesce(di.waste_pct_override, vic.waste_pct, 0), 0)
        when di.subrecipe_id is not null
          and u_item.dimension = vsc.output_unit_dimension
          then (vsc.cost_net_per_base * (di.quantity * u_item.to_base_factor))
            / nullif(1 - coalesce(di.waste_pct_override, 0), 0)
        else null
      end as compatible_cost
    from public.cheffing_dish_items di
    left join public.v_cheffing_ingredients_cost vic
      on vic.id = di.ingredient_id
    left join public.v_cheffing_subrecipe_cost vsc
      on vsc.id = di.subrecipe_id
    left join public.cheffing_units u_item
      on u_item.code = di.unit_code
  ) item_lines
    on item_lines.dish_id = d.id
  group by d.id
),
sold_units as (
  select
    l.dish_id,
    sum(coalesce(s.units, 0))::integer as units_sold
  from public.cheffing_pos_product_links l
  left join public.cheffing_pos_sales_daily s
    on s.pos_product_id = l.pos_product_id
   and (p_from is null or s.sale_day >= p_from)
   and (p_to   is null or s.sale_day <= p_to)
  group by l.dish_id
)
select
  d.id,
  d.name,
  d.selling_price,
  (ic.items_cost_total / nullif(coalesce(d.servings, 1), 0)::numeric) as cost_per_serving,
  d.created_at,
  d.updated_at,
  coalesce(su.units_sold, d.units_sold, 0)::integer as units_sold
from public.cheffing_dishes d
left join item_costs ic
  on ic.dish_id = d.id
left join sold_units su
  on su.dish_id = d.id;
$$;


--
-- Name: cheffing_pos_import_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cheffing_pos_import_status() RETURNS TABLE(last_order_id text, last_opened_at timestamp without time zone, range_from date, range_to date)
    LANGUAGE sql STABLE
    AS $$
  select
    (select pos_order_id
     from cheffing_pos_orders
     order by opened_at desc, pos_order_id desc
     limit 1) as last_order_id,

    (select opened_at
     from cheffing_pos_orders
     order by opened_at desc, pos_order_id desc
     limit 1) as last_opened_at,

    (select min(opened_at)::date from cheffing_pos_orders) as range_from,

    (select max(opened_at)::date from cheffing_pos_orders) as range_to;
$$;


--
-- Name: cheffing_pos_refresh_sales_daily(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cheffing_pos_refresh_sales_daily(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.cheffing_pos_sales_daily (
    sale_day,
    outlet_id,
    pos_product_id,
    units,
    revenue,
    source,
    created_at,
    updated_at
  )
  select
    oi.opened_at::date as sale_day,
    oi.outlet_id,
    (oi.outlet_id || ':' || oi.product_name) as pos_product_id,
    sum(oi.quantity)::numeric as units,
    sum(oi.total_gross)::numeric as revenue,
    'csv' as source,
    now(),
    now()
  from public.cheffing_pos_order_items oi
  where (p_from is null or oi.opened_at::date >= p_from)
    and (p_to is null or oi.opened_at::date <= p_to)
  group by 1,2,3
  on conflict (sale_day, outlet_id, pos_product_id)
  do update set
    units = excluded.units,
    revenue = excluded.revenue,
    source = excluded.source,
    updated_at = now();
end $$;


--
-- Name: cheffing_set_purchase_document_effective_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cheffing_set_purchase_document_effective_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.effective_at := new.document_date::timestamp + coalesce(new.document_time, time '00:00:00');

  return new;
end;
$$;


--
-- Name: cheffing_set_purchase_document_storage_retention(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cheffing_set_purchase_document_storage_retention() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.status = 'applied' then
    new.storage_delete_after := coalesce(new.storage_delete_after, now() + interval '7 days');
  else
    new.storage_delete_after := null;
  end if;

  return new;
end;
$$;


--
-- Name: cheffing_set_purchase_line_effective_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cheffing_set_purchase_line_effective_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  select d.effective_at into new.line_effective_at
  from public.cheffing_purchase_documents d
  where d.id = new.document_id;

  return new;
end;
$$;


--
-- Name: cheffing_sync_purchase_lines_effective_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cheffing_sync_purchase_lines_effective_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  update public.cheffing_purchase_document_lines
  set line_effective_at = new.effective_at
  where document_id = new.id;

  return new;
end;
$$;


--
-- Name: day_status_sync_legacy_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.day_status_sync_legacy_columns() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  -- Notes: canonical <-> legacy
  if new.notes_general is null and new.day_notes is not null then
    new.notes_general := new.day_notes;
  end if;
  new.day_notes := coalesce(new.notes_general, '');

  if new.notes_kitchen is null and new.cocina_notes is not null then
    new.notes_kitchen := new.cocina_notes;
  end if;
  new.cocina_notes := coalesce(new.notes_kitchen, '');

  if new.notes_maintenance is null and new.mantenimiento_notes is not null then
    new.notes_maintenance := new.mantenimiento_notes;
  end if;
  new.mantenimiento_notes := coalesce(new.notes_maintenance, '');

  -- Validation flags: keep in sync
  new.validated := coalesce(new.validated, new.is_validated, false);
  new.is_validated := new.validated;

  -- Validation metadata: keep in sync when present
  -- (si alguna columna no existiera en tu esquema real, esto fallaría.
  --  En ese caso, me pegas el error y lo ajusto a tu snapshot real.)
  if new.last_validated_at is null and new.validated_at is not null then
    new.last_validated_at := new.validated_at;
  end if;
  new.validated_at := new.last_validated_at;

  if new.last_validated_by is null and new.validated_by is not null then
    new.last_validated_by := new.validated_by;
  end if;
  new.validated_by := new.last_validated_by;

  return new;
end;
$$;


--
-- Name: delete_routine_pack(uuid, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_routine_pack(p_pack_id uuid, p_mode text DEFAULT 'keep_all'::text, p_cutoff_week_start date DEFAULT NULL::date) RETURNS TABLE(deleted_pack boolean, deleted_routines integer, deleted_tasks integer, unlinked_tasks integer)
    LANGUAGE plpgsql
    AS $$
declare
  routine_ids uuid[];
  deleted_tasks_count integer := 0;
  unlinked_tasks_count integer := 0;
  deleted_routines_count integer := 0;
  deleted_pack_count integer := 0;
begin
  if p_pack_id is null then
    raise exception 'pack_id is required';
  end if;

  if p_mode not in ('keep_all', 'delete_from_week') then
    raise exception 'invalid mode: %', p_mode;
  end if;

  if p_mode = 'delete_from_week' then
    if p_cutoff_week_start is null then
      raise exception 'cutoff_week_start is required for delete_from_week';
    end if;
    if extract(dow from p_cutoff_week_start) <> 1 then
      raise exception 'cutoff_week_start must be a Monday (got %)', p_cutoff_week_start;
    end if;
  end if;

  select array_agg(r.id)
    into routine_ids
  from public.routines r
  where r.routine_pack_id = p_pack_id;

  if routine_ids is not null then
    if p_mode = 'delete_from_week' then
      delete from public.tasks
      where routine_id = any(routine_ids)
        and routine_week_start is not null
        and routine_week_start >= p_cutoff_week_start;
      get diagnostics deleted_tasks_count = row_count;

      update public.tasks
      set routine_id = null,
          routine_week_start = null
      where routine_id = any(routine_ids)
        and (
          routine_week_start is null
          or routine_week_start < p_cutoff_week_start
        );
      get diagnostics unlinked_tasks_count = row_count;
    else
      update public.tasks
      set routine_id = null,
          routine_week_start = null
      where routine_id = any(routine_ids);
      get diagnostics unlinked_tasks_count = row_count;
    end if;

    delete from public.routines
    where id = any(routine_ids);
    get diagnostics deleted_routines_count = row_count;
  end if;

  delete from public.routine_packs
  where id = p_pack_id;
  get diagnostics deleted_pack_count = row_count;

  return query
  select (deleted_pack_count = 1), deleted_routines_count, deleted_tasks_count, unlinked_tasks_count;
end;
$$;


--
-- Name: delete_routine_template(uuid, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_routine_template(p_routine_id uuid, p_mode text DEFAULT 'keep_all'::text, p_cutoff_week_start date DEFAULT NULL::date) RETURNS TABLE(deleted boolean, deleted_tasks integer, unlinked_tasks integer)
    LANGUAGE plpgsql
    AS $$
declare
  deleted_tasks_count integer := 0;
  unlinked_tasks_count integer := 0;
  routine_deleted_count integer := 0;
begin
  if p_routine_id is null then
    raise exception 'routine_id is required';
  end if;

  if p_mode not in ('keep_all', 'delete_from_week') then
    raise exception 'invalid mode: %', p_mode;
  end if;

  if p_mode = 'delete_from_week' then
    if p_cutoff_week_start is null then
      raise exception 'cutoff_week_start is required for delete_from_week';
    end if;
    if extract(dow from p_cutoff_week_start) <> 1 then
      raise exception 'cutoff_week_start must be a Monday (got %)', p_cutoff_week_start;
    end if;

    delete from public.tasks
    where routine_id = p_routine_id
      and routine_week_start is not null
      and routine_week_start >= p_cutoff_week_start;
    get diagnostics deleted_tasks_count = row_count;

    update public.tasks
    set routine_id = null,
        routine_week_start = null
    where routine_id = p_routine_id
      and (
        routine_week_start is null
        or routine_week_start < p_cutoff_week_start
      );
    get diagnostics unlinked_tasks_count = row_count;
  else
    update public.tasks
    set routine_id = null,
        routine_week_start = null
    where routine_id = p_routine_id;
    get diagnostics unlinked_tasks_count = row_count;
  end if;

  delete from public.routines
  where id = p_routine_id;
  get diagnostics routine_deleted_count = row_count;

  return query
  select (routine_deleted_count = 1), deleted_tasks_count, unlinked_tasks_count;
end;
$$;


--
-- Name: fn_bool_01(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_bool_01(v text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select case lower(btrim(coalesce(v, '')))
    when '1' then true
    when 'true' then true
    when 't' then true
    when 'yes' then true
    when 'y' then true
    when '0' then false
    when 'false' then false
    when 'f' then false
    when 'no' then false
    when 'n' then false
    else null
  end
$$;


--
-- Name: fn_norm_purchase_unit(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_norm_purchase_unit(v text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case lower(btrim(coalesce(v, '')))
    when 'kg' then 'kg'
    when 'gr' then 'g'
    when 'g' then 'g'
    when 'l' then 'l'
    when 'ml' then 'ml'
    when 'ud.' then 'ud'
    when 'ud' then 'ud'
    else nullif(lower(btrim(coalesce(v, ''))), '')
  end
$$;


--
-- Name: fn_split_pipe(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_split_pipe(v text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when v is null or btrim(v) = '' then '{}'::text[]
    else regexp_split_to_array(v, '\s*\|\s*')
  end
$$;


--
-- Name: fn_text_to_numeric(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_text_to_numeric(v text) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when v is null or btrim(v) = '' then null
    else replace(btrim(v), ',', '.')::numeric
  end
$$;


--
-- Name: generate_weekly_tasks(date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_weekly_tasks(p_week_start date, p_created_by_email text DEFAULT NULL::text) RETURNS TABLE(created integer, skipped integer)
    LANGUAGE plpgsql
    AS $$
declare
  total_count integer;
  created_count integer;
begin
  if p_week_start is null then
    raise exception 'week_start is required';
  end if;

  if extract(dow from p_week_start) <> 1 then
    raise exception 'week_start must be a Monday (got %)', p_week_start;
  end if;

  select count(*)
    into total_count
  from public.routines r
  left join public.routine_packs p on p.id = r.routine_pack_id
  where r.is_active = true
    and (r.routine_pack_id is null or p.enabled = true);

  with inserted as (
    insert into public.tasks (
      area,
      title,
      description,
      priority,
      status,
      window_start_date,
      due_date,
      routine_id,
      routine_week_start,
      created_by_email
    )
    select
      r.area,
      r.title,
      r.description,
      r.priority,
      'open'::public.task_status,
      (p_week_start + (r.start_day_of_week - 1)),
      (p_week_start + (r.end_day_of_week - 1)),
      r.id,
      p_week_start,
      p_created_by_email
    from public.routines r
    left join public.routine_packs p on p.id = r.routine_pack_id
    where r.is_active = true
      and (r.routine_pack_id is null or p.enabled = true)
    on conflict (routine_id, routine_week_start) do nothing
    returning 1
  )
  select count(*) into created_count from inserted;

  return query
    select created_count, (total_count - created_count);
end;
$$;


--
-- Name: generate_weekly_tasks_auto(date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_weekly_tasks_auto(p_week_start date, p_created_by_email text DEFAULT 'system'::text) RETURNS TABLE(created integer, skipped integer)
    LANGUAGE plpgsql
    AS $$
declare
  total_count integer;
  created_count integer;
begin
  if p_week_start is null then
    raise exception 'week_start is required';
  end if;

  if extract(dow from p_week_start) <> 1 then
    raise exception 'week_start must be a Monday (got %)', p_week_start;
  end if;

  select count(*)
    into total_count
  from public.routines r
  left join public.routine_packs p on p.id = r.routine_pack_id
  where r.is_active = true
    and (
      r.routine_pack_id is null
      or (p.enabled = true and p.auto_generate = true)
    );

  with inserted as (
    insert into public.tasks (
      area,
      title,
      description,
      priority,
      status,
      window_start_date,
      due_date,
      routine_id,
      routine_week_start,
      created_by_email
    )
    select
      r.area,
      r.title,
      r.description,
      r.priority,
      'open'::public.task_status,
      (p_week_start + (r.start_day_of_week - 1)),
      (p_week_start + (r.end_day_of_week - 1)),
      r.id,
      p_week_start,
      p_created_by_email
    from public.routines r
    left join public.routine_packs p on p.id = r.routine_pack_id
    where r.is_active = true
      and (
        r.routine_pack_id is null
        or (p.enabled = true and p.auto_generate = true)
      )
    on conflict (routine_id, routine_week_start) do nothing
    returning 1
  )
  select count(*) into created_count from inserted;

  return query
    select created_count, (total_count - created_count);
end;
$$;


--
-- Name: generate_weekly_tasks_for_pack(date, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_weekly_tasks_for_pack(p_week_start date, p_pack_id uuid, p_created_by_email text DEFAULT NULL::text) RETURNS TABLE(created integer, skipped integer)
    LANGUAGE plpgsql
    AS $$
declare
  total_count integer;
  created_count integer;
begin
  if p_week_start is null then
    raise exception 'week_start is required';
  end if;

  if extract(dow from p_week_start) <> 1 then
    raise exception 'week_start must be a Monday (got %)', p_week_start;
  end if;

  -- Contar rutinas elegibles según pack
  if p_pack_id is null then
    select count(*)
      into total_count
    from public.routines r
    where r.is_active = true
      and r.routine_pack_id is null;
  else
    select count(*)
      into total_count
    from public.routines r
    join public.routine_packs p on p.id = r.routine_pack_id
    where r.is_active = true
      and r.routine_pack_id = p_pack_id
      and p.enabled = true;
  end if;

  with inserted as (
    insert into public.tasks (
      area,
      title,
      description,
      priority,
      status,
      window_start_date,
      due_date,
      routine_id,
      routine_week_start,
      created_by_email
    )
    select
      r.area,
      r.title,
      r.description,
      r.priority,
      'open'::public.task_status,
      (p_week_start + (r.start_day_of_week - 1)),
      (p_week_start + (r.end_day_of_week - 1)),
      r.id,
      p_week_start,
      p_created_by_email
    from public.routines r
    left join public.routine_packs p on p.id = r.routine_pack_id
    where r.is_active = true
      and (
        (p_pack_id is null and r.routine_pack_id is null)
        or
        (p_pack_id is not null and r.routine_pack_id = p_pack_id and p.enabled = true)
      )
    on conflict (routine_id, routine_week_start) do nothing
    returning 1
  )
  select count(*) into created_count from inserted;

  return query
    select created_count, (total_count - created_count);
end;
$$;


--
-- Name: mark_past_events_completed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_past_events_completed() RETURNS void
    LANGUAGE sql
    AS $$
  update public.group_events
  set status = 'completed'
  where status = 'confirmed'
    and service_outcome = 'normal'
    and event_date < current_date;
$$;


--
-- Name: recalculate_group_staffing_plan(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_group_staffing_plan(p_group_event_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_event       public.group_events;
  v_ratio       public.staffing_ratios;

  v_waiters     integer;
  v_runners     integer;
  v_bartenders  integer;

  v_extra_bartenders integer;
begin
  -- 1) Obtener el evento
  select *
    into v_event
  from public.group_events
  where id = p_group_event_id;

  if not found then
    raise exception 'Group event % not found', p_group_event_id;
  end if;

  -- 2) Obtener el ratio activo
  select *
    into v_ratio
  from public.staffing_ratios
  where is_active = true
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'No active staffing_ratio found';
  end if;

  -- 3) Cálculo de camareros y runners
  if v_event.total_pax > 0 then
    v_waiters := ceil(v_event.total_pax::numeric / v_ratio.waiter_per_pax);
    v_runners := ceil(v_event.total_pax::numeric / v_ratio.runner_per_pax);
  else
    v_waiters := 0;
    v_runners := 0;
  end if;

  -- 4) Cálculo de bartenders según FESTA PRIVADA
  if v_event.has_private_party = false then
    v_bartenders := 0;
  else
    v_extra_bartenders := floor(
      v_event.total_pax::numeric / v_ratio.private_party_extra_bartender_per_pax
    );

    v_bartenders := v_ratio.min_bartenders + v_extra_bartenders;
  end if;

  -- 5) Upsert en group_staffing_plans
  insert into public.group_staffing_plans as gsp (
    group_event_id,
    staffing_ratio_id,
    total_pax,
    recommended_waiters,
    recommended_runners,
    recommended_bartenders
  )
  values (
    v_event.id,
    v_ratio.id,
    v_event.total_pax,
    v_waiters,
    v_runners,
    v_bartenders
  )
  on conflict (group_event_id) do update
    set staffing_ratio_id       = excluded.staffing_ratio_id,
        total_pax               = excluded.total_pax,
        recommended_waiters     = excluded.recommended_waiters,
        recommended_runners     = excluded.recommended_runners,
        recommended_bartenders  = excluded.recommended_bartenders,
        updated_at              = now();
end;
$$;


--
-- Name: set_override_capacity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_override_capacity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  room_capacity integer;
begin
  -- Obtenemos la capacidad sentada de la sala
  select r.capacity_seated
    into room_capacity
  from public.rooms r
  where r.id = new.room_id;

  -- Si tenemos capacidad definida y se supera, marcamos override_capacity
  if room_capacity is not null and new.total_pax > room_capacity then
    new.override_capacity := true;
  else
    new.override_capacity := false;
  end if;

  return new;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: tg_normalize_allowed_user_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_normalize_allowed_user_email() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.email is not null then
    new.email := lower(btrim(new.email));
  end if;
  return new;
end;
$$;


--
-- Name: tg_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: trg_recalculate_group_staffing_plan(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_recalculate_group_staffing_plan() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  -- Si el evento está cancelado, eliminamos su plan de staffing (si existe)
  if new.status = 'cancelled' then
    delete from public.group_staffing_plans
    where group_event_id = new.id;

    return new;
  end if;

  -- Para cualquier otro estado (draft, confirmed, etc.), recalculamos el plan
  perform public.recalculate_group_staffing_plan(new.id);

  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_allowed_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_allowed_users (
    email text NOT NULL,
    role text DEFAULT 'staff'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    can_reservas boolean DEFAULT true NOT NULL,
    can_mantenimiento boolean DEFAULT true NOT NULL,
    can_cocina boolean DEFAULT true NOT NULL,
    display_name text,
    can_cheffing boolean DEFAULT false NOT NULL,
    cheffing_images_manage boolean DEFAULT false NOT NULL,
    CONSTRAINT app_allowed_users_email_lower_chk CHECK ((email = lower(email))),
    CONSTRAINT app_allowed_users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'staff'::text, 'viewer'::text])))
);


--
-- Name: backup_cheffing_dish_items_phase2_20260312; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_cheffing_dish_items_phase2_20260312 (
    id uuid,
    dish_id uuid,
    ingredient_id uuid,
    subrecipe_id uuid,
    unit_code text,
    quantity numeric,
    notes text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    waste_pct_override numeric,
    source_system text,
    source_component_uid text,
    source_raw jsonb,
    source_measurement text,
    source_quantity_raw numeric,
    source_quantity_gross_raw numeric,
    source_waste_pct_raw numeric,
    source_price_unit_raw numeric,
    source_price_total_raw numeric
);


--
-- Name: backup_cheffing_subrecipe_items_phase2_20260312; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_cheffing_subrecipe_items_phase2_20260312 (
    id uuid,
    subrecipe_id uuid,
    ingredient_id uuid,
    subrecipe_component_id uuid,
    unit_code text,
    quantity numeric,
    notes text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    source_system text,
    source_component_uid text,
    source_raw jsonb,
    source_measurement text,
    source_quantity_raw numeric,
    source_quantity_gross_raw numeric,
    source_waste_pct_raw numeric,
    source_price_unit_raw numeric
);


--
-- Name: cheffing_card_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_card_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    card_id uuid NOT NULL,
    dish_id uuid NOT NULL,
    multiplier numeric DEFAULT 1 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cheffing_card_items_multiplier_positive CHECK ((multiplier > (0)::numeric))
);


--
-- Name: cheffing_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cheffing_dish_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_dish_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dish_id uuid NOT NULL,
    ingredient_id uuid,
    subrecipe_id uuid,
    unit_code text NOT NULL,
    quantity numeric NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    waste_pct_override numeric,
    source_system text,
    source_component_uid text,
    source_raw jsonb,
    source_measurement text,
    source_quantity_raw numeric,
    source_quantity_gross_raw numeric,
    source_waste_pct_raw numeric,
    source_price_unit_raw numeric,
    source_price_total_raw numeric,
    CONSTRAINT cheffing_dish_items_component_check CHECK (((ingredient_id IS NULL) <> (subrecipe_id IS NULL))),
    CONSTRAINT cheffing_dish_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT cheffing_dish_items_waste_pct_override_check CHECK (((waste_pct_override IS NULL) OR ((waste_pct_override >= (0)::numeric) AND (waste_pct_override < (1)::numeric)))),
    CONSTRAINT cheffing_dish_items_waste_pct_override_chk CHECK (((waste_pct_override IS NULL) OR ((waste_pct_override >= (0)::numeric) AND (waste_pct_override < (1)::numeric))))
);


--
-- Name: cheffing_dish_source_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_dish_source_labels (
    dish_id uuid NOT NULL,
    source_label_uid text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cheffing_dish_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_dish_tags (
    dish_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cheffing_dishes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_dishes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    selling_price numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    servings integer DEFAULT 1 NOT NULL,
    units_sold integer DEFAULT 0 NOT NULL,
    source_system text,
    source_uid text,
    source_name text,
    source_raw jsonb,
    description text,
    recipe_text text,
    tax_rate numeric,
    reference text,
    image_url text,
    is_active boolean DEFAULT true NOT NULL,
    mycheftool_kind text,
    mycheftool_type text,
    mycheftool_name_ca text,
    mycheftool_name_es text,
    mycheftool_name_en text,
    mycheftool_description_ca text,
    mycheftool_description_es text,
    mycheftool_measurement text,
    mycheftool_price_takeaway numeric,
    mycheftool_price_tapa numeric,
    mycheftool_price_half numeric,
    mycheftool_ean text,
    mycheftool_tags_raw text,
    mycheftool_source_tag_names text[] DEFAULT '{}'::text[] NOT NULL,
    mycheftool_source_label_ids text[] DEFAULT '{}'::text[] NOT NULL,
    mycheftool_foodcost_static numeric,
    mycheftool_foodcost_parts integer,
    mycheftool_tk_active boolean,
    mycheftool_pos_favourite boolean,
    mycheftool_created_at_source timestamp with time zone,
    mycheftool_updated_at_source timestamp with time zone,
    mycheftool_updated_by_name text,
    notes text,
    allergen_codes text[] DEFAULT '{}'::text[] NOT NULL,
    indicator_codes text[] DEFAULT '{}'::text[] NOT NULL,
    image_path text,
    family_id uuid,
    CONSTRAINT cheffing_dishes_selling_price_check CHECK (((selling_price IS NULL) OR (selling_price >= (0)::numeric))),
    CONSTRAINT cheffing_dishes_servings_check CHECK ((servings > 0)),
    CONSTRAINT cheffing_dishes_servings_positive CHECK ((servings > 0)),
    CONSTRAINT cheffing_dishes_units_sold_nonnegative CHECK ((units_sold >= 0))
);


--
-- Name: cheffing_families; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_families (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    kind text DEFAULT 'food'::text NOT NULL,
    CONSTRAINT cheffing_families_kind_check CHECK ((kind = ANY (ARRAY['food'::text, 'drink'::text])))
);


--
-- Name: cheffing_ingredient_cost_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_ingredient_cost_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ingredient_id uuid NOT NULL,
    purchase_document_id uuid NOT NULL,
    purchase_document_line_id uuid NOT NULL,
    supplier_id uuid,
    previous_cost numeric,
    new_cost numeric NOT NULL,
    document_effective_at timestamp without time zone NOT NULL,
    applied_by text,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cheffing_ingredient_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_ingredient_tags (
    ingredient_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cheffing_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    purchase_unit_code text NOT NULL,
    purchase_pack_qty numeric NOT NULL,
    purchase_price numeric NOT NULL,
    waste_pct numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    categories text[] DEFAULT '{}'::text[] NOT NULL,
    reference text,
    stock_unit_code text,
    stock_qty numeric DEFAULT 0 NOT NULL,
    min_stock_qty numeric,
    max_stock_qty numeric,
    allergen_codes text[] DEFAULT '{}'::text[] NOT NULL,
    indicator_codes text[] DEFAULT '{}'::text[] NOT NULL,
    source_system text,
    source_uid text,
    source_name text,
    source_raw jsonb,
    mycheftool_kind text,
    mycheftool_type text,
    mycheftool_name_ca text,
    mycheftool_measurement text,
    mycheftool_purchase_price numeric,
    mycheftool_provider text,
    mycheftool_stock numeric,
    mycheftool_stock_alert numeric,
    mycheftool_stock_max numeric,
    mycheftool_real_weight numeric,
    mycheftool_tags_raw text,
    mycheftool_source_tag_names text[] DEFAULT '{}'::text[] NOT NULL,
    mycheftool_allergens_count integer,
    mycheftool_recipe_has_content boolean,
    mycheftool_foodcost_items_count integer,
    mycheftool_updated_at_source timestamp with time zone,
    mycheftool_updated_by_name text,
    CONSTRAINT cheffing_ingredients_purchase_pack_qty_check CHECK ((purchase_pack_qty > (0)::numeric)),
    CONSTRAINT cheffing_ingredients_purchase_price_check CHECK ((purchase_price >= (0)::numeric)),
    CONSTRAINT cheffing_ingredients_stock_qty_check CHECK ((stock_qty >= (0)::numeric)),
    CONSTRAINT cheffing_ingredients_waste_lt_one CHECK (((waste_pct >= (0)::numeric) AND (waste_pct < (1)::numeric))),
    CONSTRAINT cheffing_ingredients_waste_pct_check CHECK (((waste_pct >= (0)::numeric) AND (waste_pct < (1)::numeric)))
);


--
-- Name: cheffing_menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_menu_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    menu_id uuid NOT NULL,
    dish_id uuid NOT NULL,
    multiplier numeric DEFAULT 1 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    section_kind text DEFAULT 'starter'::text NOT NULL,
    CONSTRAINT cheffing_menu_items_multiplier_positive CHECK ((multiplier > (0)::numeric)),
    CONSTRAINT cheffing_menu_items_section_kind_check CHECK ((section_kind = ANY (ARRAY['starter'::text, 'main'::text, 'drink'::text, 'dessert'::text])))
);


--
-- Name: cheffing_menus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_menus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    notes text,
    price_per_person numeric,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cheffing_pos_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_pos_order_items (
    id bigint NOT NULL,
    pos_order_id text NOT NULL,
    outlet_id text DEFAULT 'default'::text NOT NULL,
    outlet_name text,
    opened_at timestamp without time zone NOT NULL,
    closed_at timestamp without time zone,
    product_name text NOT NULL,
    sku text,
    gift_card_code text,
    quantity numeric NOT NULL,
    unit_price_gross numeric DEFAULT 0 NOT NULL,
    discount_gross numeric DEFAULT 0 NOT NULL,
    total_gross numeric DEFAULT 0 NOT NULL,
    total_net numeric,
    vat_amount numeric,
    currency text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cheffing_pos_order_items_qty_nonnegative CHECK ((quantity >= (0)::numeric)),
    CONSTRAINT cheffing_pos_order_items_totals_nonnegative CHECK ((total_gross >= (0)::numeric))
);


--
-- Name: cheffing_pos_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cheffing_pos_order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cheffing_pos_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cheffing_pos_order_items_id_seq OWNED BY public.cheffing_pos_order_items.id;


--
-- Name: cheffing_pos_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_pos_orders (
    pos_order_id text NOT NULL,
    outlet_id text DEFAULT 'default'::text NOT NULL,
    outlet_name text,
    opened_at timestamp without time zone NOT NULL,
    closed_at timestamp without time zone,
    custom_order_id text,
    order_name text,
    opened_by text,
    closed_table text,
    clients integer,
    duration_seconds integer,
    status text,
    currency text,
    total_gross numeric,
    total_net numeric,
    total_vat numeric,
    total_payments numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cheffing_pos_product_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_pos_product_links (
    pos_product_id text NOT NULL,
    dish_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cheffing_pos_sales_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_pos_sales_daily (
    sale_day date NOT NULL,
    outlet_id text DEFAULT 'default'::text NOT NULL,
    pos_product_id text NOT NULL,
    pos_product_name text,
    units numeric DEFAULT 0 NOT NULL,
    revenue numeric,
    currency text DEFAULT 'EUR'::text NOT NULL,
    source text DEFAULT 'pos'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cheffing_purchase_document_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_purchase_document_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    line_number integer DEFAULT 1 NOT NULL,
    raw_description text NOT NULL,
    raw_quantity numeric,
    raw_unit text,
    raw_unit_price numeric,
    raw_line_total numeric,
    interpreted_description text,
    interpreted_quantity numeric,
    interpreted_unit text,
    normalized_quantity numeric,
    normalized_unit_code text,
    normalized_unit_price numeric,
    normalized_line_total numeric,
    suggested_ingredient_id uuid,
    validated_ingredient_id uuid,
    line_status text DEFAULT 'unresolved'::text NOT NULL,
    warning_notes text,
    line_effective_at timestamp without time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    validated_unit text,
    user_note text,
    CONSTRAINT cheffing_purchase_document_lines_resolved_requires_validated_in CHECK (((line_status <> 'resolved'::text) OR (validated_ingredient_id IS NOT NULL))),
    CONSTRAINT cheffing_purchase_document_lines_status_check CHECK ((line_status = ANY (ARRAY['unresolved'::text, 'resolved'::text]))),
    CONSTRAINT cheffing_purchase_document_lines_validated_unit_check CHECK (((validated_unit IS NULL) OR (validated_unit = ANY (ARRAY['ud'::text, 'kg'::text, 'g'::text, 'l'::text, 'ml'::text, 'caja'::text, 'pack'::text]))))
);


--
-- Name: cheffing_purchase_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_purchase_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid,
    document_kind text NOT NULL,
    document_number text,
    document_date date NOT NULL,
    document_time time without time zone,
    effective_at timestamp without time zone,
    storage_bucket text DEFAULT 'cheffing-procurement-documents'::text NOT NULL,
    storage_path text,
    storage_delete_after timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    ocr_raw_text text,
    interpreted_payload jsonb,
    validation_notes text,
    created_by text,
    validated_by text,
    applied_by text,
    validated_at timestamp with time zone,
    applied_at timestamp with time zone,
    discarded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    declared_total numeric,
    CONSTRAINT cheffing_purchase_documents_declared_total_nonnegative CHECK (((declared_total IS NULL) OR (declared_total >= (0)::numeric))),
    CONSTRAINT cheffing_purchase_documents_kind_check CHECK ((document_kind = ANY (ARRAY['invoice'::text, 'delivery_note'::text, 'other'::text]))),
    CONSTRAINT cheffing_purchase_documents_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'applied'::text, 'discarded'::text])))
);


--
-- Name: cheffing_source_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_source_labels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_system text DEFAULT 'mycheftool'::text NOT NULL,
    source_uid text NOT NULL,
    label_name text,
    label_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cheffing_source_labels_label_type_check CHECK (((label_type = ANY (ARRAY['allergen'::text, 'indicator'::text])) OR (label_type IS NULL)))
);


--
-- Name: cheffing_subrecipe_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_subrecipe_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subrecipe_id uuid NOT NULL,
    ingredient_id uuid,
    subrecipe_component_id uuid,
    unit_code text NOT NULL,
    quantity numeric NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_system text,
    source_component_uid text,
    source_raw jsonb,
    source_measurement text,
    source_quantity_raw numeric,
    source_quantity_gross_raw numeric,
    source_waste_pct_raw numeric,
    source_price_unit_raw numeric,
    CONSTRAINT cheffing_subrecipe_items_component_check CHECK (((ingredient_id IS NULL) <> (subrecipe_component_id IS NULL))),
    CONSTRAINT cheffing_subrecipe_items_no_self_component CHECK (((subrecipe_component_id IS NULL) OR (subrecipe_component_id <> subrecipe_id))),
    CONSTRAINT cheffing_subrecipe_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT cheffing_subrecipe_no_self_ref CHECK (((subrecipe_component_id IS NULL) OR (subrecipe_component_id <> subrecipe_id)))
);


--
-- Name: cheffing_subrecipe_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_subrecipe_tags (
    subrecipe_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cheffing_subrecipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_subrecipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    output_unit_code text NOT NULL,
    output_qty numeric NOT NULL,
    waste_pct numeric DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_system text,
    source_uid text,
    source_name text,
    source_raw jsonb,
    reference text,
    categories text[] DEFAULT '{}'::text[] NOT NULL,
    allergen_codes text[] DEFAULT '{}'::text[] NOT NULL,
    indicator_codes text[] DEFAULT '{}'::text[] NOT NULL,
    mycheftool_kind text,
    mycheftool_type text,
    mycheftool_name_ca text,
    mycheftool_measurement text,
    mycheftool_price_static numeric,
    mycheftool_provider text,
    mycheftool_real_weight numeric,
    mycheftool_tags_raw text,
    mycheftool_source_tag_names text[] DEFAULT '{}'::text[] NOT NULL,
    mycheftool_allergens_count integer,
    mycheftool_recipe_has_content boolean,
    mycheftool_foodcost_items_count integer,
    mycheftool_updated_at_source timestamp with time zone,
    mycheftool_updated_by_name text,
    CONSTRAINT cheffing_subrecipes_output_qty_check CHECK ((output_qty > (0)::numeric)),
    CONSTRAINT cheffing_subrecipes_waste_lt_one CHECK (((waste_pct >= (0)::numeric) AND (waste_pct < (1)::numeric))),
    CONSTRAINT cheffing_subrecipes_waste_pct_check CHECK (((waste_pct >= (0)::numeric) AND (waste_pct < (1)::numeric)))
);


--
-- Name: cheffing_supplier_product_refs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_supplier_product_refs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    supplier_product_description text NOT NULL,
    supplier_product_alias text,
    normalized_supplier_product_name text,
    ingredient_id uuid NOT NULL,
    reference_unit_code text,
    reference_format_qty numeric,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cheffing_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trade_name text NOT NULL,
    legal_name text,
    tax_id text,
    normalized_tax_id text,
    normalized_name text,
    phone text,
    email text,
    address text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cheffing_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tag_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cheffing_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheffing_units (
    code text NOT NULL,
    name text,
    dimension text NOT NULL,
    to_base_factor numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cheffing_units_dimension_check CHECK ((dimension = ANY (ARRAY['mass'::text, 'volume'::text, 'unit'::text]))),
    CONSTRAINT cheffing_units_to_base_factor_check CHECK ((to_base_factor > (0)::numeric))
);


--
-- Name: day_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.day_status (
    event_date date NOT NULL,
    validated_by text,
    validated_at timestamp with time zone DEFAULT now() NOT NULL,
    day_notes text,
    is_validated boolean DEFAULT false NOT NULL,
    events_last_reviewed_at timestamp with time zone,
    cocina_notes text,
    mantenimiento_notes text,
    last_validated_at timestamp with time zone DEFAULT now(),
    last_validated_by text,
    notes_general text,
    notes_kitchen text,
    notes_maintenance text,
    validated boolean DEFAULT false NOT NULL,
    last_edited_at timestamp with time zone DEFAULT now()
);


--
-- Name: group_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    event_date date NOT NULL,
    entry_time time without time zone NOT NULL,
    has_private_dining_room boolean DEFAULT false NOT NULL,
    has_private_party boolean DEFAULT false NOT NULL,
    adults integer DEFAULT 0 NOT NULL,
    children integer DEFAULT 0 NOT NULL,
    total_pax integer GENERATED ALWAYS AS ((adults + children)) STORED,
    seconds_confirmed boolean DEFAULT false NOT NULL,
    second_course_type text,
    menu_text text,
    allergens_and_diets text,
    extras text,
    setup_notes text,
    deposit_amount numeric(10,2),
    deposit_status text,
    invoice_data text,
    status text DEFAULT 'confirmed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    calendar_event_id text,
    calendar_deleted_externally boolean DEFAULT false NOT NULL,
    service_outcome public.group_service_outcome DEFAULT 'normal'::public.group_service_outcome NOT NULL,
    service_outcome_notes text,
    menu_id uuid,
    CONSTRAINT group_events_adults_check CHECK ((adults >= 0)),
    CONSTRAINT group_events_children_check CHECK ((children >= 0)),
    CONSTRAINT group_events_deposit_amount_check CHECK ((deposit_amount >= (0)::numeric)),
    CONSTRAINT group_events_deposit_status_check CHECK ((deposit_status = ANY (ARRAY['pending'::text, 'paid'::text, 'refunded'::text, 'not_required'::text]))),
    CONSTRAINT group_events_status_chk CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])))
);


--
-- Name: group_room_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_room_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_event_id uuid NOT NULL,
    room_id uuid NOT NULL,
    adults integer DEFAULT 0 NOT NULL,
    children integer DEFAULT 0 NOT NULL,
    total_pax integer GENERATED ALWAYS AS ((adults + children)) STORED,
    override_capacity boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_room_allocations_adults_check CHECK ((adults >= 0)),
    CONSTRAINT group_room_allocations_children_check CHECK ((children >= 0))
);


--
-- Name: group_staffing_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_staffing_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_event_id uuid NOT NULL,
    staffing_ratio_id uuid NOT NULL,
    total_pax integer NOT NULL,
    recommended_waiters integer DEFAULT 0 NOT NULL,
    recommended_runners integer DEFAULT 0 NOT NULL,
    recommended_bartenders integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_staffing_plans_recommended_bartenders_check CHECK ((recommended_bartenders >= 0)),
    CONSTRAINT group_staffing_plans_recommended_runners_check CHECK ((recommended_runners >= 0)),
    CONSTRAINT group_staffing_plans_recommended_waiters_check CHECK ((recommended_waiters >= 0)),
    CONSTRAINT group_staffing_plans_total_pax_check CHECK ((total_pax >= 0))
);


--
-- Name: menu_second_courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_second_courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    menu_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description_kitchen text NOT NULL,
    needs_doneness_points boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: menus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    display_name text NOT NULL,
    price_eur numeric(10,2) NOT NULL,
    starters_text text,
    dessert_text text,
    drinks_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    capacity_seated integer DEFAULT 0 NOT NULL,
    capacity_standing integer DEFAULT 0,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rooms_capacity_seated_check CHECK ((capacity_seated >= 0)),
    CONSTRAINT rooms_capacity_standing_check CHECK ((capacity_standing >= 0))
);


--
-- Name: routine_packs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.routine_packs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    area public.task_area,
    enabled boolean DEFAULT false NOT NULL,
    auto_generate boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: routines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.routines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    area public.task_area NOT NULL,
    title text NOT NULL,
    description text,
    day_of_week integer NOT NULL,
    priority public.task_priority DEFAULT 'normal'::public.task_priority NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    start_day_of_week integer DEFAULT 1 NOT NULL,
    end_day_of_week integer DEFAULT 7 NOT NULL,
    routine_pack_id uuid,
    CONSTRAINT routines_day_of_week_check CHECK (((day_of_week >= 1) AND (day_of_week <= 7))),
    CONSTRAINT routines_window_chk CHECK ((((start_day_of_week >= 1) AND (start_day_of_week <= 7)) AND ((end_day_of_week >= 1) AND (end_day_of_week <= 7)) AND (start_day_of_week <= end_day_of_week)))
);


--
-- Name: staffing_ratios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staffing_ratios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    waiter_per_pax integer NOT NULL,
    runner_per_pax integer NOT NULL,
    min_bartenders integer DEFAULT 1 NOT NULL,
    private_party_extra_bartender_per_pax integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    valid_from date,
    valid_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staffing_ratios_min_bartenders_check CHECK ((min_bartenders >= 0)),
    CONSTRAINT staffing_ratios_private_party_extra_bartender_per_pax_check CHECK ((private_party_extra_bartender_per_pax > 0)),
    CONSTRAINT staffing_ratios_runner_per_pax_check CHECK ((runner_per_pax > 0)),
    CONSTRAINT staffing_ratios_waiter_per_pax_check CHECK ((waiter_per_pax > 0))
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    area public.task_area NOT NULL,
    title text NOT NULL,
    description text,
    status public.task_status DEFAULT 'open'::public.task_status NOT NULL,
    priority public.task_priority DEFAULT 'normal'::public.task_priority NOT NULL,
    due_date date,
    created_by_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    routine_id uuid,
    routine_week_start date,
    window_start_date date,
    CONSTRAINT tasks_routine_trace_chk CHECK ((((routine_id IS NULL) AND (routine_week_start IS NULL)) OR ((routine_id IS NOT NULL) AND (routine_week_start IS NOT NULL) AND (EXTRACT(dow FROM routine_week_start) = (1)::numeric)))),
    CONSTRAINT tasks_status_allowed CHECK (((status)::text = ANY (ARRAY['open'::text, 'done'::text]))),
    CONSTRAINT tasks_status_only_open_done CHECK (((status)::text = ANY (ARRAY['open'::text, 'done'::text]))),
    CONSTRAINT tasks_status_open_done CHECK ((status = ANY (ARRAY['open'::public.task_status, 'done'::public.task_status]))),
    CONSTRAINT tasks_status_open_done_check CHECK ((status = ANY (ARRAY['open'::public.task_status, 'done'::public.task_status]))),
    CONSTRAINT tasks_status_open_done_only CHECK ((status = ANY (ARRAY['open'::public.task_status, 'done'::public.task_status]))),
    CONSTRAINT tasks_window_dates_chk CHECK (((window_start_date IS NULL) OR (due_date IS NULL) OR (window_start_date <= due_date)))
);


--
-- Name: v_cheffing_ingredients_cost; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_cheffing_ingredients_cost WITH (security_invoker='true') AS
 SELECT i.id,
    i.name,
    i.purchase_unit_code,
    i.purchase_pack_qty,
    i.purchase_price,
    i.waste_pct,
    i.created_at,
    i.updated_at,
    u.dimension AS purchase_unit_dimension,
    u.to_base_factor AS purchase_unit_factor,
    (i.purchase_price / NULLIF((i.purchase_pack_qty * u.to_base_factor), (0)::numeric)) AS cost_gross_per_base,
    ((i.purchase_price / NULLIF((i.purchase_pack_qty * u.to_base_factor), (0)::numeric)) / NULLIF(((1)::numeric - i.waste_pct), (0)::numeric)) AS cost_net_per_base,
    ((1)::numeric / NULLIF(((1)::numeric - i.waste_pct), (0)::numeric)) AS waste_factor
   FROM (public.cheffing_ingredients i
     JOIN public.cheffing_units u ON ((u.code = i.purchase_unit_code)));


--
-- Name: v_cheffing_subrecipe_cost; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_cheffing_subrecipe_cost AS
 WITH RECURSIVE expanded_items AS (
         SELECT si.subrecipe_id AS root_subrecipe_id,
            si.ingredient_id,
            si.subrecipe_component_id,
            si.quantity,
            si.unit_code,
            (1)::numeric AS scale_factor,
            ARRAY[si.subrecipe_id] AS path,
            1 AS depth
           FROM public.cheffing_subrecipe_items si
        UNION ALL
         SELECT ei.root_subrecipe_id,
            si_child.ingredient_id,
            si_child.subrecipe_component_id,
            si_child.quantity,
            si_child.unit_code,
            (((ei.scale_factor * (ei.quantity * u_parent.to_base_factor)) / NULLIF((sr_child.output_qty * u_child_out.to_base_factor), (0)::numeric)) / NULLIF(((1)::numeric - COALESCE(sr_child.waste_pct, (0)::numeric)), (0)::numeric)) AS scale_factor,
            (ei.path || sr_child.id) AS path,
            (ei.depth + 1) AS depth
           FROM ((((expanded_items ei
             JOIN public.cheffing_subrecipes sr_child ON ((sr_child.id = ei.subrecipe_component_id)))
             JOIN public.cheffing_subrecipe_items si_child ON ((si_child.subrecipe_id = sr_child.id)))
             JOIN public.cheffing_units u_parent ON ((u_parent.code = ei.unit_code)))
             JOIN public.cheffing_units u_child_out ON ((u_child_out.code = sr_child.output_unit_code)))
          WHERE ((ei.subrecipe_component_id IS NOT NULL) AND (u_parent.dimension = u_child_out.dimension) AND (ei.depth < 25) AND (NOT (sr_child.id = ANY (ei.path))))
        ), item_costs AS (
         SELECT ei.root_subrecipe_id AS subrecipe_id,
            sum(
                CASE
                    WHEN ((ei.ingredient_id IS NOT NULL) AND (u_item.dimension = vic.purchase_unit_dimension)) THEN ((vic.cost_net_per_base * (ei.quantity * u_item.to_base_factor)) * ei.scale_factor)
                    ELSE NULL::numeric
                END) AS items_cost_total
           FROM ((expanded_items ei
             LEFT JOIN public.v_cheffing_ingredients_cost vic ON ((vic.id = ei.ingredient_id)))
             LEFT JOIN public.cheffing_units u_item ON ((u_item.code = ei.unit_code)))
          GROUP BY ei.root_subrecipe_id
        )
 SELECT s.id,
    s.name,
    s.output_unit_code,
    s.output_qty,
    s.waste_pct,
    s.created_at,
    s.updated_at,
    u.dimension AS output_unit_dimension,
    u.to_base_factor AS output_unit_factor,
    ic.items_cost_total,
    (ic.items_cost_total / NULLIF((s.output_qty * u.to_base_factor), (0)::numeric)) AS cost_gross_per_base,
    ((ic.items_cost_total / NULLIF((s.output_qty * u.to_base_factor), (0)::numeric)) / NULLIF(((1)::numeric - s.waste_pct), (0)::numeric)) AS cost_net_per_base,
    ((1)::numeric / NULLIF(((1)::numeric - s.waste_pct), (0)::numeric)) AS waste_factor,
    s.notes
   FROM ((public.cheffing_subrecipes s
     JOIN public.cheffing_units u ON ((u.code = s.output_unit_code)))
     LEFT JOIN item_costs ic ON ((ic.subrecipe_id = s.id)));


--
-- Name: v_cheffing_dish_items_cost; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_cheffing_dish_items_cost AS
 SELECT di.id,
    di.dish_id,
    di.ingredient_id,
    di.subrecipe_id,
    di.unit_code,
    di.quantity,
    di.notes,
    di.created_at,
    di.updated_at,
    di.waste_pct_override,
    di.source_system,
    di.source_component_uid,
    di.source_raw,
    di.source_measurement,
    di.source_quantity_raw,
    di.source_quantity_gross_raw,
    di.source_waste_pct_raw,
    di.source_price_unit_raw,
    di.source_price_total_raw,
        CASE
            WHEN (di.ingredient_id IS NOT NULL) THEN COALESCE(di.waste_pct_override, vic.waste_pct, (0)::numeric)
            WHEN (di.subrecipe_id IS NOT NULL) THEN COALESCE(di.waste_pct_override, (0)::numeric)
            ELSE (0)::numeric
        END AS waste_pct,
        CASE
            WHEN ((di.ingredient_id IS NOT NULL) AND (u_item.dimension = vic.purchase_unit_dimension)) THEN ((vic.cost_net_per_base * (di.quantity * u_item.to_base_factor)) / NULLIF(((1)::numeric - COALESCE(di.waste_pct_override, vic.waste_pct, (0)::numeric)), (0)::numeric))
            WHEN ((di.subrecipe_id IS NOT NULL) AND (u_item.dimension = vsc.output_unit_dimension)) THEN ((vsc.cost_net_per_base * (di.quantity * u_item.to_base_factor)) / NULLIF(((1)::numeric - COALESCE(di.waste_pct_override, (0)::numeric)), (0)::numeric))
            ELSE NULL::numeric
        END AS line_cost_total
   FROM (((public.cheffing_dish_items di
     LEFT JOIN public.cheffing_units u_item ON ((u_item.code = di.unit_code)))
     LEFT JOIN public.v_cheffing_ingredients_cost vic ON ((vic.id = di.ingredient_id)))
     LEFT JOIN public.v_cheffing_subrecipe_cost vsc ON ((vsc.id = di.subrecipe_id)));


--
-- Name: v_cheffing_dish_cost; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_cheffing_dish_cost WITH (security_invoker='true') AS
 WITH item_costs AS (
         SELECT d_1.id AS dish_id,
                CASE
                    WHEN (count(dic.id) = 0) THEN (0)::numeric
                    WHEN (count(dic.line_cost_total) = 0) THEN NULL::numeric
                    ELSE sum(dic.line_cost_total)
                END AS items_cost_total
           FROM (public.cheffing_dishes d_1
             LEFT JOIN public.v_cheffing_dish_items_cost dic ON ((dic.dish_id = d_1.id)))
          GROUP BY d_1.id
        )
 SELECT d.id,
    d.name,
    d.selling_price,
    d.servings,
    NULL::text AS notes,
    d.created_at,
    d.updated_at,
    ic.items_cost_total,
    (ic.items_cost_total / (NULLIF(COALESCE(d.servings, 1), 0))::numeric) AS cost_per_serving
   FROM (public.cheffing_dishes d
     LEFT JOIN item_costs ic ON ((ic.dish_id = d.id)));


--
-- Name: v_cheffing_menu_engineering_dish_cost; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_cheffing_menu_engineering_dish_cost AS
 WITH item_costs AS (
         SELECT d_1.id AS dish_id,
                CASE
                    WHEN (count(dic.id) = 0) THEN (0)::numeric
                    WHEN (count(dic.line_cost_total) = 0) THEN NULL::numeric
                    ELSE sum(dic.line_cost_total)
                END AS items_cost_total
           FROM (public.cheffing_dishes d_1
             LEFT JOIN public.v_cheffing_dish_items_cost dic ON ((dic.dish_id = d_1.id)))
          GROUP BY d_1.id
        ), sold_units AS (
         SELECT l.dish_id,
            (sum(COALESCE(s.units, (0)::numeric)))::integer AS units_sold
           FROM (public.cheffing_pos_product_links l
             LEFT JOIN public.cheffing_pos_sales_daily s ON ((s.pos_product_id = l.pos_product_id)))
          GROUP BY l.dish_id
        )
 SELECT d.id,
    d.name,
    d.selling_price,
    (ic.items_cost_total / (NULLIF(COALESCE(d.servings, 1), 0))::numeric) AS cost_per_serving,
    d.created_at,
    d.updated_at,
    COALESCE(su.units_sold, d.units_sold, 0) AS units_sold
   FROM ((public.cheffing_dishes d
     LEFT JOIN item_costs ic ON ((ic.dish_id = d.id)))
     LEFT JOIN sold_units su ON ((su.dish_id = d.id)));


--
-- Name: v_daily_room_occupancy; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_daily_room_occupancy AS
 SELECT ge.event_date,
    r.id AS room_id,
    r.name AS room_name,
    r.sort_order AS room_sort_order,
    sum(gra.total_pax) AS total_pax
   FROM ((public.group_room_allocations gra
     JOIN public.group_events ge ON ((ge.id = gra.group_event_id)))
     JOIN public.rooms r ON ((r.id = gra.room_id)))
  WHERE (ge.status = 'confirmed'::text)
  GROUP BY ge.event_date, r.id, r.name, r.sort_order;


--
-- Name: v_daily_staffing_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_daily_staffing_summary AS
 SELECT ge.event_date,
    count(DISTINCT ge.id) AS groups_count,
    sum(ge.total_pax) AS total_pax,
    sum(gsp.recommended_waiters) AS total_waiters,
    sum(gsp.recommended_runners) AS total_runners,
    sum(gsp.recommended_bartenders) AS total_bartenders
   FROM (public.group_events ge
     JOIN public.group_staffing_plans gsp ON ((gsp.group_event_id = ge.id)))
  WHERE (ge.status = 'confirmed'::text)
  GROUP BY ge.event_date;


--
-- Name: v_day_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_day_status AS
 WITH changes AS (
         SELECT ge.event_date,
            GREATEST(max(ge.updated_at), max(gra.updated_at)) AS last_change_at
           FROM (public.group_events ge
             LEFT JOIN public.group_room_allocations gra ON ((gra.group_event_id = ge.id)))
          WHERE (ge.status = ANY (ARRAY['confirmed'::text, 'completed'::text]))
          GROUP BY ge.event_date
        )
 SELECT c.event_date,
    c.last_change_at,
    COALESCE(m.validated, m.is_validated, false) AS is_validated,
    COALESCE(m.last_validated_by, m.validated_by) AS validated_by,
    COALESCE(m.last_validated_at, m.validated_at) AS validated_at,
    m.events_last_reviewed_at,
    COALESCE(m.notes_general, m.day_notes) AS day_notes,
    m.notes_general,
    m.notes_kitchen,
    m.notes_maintenance,
        CASE
            WHEN (c.last_change_at IS NULL) THEN false
            WHEN (m.events_last_reviewed_at IS NULL) THEN true
            ELSE (c.last_change_at > m.events_last_reviewed_at)
        END AS needs_revalidation
   FROM (changes c
     LEFT JOIN public.day_status m ON ((m.event_date = c.event_date)));


--
-- Name: v_group_events_calendar_sync; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_group_events_calendar_sync AS
 SELECT id AS group_event_id,
    event_date,
    entry_time,
    name AS group_name,
    total_pax,
    status,
    calendar_event_id,
        CASE
            WHEN calendar_deleted_externally THEN 'noop'::text
            WHEN ((status = 'cancelled'::text) AND (calendar_event_id IS NOT NULL)) THEN 'delete'::text
            WHEN ((status = ANY (ARRAY['confirmed'::text, 'completed'::text])) AND (calendar_event_id IS NULL)) THEN 'create'::text
            WHEN ((status = ANY (ARRAY['confirmed'::text, 'completed'::text])) AND (calendar_event_id IS NOT NULL)) THEN 'update'::text
            ELSE 'noop'::text
        END AS desired_calendar_action,
        CASE
            WHEN calendar_deleted_externally THEN false
            WHEN ((status = 'cancelled'::text) AND (calendar_event_id IS NOT NULL)) THEN true
            WHEN ((status = ANY (ARRAY['confirmed'::text, 'completed'::text])) AND (calendar_event_id IS NULL)) THEN true
            WHEN ((status = ANY (ARRAY['confirmed'::text, 'completed'::text])) AND (calendar_event_id IS NOT NULL)) THEN true
            ELSE false
        END AS needs_calendar_sync,
    calendar_deleted_externally
   FROM public.group_events ge;


--
-- Name: v_group_events_daily_detail; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_group_events_daily_detail AS
 SELECT ge.event_date,
    ge.entry_time,
    ge.id AS group_event_id,
    ge.name AS group_name,
    ge.status,
    ge.total_pax,
    ge.has_private_dining_room,
    ge.has_private_party,
    r.id AS room_id,
    r.name AS room_name,
    gra.total_pax AS room_total_pax,
    gra.override_capacity AS room_override_capacity,
    gsp.recommended_waiters,
    gsp.recommended_runners,
    gsp.recommended_bartenders,
    ge.adults,
    ge.children,
    ge.second_course_type,
    ge.menu_text,
    ge.allergens_and_diets,
    ge.extras,
    ge.setup_notes,
    ge.invoice_data,
    ge.service_outcome,
    ge.service_outcome_notes
   FROM (((public.group_events ge
     LEFT JOIN public.group_room_allocations gra ON ((gra.group_event_id = ge.id)))
     LEFT JOIN public.rooms r ON ((r.id = gra.room_id)))
     LEFT JOIN public.group_staffing_plans gsp ON ((gsp.group_event_id = ge.id)))
  WHERE (ge.status <> 'cancelled'::text);


--
-- Name: v_maintenance_daily_detail; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_maintenance_daily_detail AS
 SELECT d.event_date,
    d.entry_time,
    d.group_event_id,
    d.group_name,
    d.status,
    d.total_pax,
    d.has_private_dining_room,
    d.has_private_party,
    d.room_id,
    d.room_name,
    d.room_total_pax,
    d.room_override_capacity,
    d.recommended_waiters,
    d.recommended_runners,
    d.recommended_bartenders,
    COALESCE(m.notes_maintenance, m.notes_general, m.day_notes) AS day_notes
   FROM (public.v_group_events_daily_detail d
     JOIN public.day_status m ON ((m.event_date = d.event_date)))
  WHERE ((COALESCE(m.validated, m.is_validated, false) = true) AND (d.status = ANY (ARRAY['confirmed'::text, 'completed'::text])));


--
-- Name: cheffing_pos_order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_pos_order_items ALTER COLUMN id SET DEFAULT nextval('public.cheffing_pos_order_items_id_seq'::regclass);


--
-- Name: app_allowed_users app_allowed_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_allowed_users
    ADD CONSTRAINT app_allowed_users_pkey PRIMARY KEY (email);


--
-- Name: cheffing_card_items cheffing_card_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_card_items
    ADD CONSTRAINT cheffing_card_items_pkey PRIMARY KEY (id);


--
-- Name: cheffing_cards cheffing_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_cards
    ADD CONSTRAINT cheffing_cards_pkey PRIMARY KEY (id);


--
-- Name: cheffing_dish_items cheffing_dish_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_dish_items
    ADD CONSTRAINT cheffing_dish_items_pkey PRIMARY KEY (id);


--
-- Name: cheffing_dish_source_labels cheffing_dish_source_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_dish_source_labels
    ADD CONSTRAINT cheffing_dish_source_labels_pkey PRIMARY KEY (dish_id, source_label_uid);


--
-- Name: cheffing_dish_tags cheffing_dish_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_dish_tags
    ADD CONSTRAINT cheffing_dish_tags_pkey PRIMARY KEY (dish_id, tag_id);


--
-- Name: cheffing_dishes cheffing_dishes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_dishes
    ADD CONSTRAINT cheffing_dishes_pkey PRIMARY KEY (id);


--
-- Name: cheffing_families cheffing_families_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_families
    ADD CONSTRAINT cheffing_families_pkey PRIMARY KEY (id);


--
-- Name: cheffing_families cheffing_families_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_families
    ADD CONSTRAINT cheffing_families_slug_unique UNIQUE (slug);


--
-- Name: cheffing_ingredient_cost_audit cheffing_ingredient_cost_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_ingredient_cost_audit
    ADD CONSTRAINT cheffing_ingredient_cost_audit_pkey PRIMARY KEY (id);


--
-- Name: cheffing_ingredient_tags cheffing_ingredient_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_ingredient_tags
    ADD CONSTRAINT cheffing_ingredient_tags_pkey PRIMARY KEY (ingredient_id, tag_id);


--
-- Name: cheffing_ingredients cheffing_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_ingredients
    ADD CONSTRAINT cheffing_ingredients_pkey PRIMARY KEY (id);


--
-- Name: cheffing_menu_items cheffing_menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_menu_items
    ADD CONSTRAINT cheffing_menu_items_pkey PRIMARY KEY (id);


--
-- Name: cheffing_menus cheffing_menus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_menus
    ADD CONSTRAINT cheffing_menus_pkey PRIMARY KEY (id);


--
-- Name: cheffing_pos_order_items cheffing_pos_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_pos_order_items
    ADD CONSTRAINT cheffing_pos_order_items_pkey PRIMARY KEY (id);


--
-- Name: cheffing_pos_orders cheffing_pos_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_pos_orders
    ADD CONSTRAINT cheffing_pos_orders_pkey PRIMARY KEY (pos_order_id);


--
-- Name: cheffing_pos_product_links cheffing_pos_product_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_pos_product_links
    ADD CONSTRAINT cheffing_pos_product_links_pkey PRIMARY KEY (pos_product_id);


--
-- Name: cheffing_pos_sales_daily cheffing_pos_sales_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_pos_sales_daily
    ADD CONSTRAINT cheffing_pos_sales_daily_pkey PRIMARY KEY (sale_day, outlet_id, pos_product_id);


--
-- Name: cheffing_purchase_document_lines cheffing_purchase_document_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_purchase_document_lines
    ADD CONSTRAINT cheffing_purchase_document_lines_pkey PRIMARY KEY (id);


--
-- Name: cheffing_purchase_documents cheffing_purchase_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_purchase_documents
    ADD CONSTRAINT cheffing_purchase_documents_pkey PRIMARY KEY (id);


--
-- Name: cheffing_source_labels cheffing_source_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_source_labels
    ADD CONSTRAINT cheffing_source_labels_pkey PRIMARY KEY (id);


--
-- Name: cheffing_source_labels cheffing_source_labels_source_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_source_labels
    ADD CONSTRAINT cheffing_source_labels_source_uid_key UNIQUE (source_uid);


--
-- Name: cheffing_subrecipe_items cheffing_subrecipe_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_subrecipe_items
    ADD CONSTRAINT cheffing_subrecipe_items_pkey PRIMARY KEY (id);


--
-- Name: cheffing_subrecipe_tags cheffing_subrecipe_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_subrecipe_tags
    ADD CONSTRAINT cheffing_subrecipe_tags_pkey PRIMARY KEY (subrecipe_id, tag_id);


--
-- Name: cheffing_subrecipes cheffing_subrecipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_subrecipes
    ADD CONSTRAINT cheffing_subrecipes_pkey PRIMARY KEY (id);


--
-- Name: cheffing_supplier_product_refs cheffing_supplier_product_refs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_supplier_product_refs
    ADD CONSTRAINT cheffing_supplier_product_refs_pkey PRIMARY KEY (id);


--
-- Name: cheffing_suppliers cheffing_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_suppliers
    ADD CONSTRAINT cheffing_suppliers_pkey PRIMARY KEY (id);


--
-- Name: cheffing_tags cheffing_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_tags
    ADD CONSTRAINT cheffing_tags_pkey PRIMARY KEY (id);


--
-- Name: cheffing_tags cheffing_tags_tag_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_tags
    ADD CONSTRAINT cheffing_tags_tag_name_key UNIQUE (tag_name);


--
-- Name: cheffing_units cheffing_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_units
    ADD CONSTRAINT cheffing_units_pkey PRIMARY KEY (code);


--
-- Name: group_events group_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_events
    ADD CONSTRAINT group_events_pkey PRIMARY KEY (id);


--
-- Name: group_room_allocations group_room_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_room_allocations
    ADD CONSTRAINT group_room_allocations_pkey PRIMARY KEY (id);


--
-- Name: group_room_allocations group_room_allocations_unique_group_room; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_room_allocations
    ADD CONSTRAINT group_room_allocations_unique_group_room UNIQUE (group_event_id, room_id);


--
-- Name: group_staffing_plans group_staffing_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_staffing_plans
    ADD CONSTRAINT group_staffing_plans_pkey PRIMARY KEY (id);


--
-- Name: group_staffing_plans group_staffing_plans_unique_group; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_staffing_plans
    ADD CONSTRAINT group_staffing_plans_unique_group UNIQUE (group_event_id);


--
-- Name: day_status maintenance_validated_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_status
    ADD CONSTRAINT maintenance_validated_days_pkey PRIMARY KEY (event_date);


--
-- Name: menu_second_courses menu_second_courses_menu_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_second_courses
    ADD CONSTRAINT menu_second_courses_menu_id_code_key UNIQUE (menu_id, code);


--
-- Name: menu_second_courses menu_second_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_second_courses
    ADD CONSTRAINT menu_second_courses_pkey PRIMARY KEY (id);


--
-- Name: menus menus_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menus
    ADD CONSTRAINT menus_code_key UNIQUE (code);


--
-- Name: menus menus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menus
    ADD CONSTRAINT menus_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_name_key UNIQUE (name);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: routine_packs routine_packs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routine_packs
    ADD CONSTRAINT routine_packs_pkey PRIMARY KEY (id);


--
-- Name: routines routines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routines
    ADD CONSTRAINT routines_pkey PRIMARY KEY (id);


--
-- Name: staffing_ratios staffing_ratios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffing_ratios
    ADD CONSTRAINT staffing_ratios_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_routine_week_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_routine_week_unique UNIQUE (routine_id, routine_week_start);


--
-- Name: app_allowed_users_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX app_allowed_users_email_unique ON public.app_allowed_users USING btree (lower(btrim(email)));


--
-- Name: cheffing_card_items_card_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_card_items_card_sort_idx ON public.cheffing_card_items USING btree (card_id, sort_order);


--
-- Name: cheffing_card_items_dish_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_card_items_dish_id_idx ON public.cheffing_card_items USING btree (dish_id);


--
-- Name: cheffing_dish_items_dish_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_dish_items_dish_id_idx ON public.cheffing_dish_items USING btree (dish_id);


--
-- Name: cheffing_dish_items_ingredient_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_dish_items_ingredient_id_idx ON public.cheffing_dish_items USING btree (ingredient_id);


--
-- Name: cheffing_dish_items_subrecipe_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_dish_items_subrecipe_id_idx ON public.cheffing_dish_items USING btree (subrecipe_id);


--
-- Name: cheffing_dishes_name_ci_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cheffing_dishes_name_ci_unique ON public.cheffing_dishes USING btree (lower(name));


--
-- Name: cheffing_families_active_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_families_active_sort_idx ON public.cheffing_families USING btree (is_active, sort_order, name);


--
-- Name: cheffing_families_kind_active_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_families_kind_active_sort_idx ON public.cheffing_families USING btree (kind, is_active, sort_order, name);


--
-- Name: cheffing_families_name_ci_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cheffing_families_name_ci_unique ON public.cheffing_families USING btree (lower(name));


--
-- Name: cheffing_ingredient_cost_audit_ingredient_effective_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_ingredient_cost_audit_ingredient_effective_idx ON public.cheffing_ingredient_cost_audit USING btree (ingredient_id, document_effective_at DESC, id DESC);


--
-- Name: cheffing_ingredients_allergen_codes_gin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_ingredients_allergen_codes_gin_idx ON public.cheffing_ingredients USING gin (allergen_codes);


--
-- Name: cheffing_ingredients_categories_gin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_ingredients_categories_gin_idx ON public.cheffing_ingredients USING gin (categories);


--
-- Name: cheffing_ingredients_indicator_codes_gin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_ingredients_indicator_codes_gin_idx ON public.cheffing_ingredients USING gin (indicator_codes);


--
-- Name: cheffing_ingredients_name_ci_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cheffing_ingredients_name_ci_unique ON public.cheffing_ingredients USING btree (lower(name));


--
-- Name: cheffing_ingredients_purchase_unit_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_ingredients_purchase_unit_code_idx ON public.cheffing_ingredients USING btree (purchase_unit_code);


--
-- Name: cheffing_menu_items_dish_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_menu_items_dish_id_idx ON public.cheffing_menu_items USING btree (dish_id);


--
-- Name: cheffing_menu_items_menu_section_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_menu_items_menu_section_sort_idx ON public.cheffing_menu_items USING btree (menu_id, section_kind, sort_order);


--
-- Name: cheffing_menu_items_menu_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_menu_items_menu_sort_idx ON public.cheffing_menu_items USING btree (menu_id, sort_order);


--
-- Name: cheffing_pos_order_items_dedupe_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cheffing_pos_order_items_dedupe_idx ON public.cheffing_pos_order_items USING btree (pos_order_id, product_name, unit_price_gross, discount_gross);


--
-- Name: cheffing_pos_order_items_opened_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_pos_order_items_opened_at_idx ON public.cheffing_pos_order_items USING btree (opened_at);


--
-- Name: cheffing_pos_order_items_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_pos_order_items_order_idx ON public.cheffing_pos_order_items USING btree (pos_order_id);


--
-- Name: cheffing_pos_orders_opened_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_pos_orders_opened_at_idx ON public.cheffing_pos_orders USING btree (opened_at);


--
-- Name: cheffing_pos_orders_outlet_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_pos_orders_outlet_idx ON public.cheffing_pos_orders USING btree (outlet_id);


--
-- Name: cheffing_pos_product_links_dish_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_pos_product_links_dish_id_idx ON public.cheffing_pos_product_links USING btree (dish_id);


--
-- Name: cheffing_pos_sales_daily_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cheffing_pos_sales_daily_unique_idx ON public.cheffing_pos_sales_daily USING btree (sale_day, outlet_id, pos_product_id);


--
-- Name: cheffing_purchase_document_lines_document_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_purchase_document_lines_document_idx ON public.cheffing_purchase_document_lines USING btree (document_id, line_number);


--
-- Name: cheffing_purchase_document_lines_validated_ingredient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_purchase_document_lines_validated_ingredient_idx ON public.cheffing_purchase_document_lines USING btree (validated_ingredient_id) WHERE (validated_ingredient_id IS NOT NULL);


--
-- Name: cheffing_purchase_documents_document_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_purchase_documents_document_date_idx ON public.cheffing_purchase_documents USING btree (document_date DESC, id DESC);


--
-- Name: cheffing_purchase_documents_effective_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_purchase_documents_effective_at_idx ON public.cheffing_purchase_documents USING btree (effective_at DESC, id DESC);


--
-- Name: cheffing_purchase_documents_supplier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_purchase_documents_supplier_idx ON public.cheffing_purchase_documents USING btree (supplier_id);


--
-- Name: cheffing_subrecipe_items_ingredient_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_subrecipe_items_ingredient_id_idx ON public.cheffing_subrecipe_items USING btree (ingredient_id);


--
-- Name: cheffing_subrecipe_items_subrecipe_component_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_subrecipe_items_subrecipe_component_id_idx ON public.cheffing_subrecipe_items USING btree (subrecipe_component_id);


--
-- Name: cheffing_subrecipe_items_subrecipe_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_subrecipe_items_subrecipe_id_idx ON public.cheffing_subrecipe_items USING btree (subrecipe_id);


--
-- Name: cheffing_subrecipes_name_ci_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cheffing_subrecipes_name_ci_unique ON public.cheffing_subrecipes USING btree (lower(name));


--
-- Name: cheffing_subrecipes_output_unit_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_subrecipes_output_unit_code_idx ON public.cheffing_subrecipes USING btree (output_unit_code);


--
-- Name: cheffing_supplier_product_refs_ingredient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_supplier_product_refs_ingredient_idx ON public.cheffing_supplier_product_refs USING btree (ingredient_id);


--
-- Name: cheffing_supplier_product_refs_supplier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_supplier_product_refs_supplier_idx ON public.cheffing_supplier_product_refs USING btree (supplier_id);


--
-- Name: cheffing_supplier_product_refs_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cheffing_supplier_product_refs_unique_idx ON public.cheffing_supplier_product_refs USING btree (supplier_id, ingredient_id, normalized_supplier_product_name) WHERE (normalized_supplier_product_name IS NOT NULL);


--
-- Name: cheffing_suppliers_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_suppliers_name_idx ON public.cheffing_suppliers USING btree (normalized_name) WHERE (normalized_name IS NOT NULL);


--
-- Name: cheffing_suppliers_tax_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cheffing_suppliers_tax_id_idx ON public.cheffing_suppliers USING btree (normalized_tax_id) WHERE (normalized_tax_id IS NOT NULL);


--
-- Name: day_status_event_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX day_status_event_date_idx ON public.day_status USING btree (event_date);


--
-- Name: group_events_event_date_entry_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_events_event_date_entry_time_idx ON public.group_events USING btree (event_date, entry_time);


--
-- Name: group_events_event_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_events_event_date_idx ON public.group_events USING btree (event_date);


--
-- Name: group_room_allocations_group_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_room_allocations_group_event_id_idx ON public.group_room_allocations USING btree (group_event_id);


--
-- Name: group_room_allocations_room_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_room_allocations_room_id_idx ON public.group_room_allocations USING btree (room_id);


--
-- Name: group_staffing_plans_group_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_staffing_plans_group_event_id_idx ON public.group_staffing_plans USING btree (group_event_id);


--
-- Name: group_staffing_plans_staffing_ratio_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_staffing_plans_staffing_ratio_id_idx ON public.group_staffing_plans USING btree (staffing_ratio_id);


--
-- Name: idx_cheffing_dish_items_dish_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cheffing_dish_items_dish_id ON public.cheffing_dish_items USING btree (dish_id);


--
-- Name: idx_cheffing_dish_items_ingredient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cheffing_dish_items_ingredient_id ON public.cheffing_dish_items USING btree (ingredient_id);


--
-- Name: idx_cheffing_dish_items_subrecipe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cheffing_dish_items_subrecipe_id ON public.cheffing_dish_items USING btree (subrecipe_id);


--
-- Name: idx_cheffing_ingredients_purchase_unit_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cheffing_ingredients_purchase_unit_code ON public.cheffing_ingredients USING btree (purchase_unit_code);


--
-- Name: idx_cheffing_subrecipe_items_ingredient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cheffing_subrecipe_items_ingredient_id ON public.cheffing_subrecipe_items USING btree (ingredient_id);


--
-- Name: idx_cheffing_subrecipe_items_subrecipe_component_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cheffing_subrecipe_items_subrecipe_component_id ON public.cheffing_subrecipe_items USING btree (subrecipe_component_id);


--
-- Name: idx_cheffing_subrecipe_items_subrecipe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cheffing_subrecipe_items_subrecipe_id ON public.cheffing_subrecipe_items USING btree (subrecipe_id);


--
-- Name: idx_cheffing_subrecipes_output_unit_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cheffing_subrecipes_output_unit_code ON public.cheffing_subrecipes USING btree (output_unit_code);


--
-- Name: idx_routines_pack_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routines_pack_id ON public.routines USING btree (routine_pack_id);


--
-- Name: idx_tasks_routine_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_routine_id ON public.tasks USING btree (routine_id);


--
-- Name: idx_tasks_routine_week_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_routine_week_start ON public.tasks USING btree (routine_week_start);


--
-- Name: rooms_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rooms_sort_order_idx ON public.rooms USING btree (sort_order);


--
-- Name: routines_area_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX routines_area_active_idx ON public.routines USING btree (area, is_active);


--
-- Name: routines_day_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX routines_day_active_idx ON public.routines USING btree (day_of_week, is_active);


--
-- Name: staffing_ratios_single_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX staffing_ratios_single_active_idx ON public.staffing_ratios USING btree (is_active) WHERE is_active;


--
-- Name: tasks_area_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_area_status_idx ON public.tasks USING btree (area, status);


--
-- Name: tasks_due_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_due_date_idx ON public.tasks USING btree (due_date);


--
-- Name: ux_cheffing_dishes_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_cheffing_dishes_source ON public.cheffing_dishes USING btree (source_system, source_uid);


--
-- Name: ux_cheffing_ingredients_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_cheffing_ingredients_source ON public.cheffing_ingredients USING btree (source_system, source_uid);


--
-- Name: ux_cheffing_subrecipes_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_cheffing_subrecipes_source ON public.cheffing_subrecipes USING btree (source_system, source_uid);


--
-- Name: cheffing_purchase_documents enforce_purchase_document_apply_ready; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_purchase_document_apply_ready BEFORE INSERT OR UPDATE ON public.cheffing_purchase_documents FOR EACH ROW EXECUTE FUNCTION public.cheffing_enforce_purchase_document_apply_ready();


--
-- Name: app_allowed_users normalize_allowed_user_email; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER normalize_allowed_user_email BEFORE INSERT OR UPDATE ON public.app_allowed_users FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_allowed_user_email();


--
-- Name: cheffing_purchase_documents set_purchase_document_effective_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_purchase_document_effective_at BEFORE INSERT OR UPDATE ON public.cheffing_purchase_documents FOR EACH ROW EXECUTE FUNCTION public.cheffing_set_purchase_document_effective_at();


--
-- Name: cheffing_purchase_documents set_purchase_document_storage_retention; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_purchase_document_storage_retention BEFORE INSERT OR UPDATE ON public.cheffing_purchase_documents FOR EACH ROW EXECUTE FUNCTION public.cheffing_set_purchase_document_storage_retention();


--
-- Name: cheffing_purchase_document_lines set_purchase_line_effective_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_purchase_line_effective_at BEFORE INSERT OR UPDATE ON public.cheffing_purchase_document_lines FOR EACH ROW EXECUTE FUNCTION public.cheffing_set_purchase_line_effective_at();


--
-- Name: group_events set_timestamp_group_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_group_events BEFORE UPDATE ON public.group_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: group_room_allocations set_timestamp_group_room_allocations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_group_room_allocations BEFORE UPDATE ON public.group_room_allocations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: group_staffing_plans set_timestamp_group_staffing_plans; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_group_staffing_plans BEFORE UPDATE ON public.group_staffing_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: rooms set_timestamp_rooms; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_rooms BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: routines set_timestamp_routines; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_routines BEFORE UPDATE ON public.routines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tasks set_timestamp_tasks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_tasks BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cheffing_card_items set_updated_at_cheffing_card_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_card_items BEFORE UPDATE ON public.cheffing_card_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_cards set_updated_at_cheffing_cards; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_cards BEFORE UPDATE ON public.cheffing_cards FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_dish_items set_updated_at_cheffing_dish_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_dish_items BEFORE UPDATE ON public.cheffing_dish_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_dishes set_updated_at_cheffing_dishes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_dishes BEFORE UPDATE ON public.cheffing_dishes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_families set_updated_at_cheffing_families; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_families BEFORE UPDATE ON public.cheffing_families FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_ingredients set_updated_at_cheffing_ingredients; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_ingredients BEFORE UPDATE ON public.cheffing_ingredients FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_menu_items set_updated_at_cheffing_menu_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_menu_items BEFORE UPDATE ON public.cheffing_menu_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_menus set_updated_at_cheffing_menus; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_menus BEFORE UPDATE ON public.cheffing_menus FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_pos_product_links set_updated_at_cheffing_pos_product_links; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_pos_product_links BEFORE UPDATE ON public.cheffing_pos_product_links FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_pos_sales_daily set_updated_at_cheffing_pos_sales_daily; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_pos_sales_daily BEFORE UPDATE ON public.cheffing_pos_sales_daily FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_purchase_document_lines set_updated_at_cheffing_purchase_document_lines; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_purchase_document_lines BEFORE UPDATE ON public.cheffing_purchase_document_lines FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_purchase_documents set_updated_at_cheffing_purchase_documents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_purchase_documents BEFORE UPDATE ON public.cheffing_purchase_documents FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_subrecipe_items set_updated_at_cheffing_subrecipe_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_subrecipe_items BEFORE UPDATE ON public.cheffing_subrecipe_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_subrecipes set_updated_at_cheffing_subrecipes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_subrecipes BEFORE UPDATE ON public.cheffing_subrecipes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_supplier_product_refs set_updated_at_cheffing_supplier_product_refs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_supplier_product_refs BEFORE UPDATE ON public.cheffing_supplier_product_refs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_suppliers set_updated_at_cheffing_suppliers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_suppliers BEFORE UPDATE ON public.cheffing_suppliers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: cheffing_units set_updated_at_cheffing_units; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cheffing_units BEFORE UPDATE ON public.cheffing_units FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: menu_second_courses set_updated_at_menu_second_courses; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_menu_second_courses BEFORE UPDATE ON public.menu_second_courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: menus set_updated_at_menus; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_menus BEFORE UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cheffing_purchase_documents sync_purchase_lines_effective_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_purchase_lines_effective_at AFTER UPDATE OF effective_at ON public.cheffing_purchase_documents FOR EACH ROW WHEN ((old.effective_at IS DISTINCT FROM new.effective_at)) EXECUTE FUNCTION public.cheffing_sync_purchase_lines_effective_at();


--
-- Name: app_allowed_users trg_app_allowed_users_email_lowercase; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_app_allowed_users_email_lowercase BEFORE INSERT OR UPDATE ON public.app_allowed_users FOR EACH ROW EXECUTE FUNCTION public.app_allowed_users_email_lowercase();


--
-- Name: cheffing_dish_items trg_cheffing_dish_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cheffing_dish_items_updated_at BEFORE UPDATE ON public.cheffing_dish_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cheffing_dishes trg_cheffing_dishes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cheffing_dishes_updated_at BEFORE UPDATE ON public.cheffing_dishes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cheffing_ingredients trg_cheffing_ingredients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cheffing_ingredients_updated_at BEFORE UPDATE ON public.cheffing_ingredients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cheffing_pos_sales_daily trg_cheffing_pos_sales_daily_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cheffing_pos_sales_daily_updated_at BEFORE UPDATE ON public.cheffing_pos_sales_daily FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cheffing_subrecipe_items trg_cheffing_subrecipe_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cheffing_subrecipe_items_updated_at BEFORE UPDATE ON public.cheffing_subrecipe_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cheffing_subrecipes trg_cheffing_subrecipes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cheffing_subrecipes_updated_at BEFORE UPDATE ON public.cheffing_subrecipes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cheffing_units trg_cheffing_units_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cheffing_units_updated_at BEFORE UPDATE ON public.cheffing_units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: day_status trg_day_status_sync_legacy_columns; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_day_status_sync_legacy_columns BEFORE INSERT OR UPDATE ON public.day_status FOR EACH ROW EXECUTE FUNCTION public.day_status_sync_legacy_columns();


--
-- Name: group_events trg_group_events_recalculate_staffing; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_group_events_recalculate_staffing AFTER INSERT OR UPDATE ON public.group_events FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_group_staffing_plan();


--
-- Name: group_room_allocations trg_set_override_capacity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_override_capacity BEFORE INSERT OR UPDATE ON public.group_room_allocations FOR EACH ROW EXECUTE FUNCTION public.set_override_capacity();


--
-- Name: cheffing_card_items cheffing_card_items_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_card_items
    ADD CONSTRAINT cheffing_card_items_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cheffing_cards(id) ON DELETE CASCADE;


--
-- Name: cheffing_card_items cheffing_card_items_dish_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_card_items
    ADD CONSTRAINT cheffing_card_items_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.cheffing_dishes(id) ON DELETE RESTRICT;


--
-- Name: cheffing_dish_items cheffing_dish_items_dish_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_dish_items
    ADD CONSTRAINT cheffing_dish_items_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.cheffing_dishes(id) ON DELETE CASCADE;


--
-- Name: cheffing_dish_items cheffing_dish_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_dish_items
    ADD CONSTRAINT cheffing_dish_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.cheffing_ingredients(id);


--
-- Name: cheffing_dish_items cheffing_dish_items_subrecipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_dish_items
    ADD CONSTRAINT cheffing_dish_items_subrecipe_id_fkey FOREIGN KEY (subrecipe_id) REFERENCES public.cheffing_subrecipes(id);


--
-- Name: cheffing_dish_items cheffing_dish_items_unit_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_dish_items
    ADD CONSTRAINT cheffing_dish_items_unit_code_fkey FOREIGN KEY (unit_code) REFERENCES public.cheffing_units(code);


--
-- Name: cheffing_dish_source_labels cheffing_dish_source_labels_dish_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_dish_source_labels
    ADD CONSTRAINT cheffing_dish_source_labels_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.cheffing_dishes(id) ON DELETE CASCADE;


--
-- Name: cheffing_dish_source_labels cheffing_dish_source_labels_source_label_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_dish_source_labels
    ADD CONSTRAINT cheffing_dish_source_labels_source_label_uid_fkey FOREIGN KEY (source_label_uid) REFERENCES public.cheffing_source_labels(source_uid) ON DELETE CASCADE;


--
-- Name: cheffing_dish_tags cheffing_dish_tags_dish_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_dish_tags
    ADD CONSTRAINT cheffing_dish_tags_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.cheffing_dishes(id) ON DELETE CASCADE;


--
-- Name: cheffing_dish_tags cheffing_dish_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_dish_tags
    ADD CONSTRAINT cheffing_dish_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.cheffing_tags(id) ON DELETE CASCADE;


--
-- Name: cheffing_dishes cheffing_dishes_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_dishes
    ADD CONSTRAINT cheffing_dishes_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.cheffing_families(id) ON DELETE SET NULL;


--
-- Name: cheffing_ingredient_cost_audit cheffing_ingredient_cost_audit_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_ingredient_cost_audit
    ADD CONSTRAINT cheffing_ingredient_cost_audit_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.cheffing_ingredients(id) ON DELETE RESTRICT;


--
-- Name: cheffing_ingredient_cost_audit cheffing_ingredient_cost_audit_purchase_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_ingredient_cost_audit
    ADD CONSTRAINT cheffing_ingredient_cost_audit_purchase_document_id_fkey FOREIGN KEY (purchase_document_id) REFERENCES public.cheffing_purchase_documents(id) ON DELETE RESTRICT;


--
-- Name: cheffing_ingredient_cost_audit cheffing_ingredient_cost_audit_purchase_document_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_ingredient_cost_audit
    ADD CONSTRAINT cheffing_ingredient_cost_audit_purchase_document_line_id_fkey FOREIGN KEY (purchase_document_line_id) REFERENCES public.cheffing_purchase_document_lines(id) ON DELETE RESTRICT;


--
-- Name: cheffing_ingredient_cost_audit cheffing_ingredient_cost_audit_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_ingredient_cost_audit
    ADD CONSTRAINT cheffing_ingredient_cost_audit_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.cheffing_suppliers(id) ON DELETE SET NULL;


--
-- Name: cheffing_ingredient_tags cheffing_ingredient_tags_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_ingredient_tags
    ADD CONSTRAINT cheffing_ingredient_tags_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.cheffing_ingredients(id) ON DELETE CASCADE;


--
-- Name: cheffing_ingredient_tags cheffing_ingredient_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_ingredient_tags
    ADD CONSTRAINT cheffing_ingredient_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.cheffing_tags(id) ON DELETE CASCADE;


--
-- Name: cheffing_ingredients cheffing_ingredients_purchase_unit_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_ingredients
    ADD CONSTRAINT cheffing_ingredients_purchase_unit_code_fkey FOREIGN KEY (purchase_unit_code) REFERENCES public.cheffing_units(code);


--
-- Name: cheffing_ingredients cheffing_ingredients_stock_unit_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_ingredients
    ADD CONSTRAINT cheffing_ingredients_stock_unit_fk FOREIGN KEY (stock_unit_code) REFERENCES public.cheffing_units(code);


--
-- Name: cheffing_menu_items cheffing_menu_items_dish_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_menu_items
    ADD CONSTRAINT cheffing_menu_items_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.cheffing_dishes(id) ON DELETE RESTRICT;


--
-- Name: cheffing_menu_items cheffing_menu_items_menu_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_menu_items
    ADD CONSTRAINT cheffing_menu_items_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES public.cheffing_menus(id) ON DELETE CASCADE;


--
-- Name: cheffing_pos_order_items cheffing_pos_order_items_pos_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_pos_order_items
    ADD CONSTRAINT cheffing_pos_order_items_pos_order_id_fkey FOREIGN KEY (pos_order_id) REFERENCES public.cheffing_pos_orders(pos_order_id) ON DELETE CASCADE;


--
-- Name: cheffing_pos_product_links cheffing_pos_product_links_dish_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_pos_product_links
    ADD CONSTRAINT cheffing_pos_product_links_dish_id_fkey FOREIGN KEY (dish_id) REFERENCES public.cheffing_dishes(id) ON DELETE CASCADE;


--
-- Name: cheffing_purchase_document_lines cheffing_purchase_document_lines_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_purchase_document_lines
    ADD CONSTRAINT cheffing_purchase_document_lines_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.cheffing_purchase_documents(id) ON DELETE CASCADE;


--
-- Name: cheffing_purchase_document_lines cheffing_purchase_document_lines_suggested_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_purchase_document_lines
    ADD CONSTRAINT cheffing_purchase_document_lines_suggested_ingredient_id_fkey FOREIGN KEY (suggested_ingredient_id) REFERENCES public.cheffing_ingredients(id) ON DELETE SET NULL;


--
-- Name: cheffing_purchase_document_lines cheffing_purchase_document_lines_validated_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_purchase_document_lines
    ADD CONSTRAINT cheffing_purchase_document_lines_validated_ingredient_id_fkey FOREIGN KEY (validated_ingredient_id) REFERENCES public.cheffing_ingredients(id) ON DELETE SET NULL;


--
-- Name: cheffing_purchase_documents cheffing_purchase_documents_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_purchase_documents
    ADD CONSTRAINT cheffing_purchase_documents_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.cheffing_suppliers(id) ON DELETE SET NULL;


--
-- Name: cheffing_subrecipe_items cheffing_subrecipe_items_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_subrecipe_items
    ADD CONSTRAINT cheffing_subrecipe_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.cheffing_ingredients(id);


--
-- Name: cheffing_subrecipe_items cheffing_subrecipe_items_subrecipe_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_subrecipe_items
    ADD CONSTRAINT cheffing_subrecipe_items_subrecipe_component_id_fkey FOREIGN KEY (subrecipe_component_id) REFERENCES public.cheffing_subrecipes(id);


--
-- Name: cheffing_subrecipe_items cheffing_subrecipe_items_subrecipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_subrecipe_items
    ADD CONSTRAINT cheffing_subrecipe_items_subrecipe_id_fkey FOREIGN KEY (subrecipe_id) REFERENCES public.cheffing_subrecipes(id) ON DELETE CASCADE;


--
-- Name: cheffing_subrecipe_items cheffing_subrecipe_items_unit_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_subrecipe_items
    ADD CONSTRAINT cheffing_subrecipe_items_unit_code_fkey FOREIGN KEY (unit_code) REFERENCES public.cheffing_units(code);


--
-- Name: cheffing_subrecipe_tags cheffing_subrecipe_tags_subrecipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_subrecipe_tags
    ADD CONSTRAINT cheffing_subrecipe_tags_subrecipe_id_fkey FOREIGN KEY (subrecipe_id) REFERENCES public.cheffing_subrecipes(id) ON DELETE CASCADE;


--
-- Name: cheffing_subrecipe_tags cheffing_subrecipe_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_subrecipe_tags
    ADD CONSTRAINT cheffing_subrecipe_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.cheffing_tags(id) ON DELETE CASCADE;


--
-- Name: cheffing_subrecipes cheffing_subrecipes_output_unit_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_subrecipes
    ADD CONSTRAINT cheffing_subrecipes_output_unit_code_fkey FOREIGN KEY (output_unit_code) REFERENCES public.cheffing_units(code);


--
-- Name: cheffing_supplier_product_refs cheffing_supplier_product_refs_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_supplier_product_refs
    ADD CONSTRAINT cheffing_supplier_product_refs_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.cheffing_ingredients(id) ON DELETE CASCADE;


--
-- Name: cheffing_supplier_product_refs cheffing_supplier_product_refs_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheffing_supplier_product_refs
    ADD CONSTRAINT cheffing_supplier_product_refs_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.cheffing_suppliers(id) ON DELETE CASCADE;


--
-- Name: group_events group_events_menu_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_events
    ADD CONSTRAINT group_events_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES public.menus(id);


--
-- Name: group_room_allocations group_room_allocations_group_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_room_allocations
    ADD CONSTRAINT group_room_allocations_group_event_id_fkey FOREIGN KEY (group_event_id) REFERENCES public.group_events(id) ON DELETE CASCADE;


--
-- Name: group_room_allocations group_room_allocations_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_room_allocations
    ADD CONSTRAINT group_room_allocations_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id);


--
-- Name: group_staffing_plans group_staffing_plans_group_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_staffing_plans
    ADD CONSTRAINT group_staffing_plans_group_event_id_fkey FOREIGN KEY (group_event_id) REFERENCES public.group_events(id) ON DELETE CASCADE;


--
-- Name: group_staffing_plans group_staffing_plans_staffing_ratio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_staffing_plans
    ADD CONSTRAINT group_staffing_plans_staffing_ratio_id_fkey FOREIGN KEY (staffing_ratio_id) REFERENCES public.staffing_ratios(id);


--
-- Name: menu_second_courses menu_second_courses_menu_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_second_courses
    ADD CONSTRAINT menu_second_courses_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES public.menus(id) ON DELETE CASCADE;


--
-- Name: routines routines_routine_pack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routines
    ADD CONSTRAINT routines_routine_pack_id_fkey FOREIGN KEY (routine_pack_id) REFERENCES public.routine_packs(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_routine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES public.routines(id) ON DELETE RESTRICT;


--
-- Name: app_allowed_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_allowed_users ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_card_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_card_items ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_card_items cheffing_card_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_card_items_select ON public.cheffing_card_items FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_card_items cheffing_card_items_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_card_items_write ON public.cheffing_card_items USING (public.cheffing_is_admin()) WITH CHECK (public.cheffing_is_admin());


--
-- Name: cheffing_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_cards cheffing_cards_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_cards_select ON public.cheffing_cards FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_cards cheffing_cards_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_cards_write ON public.cheffing_cards USING (public.cheffing_is_admin()) WITH CHECK (public.cheffing_is_admin());


--
-- Name: cheffing_dish_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_dish_items ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_dish_items cheffing_dish_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_dish_items_delete ON public.cheffing_dish_items FOR DELETE USING (public.cheffing_is_allowed());


--
-- Name: cheffing_dish_items cheffing_dish_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_dish_items_insert ON public.cheffing_dish_items FOR INSERT WITH CHECK (public.cheffing_is_allowed());


--
-- Name: cheffing_dish_items cheffing_dish_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_dish_items_select ON public.cheffing_dish_items FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_dish_items cheffing_dish_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_dish_items_update ON public.cheffing_dish_items FOR UPDATE USING (public.cheffing_is_allowed()) WITH CHECK (public.cheffing_is_allowed());


--
-- Name: cheffing_dishes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_dishes ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_dishes cheffing_dishes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_dishes_delete ON public.cheffing_dishes FOR DELETE USING (public.cheffing_is_allowed());


--
-- Name: cheffing_dishes cheffing_dishes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_dishes_insert ON public.cheffing_dishes FOR INSERT WITH CHECK (public.cheffing_is_allowed());


--
-- Name: cheffing_dishes cheffing_dishes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_dishes_select ON public.cheffing_dishes FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_dishes cheffing_dishes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_dishes_update ON public.cheffing_dishes FOR UPDATE USING (public.cheffing_is_allowed()) WITH CHECK (public.cheffing_is_allowed());


--
-- Name: cheffing_families; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_families ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_families cheffing_families_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_families_select ON public.cheffing_families FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_families cheffing_families_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_families_write ON public.cheffing_families USING (public.cheffing_is_admin()) WITH CHECK (public.cheffing_is_admin());


--
-- Name: cheffing_ingredient_cost_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_ingredient_cost_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_ingredient_cost_audit cheffing_ingredient_cost_audit_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_ingredient_cost_audit_select ON public.cheffing_ingredient_cost_audit FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_ingredient_cost_audit cheffing_ingredient_cost_audit_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_ingredient_cost_audit_write ON public.cheffing_ingredient_cost_audit USING (public.cheffing_is_admin()) WITH CHECK (public.cheffing_is_admin());


--
-- Name: cheffing_ingredients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_ingredients ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_ingredients cheffing_ingredients_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_ingredients_delete ON public.cheffing_ingredients FOR DELETE USING (public.cheffing_is_allowed());


--
-- Name: cheffing_ingredients cheffing_ingredients_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_ingredients_insert ON public.cheffing_ingredients FOR INSERT WITH CHECK (public.cheffing_is_allowed());


--
-- Name: cheffing_ingredients cheffing_ingredients_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_ingredients_select ON public.cheffing_ingredients FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_ingredients cheffing_ingredients_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_ingredients_update ON public.cheffing_ingredients FOR UPDATE USING (public.cheffing_is_allowed()) WITH CHECK (public.cheffing_is_allowed());


--
-- Name: cheffing_menu_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_menu_items ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_menu_items cheffing_menu_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_menu_items_select ON public.cheffing_menu_items FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_menu_items cheffing_menu_items_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_menu_items_write ON public.cheffing_menu_items USING (public.cheffing_is_admin()) WITH CHECK (public.cheffing_is_admin());


--
-- Name: cheffing_menus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_menus ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_menus cheffing_menus_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_menus_select ON public.cheffing_menus FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_menus cheffing_menus_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_menus_write ON public.cheffing_menus USING (public.cheffing_is_admin()) WITH CHECK (public.cheffing_is_admin());


--
-- Name: cheffing_pos_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_pos_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_pos_order_items cheffing_pos_order_items_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_pos_order_items_all ON public.cheffing_pos_order_items USING (public.cheffing_is_allowed()) WITH CHECK (public.cheffing_is_allowed());


--
-- Name: cheffing_pos_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_pos_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_pos_orders cheffing_pos_orders_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_pos_orders_all ON public.cheffing_pos_orders USING (public.cheffing_is_allowed()) WITH CHECK (public.cheffing_is_allowed());


--
-- Name: cheffing_pos_product_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_pos_product_links ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_pos_product_links cheffing_pos_product_links_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_pos_product_links_select ON public.cheffing_pos_product_links FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_pos_product_links cheffing_pos_product_links_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_pos_product_links_write ON public.cheffing_pos_product_links USING (public.cheffing_is_admin()) WITH CHECK (public.cheffing_is_admin());


--
-- Name: cheffing_pos_sales_daily; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_pos_sales_daily ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_pos_sales_daily cheffing_pos_sales_daily_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_pos_sales_daily_select ON public.cheffing_pos_sales_daily FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_pos_sales_daily cheffing_pos_sales_daily_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_pos_sales_daily_write ON public.cheffing_pos_sales_daily USING (public.cheffing_is_admin()) WITH CHECK (public.cheffing_is_admin());


--
-- Name: cheffing_purchase_document_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_purchase_document_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_purchase_document_lines cheffing_purchase_document_lines_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_purchase_document_lines_select ON public.cheffing_purchase_document_lines FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_purchase_document_lines cheffing_purchase_document_lines_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_purchase_document_lines_write ON public.cheffing_purchase_document_lines USING (public.cheffing_is_admin()) WITH CHECK (public.cheffing_is_admin());


--
-- Name: cheffing_purchase_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_purchase_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_purchase_documents cheffing_purchase_documents_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_purchase_documents_select ON public.cheffing_purchase_documents FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_purchase_documents cheffing_purchase_documents_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_purchase_documents_write ON public.cheffing_purchase_documents USING (public.cheffing_is_admin()) WITH CHECK (public.cheffing_is_admin());


--
-- Name: cheffing_subrecipe_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_subrecipe_items ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_subrecipe_items cheffing_subrecipe_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_subrecipe_items_delete ON public.cheffing_subrecipe_items FOR DELETE USING (public.cheffing_is_allowed());


--
-- Name: cheffing_subrecipe_items cheffing_subrecipe_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_subrecipe_items_insert ON public.cheffing_subrecipe_items FOR INSERT WITH CHECK (public.cheffing_is_allowed());


--
-- Name: cheffing_subrecipe_items cheffing_subrecipe_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_subrecipe_items_select ON public.cheffing_subrecipe_items FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_subrecipe_items cheffing_subrecipe_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_subrecipe_items_update ON public.cheffing_subrecipe_items FOR UPDATE USING (public.cheffing_is_allowed()) WITH CHECK (public.cheffing_is_allowed());


--
-- Name: cheffing_subrecipes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_subrecipes ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_subrecipes cheffing_subrecipes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_subrecipes_delete ON public.cheffing_subrecipes FOR DELETE USING (public.cheffing_is_allowed());


--
-- Name: cheffing_subrecipes cheffing_subrecipes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_subrecipes_insert ON public.cheffing_subrecipes FOR INSERT WITH CHECK (public.cheffing_is_allowed());


--
-- Name: cheffing_subrecipes cheffing_subrecipes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_subrecipes_select ON public.cheffing_subrecipes FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_subrecipes cheffing_subrecipes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_subrecipes_update ON public.cheffing_subrecipes FOR UPDATE USING (public.cheffing_is_allowed()) WITH CHECK (public.cheffing_is_allowed());


--
-- Name: cheffing_supplier_product_refs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_supplier_product_refs ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_supplier_product_refs cheffing_supplier_product_refs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_supplier_product_refs_select ON public.cheffing_supplier_product_refs FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_supplier_product_refs cheffing_supplier_product_refs_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_supplier_product_refs_write ON public.cheffing_supplier_product_refs USING (public.cheffing_is_admin()) WITH CHECK (public.cheffing_is_admin());


--
-- Name: cheffing_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_suppliers cheffing_suppliers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_suppliers_select ON public.cheffing_suppliers FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_suppliers cheffing_suppliers_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_suppliers_write ON public.cheffing_suppliers USING (public.cheffing_is_admin()) WITH CHECK (public.cheffing_is_admin());


--
-- Name: cheffing_units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cheffing_units ENABLE ROW LEVEL SECURITY;

--
-- Name: cheffing_units cheffing_units_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_units_delete ON public.cheffing_units FOR DELETE USING (public.cheffing_is_admin());


--
-- Name: cheffing_units cheffing_units_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_units_insert ON public.cheffing_units FOR INSERT WITH CHECK (public.cheffing_is_admin());


--
-- Name: cheffing_units cheffing_units_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_units_select ON public.cheffing_units FOR SELECT USING (public.cheffing_is_allowed());


--
-- Name: cheffing_units cheffing_units_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cheffing_units_update ON public.cheffing_units FOR UPDATE USING (public.cheffing_is_admin()) WITH CHECK (public.cheffing_is_admin());


--
-- Name: app_allowed_users read own allowlist row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read own allowlist row" ON public.app_allowed_users FOR SELECT TO authenticated USING (((is_active = true) AND (lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), current_setting('request.jwt.claim.email'::text, true))))));


--
-- PostgreSQL database dump complete
--

\unrestrict dXyRcX1awAjDB0RKjTpfh4W6gvqZmegWgfzRRDfkhkGEEIlxPoyLxPGF7NvFBQd

