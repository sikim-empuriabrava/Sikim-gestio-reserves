--
-- PostgreSQL database dump
--

\restrict SUeqLm7SrTqqY8spS5srtNf5siAjODFemhB3iDDYOanCGu31i5uumd3bRj4phur

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7 (Ubuntu 17.7-3.pgdg24.04+1)

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
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


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
    CONSTRAINT routines_day_of_week_check CHECK (((day_of_week >= 1) AND (day_of_week <= 7)))
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: app_allowed_users_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX app_allowed_users_email_unique ON public.app_allowed_users USING btree (lower(email));


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
-- Name: app_allowed_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_allowed_users ENABLE ROW LEVEL SECURITY;

--
-- Name: app_allowed_users read own allowlist row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read own allowlist row" ON public.app_allowed_users FOR SELECT TO authenticated USING (((is_active = true) AND (email = COALESCE((auth.jwt() ->> 'email'::text), current_setting('request.jwt.claim.email'::text, true)))));


--
-- PostgreSQL database dump complete
--

\unrestrict SUeqLm7SrTqqY8spS5srtNf5siAjODFemhB3iDDYOanCGu31i5uumd3bRj4phur

