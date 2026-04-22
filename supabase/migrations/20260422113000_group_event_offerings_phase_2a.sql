create table if not exists public.group_event_offerings (
  id uuid primary key default gen_random_uuid(),
  group_event_id uuid not null references public.group_events(id) on delete cascade,
  offering_kind text not null check (offering_kind in ('cheffing_menu', 'cheffing_card')),
  cheffing_menu_id uuid null references public.cheffing_menus(id),
  cheffing_card_id uuid null references public.cheffing_cards(id),
  assigned_pax integer not null check (assigned_pax > 0),
  display_name_snapshot text not null,
  unit_price_snapshot numeric(10,2) null,
  notes text null,
  sort_order integer not null default 0,
  snapshot_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint group_event_offerings_reference_consistency_chk check (
    (
      offering_kind = 'cheffing_menu'
      and cheffing_menu_id is not null
      and cheffing_card_id is null
    )
    or (
      offering_kind = 'cheffing_card'
      and cheffing_card_id is not null
      and cheffing_menu_id is null
    )
  )
);

create index if not exists group_event_offerings_event_sort_created_idx
  on public.group_event_offerings (group_event_id, sort_order, created_at);

create index if not exists group_event_offerings_cheffing_menu_idx
  on public.group_event_offerings (cheffing_menu_id)
  where cheffing_menu_id is not null;

create index if not exists group_event_offerings_cheffing_card_idx
  on public.group_event_offerings (cheffing_card_id)
  where cheffing_card_id is not null;

create or replace function public.rebuild_group_event_menu_text(p_group_event_id uuid)
returns void
language plpgsql
as $$
declare
  v_menu_text text;
begin
  select string_agg(
      format('%sx %s', offered.assigned_pax, offered.display_name_snapshot),
      ' · '
      order by offered.sort_order, offered.created_at, offered.id
    )
    into v_menu_text
  from public.group_event_offerings as offered
  where offered.group_event_id = p_group_event_id;

  update public.group_events
  set menu_text = nullif(v_menu_text, ''),
      updated_at = timezone('utc', now())
  where id = p_group_event_id;
end;
$$;

create or replace function public.tg_group_event_offerings_sync_menu_text()
returns trigger
language plpgsql
as $$
declare
  v_group_event_id uuid;
begin
  v_group_event_id := coalesce(new.group_event_id, old.group_event_id);
  perform public.rebuild_group_event_menu_text(v_group_event_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists set_updated_at_group_event_offerings on public.group_event_offerings;
create trigger set_updated_at_group_event_offerings
before update on public.group_event_offerings
for each row
execute function public.tg_set_updated_at();

drop trigger if exists sync_group_event_menu_text_from_offerings on public.group_event_offerings;
create trigger sync_group_event_menu_text_from_offerings
after insert or update or delete on public.group_event_offerings
for each row
execute function public.tg_group_event_offerings_sync_menu_text();
