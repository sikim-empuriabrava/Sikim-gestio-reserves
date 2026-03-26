alter table public.cheffing_purchase_document_lines
  add column if not exists validated_unit text null,
  add column if not exists user_note text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cheffing_purchase_document_lines_validated_unit_check'
      and conrelid = 'public.cheffing_purchase_document_lines'::regclass
  ) then
    alter table public.cheffing_purchase_document_lines
      add constraint cheffing_purchase_document_lines_validated_unit_check
      check (
        validated_unit is null
        or validated_unit in ('ud', 'kg', 'g', 'l', 'ml', 'caja', 'pack')
      );
  end if;
end $$;
