create or replace function public.crm_normalize_email(value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(lower(trim(coalesce(value, ''))), '');
$$;

create or replace function public.crm_normalize_phone(value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  with raw_value as (
    select trim(coalesce(value, '')) as raw
  ),
  cleaned_value as (
    select
      case
        when left(raw, 1) = '+' then
          '+' || replace(replace(replace(replace(substr(raw, 2), ' ', ''), '-', ''), '(', ''), ')', '')
        else
          replace(replace(replace(replace(raw, ' ', ''), '-', ''), '(', ''), ')', '')
      end as cleaned
    from raw_value
  )
  select case when cleaned in ('', '+') then null else cleaned end
  from cleaned_value;
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  notes text,
  source text not null default 'reservation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  contact_type text not null check (contact_type in ('phone', 'email')),
  contact_value text not null,
  normalized_value text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_contacts_customer_contact_unique unique (customer_id, contact_type, normalized_value)
);

alter table public.group_events
  add column if not exists customer_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'group_events_customer_id_fkey'
      and conrelid = 'public.group_events'::regclass
  ) then
    alter table public.group_events
      add constraint group_events_customer_id_fkey
      foreign key (customer_id)
      references public.customers(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists customers_display_name_idx
  on public.customers (display_name);

create index if not exists customer_contacts_type_normalized_idx
  on public.customer_contacts (contact_type, normalized_value);

create index if not exists customer_contacts_customer_id_idx
  on public.customer_contacts (customer_id);

create unique index if not exists customer_contacts_one_primary_per_type_idx
  on public.customer_contacts (customer_id, contact_type)
  where is_primary;

create index if not exists group_events_customer_id_idx
  on public.group_events (customer_id);

drop trigger if exists set_updated_at_customers on public.customers;
create trigger set_updated_at_customers
before update on public.customers
for each row
execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_customer_contacts on public.customer_contacts;
create trigger set_updated_at_customer_contacts
before update on public.customer_contacts
for each row
execute function public.tg_set_updated_at();

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;

revoke all on table public.customers from anon, authenticated;
revoke all on table public.customer_contacts from anon, authenticated;
grant all on table public.customers to service_role;
grant all on table public.customer_contacts to service_role;

do $$
declare
  v_reservation record;
  v_customer_id uuid;
  v_has_primary boolean;
begin
  for v_reservation in
    select
      group_event_id,
      created_at,
      customer_name,
      raw_phone,
      raw_email,
      norm_phone,
      norm_email,
      coalesce(customer_name, raw_email, raw_phone) as display_name
    from (
      select
        id as group_event_id,
        created_at,
        nullif(trim(coalesce(customer_name, '')), '') as customer_name,
        nullif(trim(coalesce(customer_phone, '')), '') as raw_phone,
        nullif(trim(coalesce(customer_email, '')), '') as raw_email,
        public.crm_normalize_phone(customer_phone) as norm_phone,
        public.crm_normalize_email(customer_email) as norm_email
      from public.group_events
    ) normalized
    where norm_email is not null
       or norm_phone is not null
    order by created_at nulls last, group_event_id
  loop
    v_customer_id := null;

    if v_reservation.norm_email is not null then
      select cc.customer_id
      into v_customer_id
      from public.customer_contacts cc
      where cc.contact_type = 'email'
        and cc.normalized_value = v_reservation.norm_email
      order by cc.is_primary desc, cc.created_at, cc.customer_id
      limit 1;
    end if;

    if v_customer_id is null and v_reservation.norm_phone is not null then
      select cc.customer_id
      into v_customer_id
      from public.customer_contacts cc
      where cc.contact_type = 'phone'
        and cc.normalized_value = v_reservation.norm_phone
      order by cc.is_primary desc, cc.created_at, cc.customer_id
      limit 1;
    end if;

    if v_customer_id is null then
      insert into public.customers (display_name, source)
      values (v_reservation.display_name, 'reservation')
      returning id into v_customer_id;
    end if;

    if v_reservation.norm_email is not null then
      select exists (
        select 1
        from public.customer_contacts cc
        where cc.customer_id = v_customer_id
          and cc.contact_type = 'email'
          and cc.is_primary
      )
      into v_has_primary;

      insert into public.customer_contacts (
        customer_id,
        contact_type,
        contact_value,
        normalized_value,
        is_primary
      )
      values (
        v_customer_id,
        'email',
        v_reservation.raw_email,
        v_reservation.norm_email,
        not v_has_primary
      )
      on conflict on constraint customer_contacts_customer_contact_unique do nothing;
    end if;

    if v_reservation.norm_phone is not null then
      select exists (
        select 1
        from public.customer_contacts cc
        where cc.customer_id = v_customer_id
          and cc.contact_type = 'phone'
          and cc.is_primary
      )
      into v_has_primary;

      insert into public.customer_contacts (
        customer_id,
        contact_type,
        contact_value,
        normalized_value,
        is_primary
      )
      values (
        v_customer_id,
        'phone',
        v_reservation.raw_phone,
        v_reservation.norm_phone,
        not v_has_primary
      )
      on conflict on constraint customer_contacts_customer_contact_unique do nothing;
    end if;

    update public.group_events
    set customer_id = v_customer_id
    where id = v_reservation.group_event_id;
  end loop;

  with missing_primary as (
    select customer_id, contact_type
    from public.customer_contacts
    group by customer_id, contact_type
    having not bool_or(is_primary)
  ),
  ranked_contacts as (
    select
      cc.id,
      row_number() over (
        partition by cc.customer_id, cc.contact_type
        order by cc.created_at, cc.id
      ) as rn
    from public.customer_contacts cc
    join missing_primary mp
      on mp.customer_id = cc.customer_id
     and mp.contact_type = cc.contact_type
  )
  update public.customer_contacts cc
  set is_primary = true
  from ranked_contacts ranked
  where ranked.id = cc.id
    and ranked.rn = 1;
end;
$$;
