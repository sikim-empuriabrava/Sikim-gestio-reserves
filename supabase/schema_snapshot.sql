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
    CONSTRAINT app_allowed_users_email_lower_chk CHECK ((email = lower(email))),
    CONSTRAINT app_allowed_users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'staff'::text, 'viewer'::text])))
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
    CONSTRAINT group_events_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'confirmed'::text, 'cancelled'::text]))),
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
    CONSTRAINT tasks_status_open_done CHECK ((status = ANY (ARRAY['open'::public.task_status, 'done'::public.task_status]))),
    CONSTRAINT tasks_window_dates_chk CHECK (((window_start_date IS NULL) OR (due_date IS NULL) OR (window_start_date <= due_date)))
);


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
-- Name: app_allowed_users app_allowed_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_allowed_users
    ADD CONSTRAINT app_allowed_users_pkey PRIMARY KEY (email);


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
-- Name: app_allowed_users normalize_allowed_user_email; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER normalize_allowed_user_email BEFORE INSERT OR UPDATE ON public.app_allowed_users FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_allowed_user_email();


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
-- Name: menu_second_courses set_updated_at_menu_second_courses; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_menu_second_courses BEFORE UPDATE ON public.menu_second_courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: menus set_updated_at_menus; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_menus BEFORE UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: app_allowed_users trg_app_allowed_users_email_lowercase; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_app_allowed_users_email_lowercase BEFORE INSERT OR UPDATE ON public.app_allowed_users FOR EACH ROW EXECUTE FUNCTION public.app_allowed_users_email_lowercase();


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
-- Name: app_allowed_users read own allowlist row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read own allowlist row" ON public.app_allowed_users FOR SELECT TO authenticated USING (((is_active = true) AND (lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), current_setting('request.jwt.claim.email'::text, true))))));


--
-- PostgreSQL database dump complete
--

\unrestrict bkUIG94AdOlGaLJaEB873jfOPvwM5QMsNm42ANiGNN6BwYUiMbAzd5KDQsrfVDK

