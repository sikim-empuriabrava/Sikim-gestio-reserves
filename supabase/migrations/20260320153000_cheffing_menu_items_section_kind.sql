-- Add menu section grouping to reflect real-world menu structure.

alter table public.cheffing_menu_items
  add column if not exists section_kind text;

update public.cheffing_menu_items
set section_kind = 'starter'
where section_kind is null;

alter table public.cheffing_menu_items
  alter column section_kind set default 'starter';

alter table public.cheffing_menu_items
  alter column section_kind set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cheffing_menu_items_section_kind_check'
      and conrelid = 'public.cheffing_menu_items'::regclass
  ) then
    alter table public.cheffing_menu_items
      add constraint cheffing_menu_items_section_kind_check
      check (section_kind in ('starter', 'main', 'drink', 'dessert'));
  end if;
end $$;

create index if not exists cheffing_menu_items_menu_section_sort_idx
  on public.cheffing_menu_items (menu_id, section_kind, sort_order);
