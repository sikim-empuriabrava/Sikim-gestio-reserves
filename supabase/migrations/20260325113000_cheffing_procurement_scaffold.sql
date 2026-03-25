-- Cheffing procurement scaffold: suppliers, purchase documents, lines, supplier references and ingredient cost audit.

create table if not exists public.cheffing_suppliers (
  id uuid primary key default gen_random_uuid(),
  trade_name text not null,
  legal_name text null,
  tax_id text null,
  normalized_tax_id text null,
  normalized_name text null,
  phone text null,
  email text null,
  address text null,
  notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cheffing_suppliers_tax_id_idx
  on public.cheffing_suppliers (normalized_tax_id)
  where normalized_tax_id is not null;

create index if not exists cheffing_suppliers_name_idx
  on public.cheffing_suppliers (normalized_name)
  where normalized_name is not null;

create table if not exists public.cheffing_purchase_documents (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid null references public.cheffing_suppliers(id) on delete set null,
  document_kind text not null,
  document_number text null,
  document_date date not null,
  document_time time without time zone null,
  effective_at timestamp without time zone null,
  storage_bucket text not null default 'cheffing-procurement-documents',
  storage_path text null,
  storage_delete_after timestamptz null,
  status text not null default 'draft',
  ocr_raw_text text null,
  interpreted_payload jsonb null,
  validation_notes text null,
  created_by text null,
  validated_by text null,
  applied_by text null,
  validated_at timestamptz null,
  applied_at timestamptz null,
  discarded_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cheffing_purchase_documents_kind_check check (document_kind in ('invoice', 'delivery_note', 'other')),
  constraint cheffing_purchase_documents_status_check check (status in ('draft', 'applied', 'discarded'))
);

create index if not exists cheffing_purchase_documents_supplier_idx
  on public.cheffing_purchase_documents (supplier_id);

create index if not exists cheffing_purchase_documents_document_date_idx
  on public.cheffing_purchase_documents (document_date desc, id desc);

create index if not exists cheffing_purchase_documents_effective_at_idx
  on public.cheffing_purchase_documents (effective_at desc, id desc);

create table if not exists public.cheffing_purchase_document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.cheffing_purchase_documents(id) on delete cascade,
  line_number integer not null default 1,
  raw_description text not null,
  raw_quantity numeric null,
  raw_unit text null,
  raw_unit_price numeric null,
  raw_line_total numeric null,
  interpreted_description text null,
  interpreted_quantity numeric null,
  interpreted_unit text null,
  normalized_quantity numeric null,
  normalized_unit_code text null,
  normalized_unit_price numeric null,
  normalized_line_total numeric null,
  suggested_ingredient_id uuid null references public.cheffing_ingredients(id) on delete set null,
  validated_ingredient_id uuid null references public.cheffing_ingredients(id) on delete set null,
  line_status text not null default 'unresolved',
  warning_notes text null,
  line_effective_at timestamp without time zone null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cheffing_purchase_document_lines_status_check check (line_status in ('unresolved', 'resolved')),
  constraint cheffing_purchase_document_lines_resolved_requires_validated_ingredient check (
    line_status <> 'resolved' or validated_ingredient_id is not null
  )
);

create index if not exists cheffing_purchase_document_lines_document_idx
  on public.cheffing_purchase_document_lines (document_id, line_number);

create index if not exists cheffing_purchase_document_lines_validated_ingredient_idx
  on public.cheffing_purchase_document_lines (validated_ingredient_id)
  where validated_ingredient_id is not null;

create table if not exists public.cheffing_supplier_product_refs (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.cheffing_suppliers(id) on delete cascade,
  supplier_product_description text not null,
  supplier_product_alias text null,
  normalized_supplier_product_name text null,
  ingredient_id uuid not null references public.cheffing_ingredients(id) on delete cascade,
  reference_unit_code text null,
  reference_format_qty numeric null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cheffing_supplier_product_refs_supplier_idx
  on public.cheffing_supplier_product_refs (supplier_id);

create index if not exists cheffing_supplier_product_refs_ingredient_idx
  on public.cheffing_supplier_product_refs (ingredient_id);

create unique index if not exists cheffing_supplier_product_refs_unique_idx
  on public.cheffing_supplier_product_refs (supplier_id, ingredient_id, normalized_supplier_product_name)
  where normalized_supplier_product_name is not null;

create table if not exists public.cheffing_ingredient_cost_audit (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.cheffing_ingredients(id) on delete restrict,
  purchase_document_id uuid not null references public.cheffing_purchase_documents(id) on delete restrict,
  purchase_document_line_id uuid not null references public.cheffing_purchase_document_lines(id) on delete restrict,
  supplier_id uuid null references public.cheffing_suppliers(id) on delete set null,
  previous_cost numeric null,
  new_cost numeric not null,
  document_effective_at timestamp without time zone not null,
  applied_by text null,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists cheffing_ingredient_cost_audit_ingredient_effective_idx
  on public.cheffing_ingredient_cost_audit (ingredient_id, document_effective_at desc, id desc);

create or replace function public.cheffing_set_purchase_document_effective_at()
returns trigger
language plpgsql
as $$
begin
  new.effective_at := new.document_date::timestamp + coalesce(new.document_time, time '00:00:00');

  return new;
end;
$$;

create or replace function public.cheffing_set_purchase_document_storage_retention()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'applied' then
    new.storage_delete_after := coalesce(new.storage_delete_after, now() + interval '7 days');
  else
    new.storage_delete_after := null;
  end if;

  return new;
end;
$$;

create or replace function public.cheffing_enforce_purchase_document_apply_ready()
returns trigger
language plpgsql
as $$
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

create or replace function public.cheffing_set_purchase_line_effective_at()
returns trigger
language plpgsql
as $$
begin
  select d.effective_at into new.line_effective_at
  from public.cheffing_purchase_documents d
  where d.id = new.document_id;

  return new;
end;
$$;

create or replace function public.cheffing_sync_purchase_lines_effective_at()
returns trigger
language plpgsql
as $$
begin
  update public.cheffing_purchase_document_lines
  set line_effective_at = new.effective_at
  where document_id = new.id;

  return new;
end;
$$;

alter table public.cheffing_suppliers enable row level security;
alter table public.cheffing_purchase_documents enable row level security;
alter table public.cheffing_purchase_document_lines enable row level security;
alter table public.cheffing_supplier_product_refs enable row level security;
alter table public.cheffing_ingredient_cost_audit enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cheffing_suppliers' and policyname = 'cheffing_suppliers_select'
  ) then
    create policy cheffing_suppliers_select
      on public.cheffing_suppliers
      for select
      using (public.cheffing_is_allowed());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cheffing_suppliers' and policyname = 'cheffing_suppliers_write'
  ) then
    create policy cheffing_suppliers_write
      on public.cheffing_suppliers
      using (public.cheffing_is_admin())
      with check (public.cheffing_is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cheffing_purchase_documents' and policyname = 'cheffing_purchase_documents_select'
  ) then
    create policy cheffing_purchase_documents_select
      on public.cheffing_purchase_documents
      for select
      using (public.cheffing_is_allowed());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cheffing_purchase_documents' and policyname = 'cheffing_purchase_documents_write'
  ) then
    create policy cheffing_purchase_documents_write
      on public.cheffing_purchase_documents
      using (public.cheffing_is_admin())
      with check (public.cheffing_is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cheffing_purchase_document_lines' and policyname = 'cheffing_purchase_document_lines_select'
  ) then
    create policy cheffing_purchase_document_lines_select
      on public.cheffing_purchase_document_lines
      for select
      using (public.cheffing_is_allowed());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cheffing_purchase_document_lines' and policyname = 'cheffing_purchase_document_lines_write'
  ) then
    create policy cheffing_purchase_document_lines_write
      on public.cheffing_purchase_document_lines
      using (public.cheffing_is_admin())
      with check (public.cheffing_is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cheffing_supplier_product_refs' and policyname = 'cheffing_supplier_product_refs_select'
  ) then
    create policy cheffing_supplier_product_refs_select
      on public.cheffing_supplier_product_refs
      for select
      using (public.cheffing_is_allowed());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cheffing_supplier_product_refs' and policyname = 'cheffing_supplier_product_refs_write'
  ) then
    create policy cheffing_supplier_product_refs_write
      on public.cheffing_supplier_product_refs
      using (public.cheffing_is_admin())
      with check (public.cheffing_is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cheffing_ingredient_cost_audit' and policyname = 'cheffing_ingredient_cost_audit_select'
  ) then
    create policy cheffing_ingredient_cost_audit_select
      on public.cheffing_ingredient_cost_audit
      for select
      using (public.cheffing_is_allowed());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cheffing_ingredient_cost_audit' and policyname = 'cheffing_ingredient_cost_audit_write'
  ) then
    create policy cheffing_ingredient_cost_audit_write
      on public.cheffing_ingredient_cost_audit
      using (public.cheffing_is_admin())
      with check (public.cheffing_is_admin());
  end if;
end $$;

drop trigger if exists set_updated_at_cheffing_suppliers on public.cheffing_suppliers;
create trigger set_updated_at_cheffing_suppliers
before update on public.cheffing_suppliers
for each row
execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_cheffing_purchase_documents on public.cheffing_purchase_documents;
create trigger set_updated_at_cheffing_purchase_documents
before update on public.cheffing_purchase_documents
for each row
execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_cheffing_purchase_document_lines on public.cheffing_purchase_document_lines;
create trigger set_updated_at_cheffing_purchase_document_lines
before update on public.cheffing_purchase_document_lines
for each row
execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_cheffing_supplier_product_refs on public.cheffing_supplier_product_refs;
create trigger set_updated_at_cheffing_supplier_product_refs
before update on public.cheffing_supplier_product_refs
for each row
execute function public.tg_set_updated_at();

drop trigger if exists set_purchase_document_effective_at on public.cheffing_purchase_documents;
create trigger set_purchase_document_effective_at
before insert or update on public.cheffing_purchase_documents
for each row
execute function public.cheffing_set_purchase_document_effective_at();

drop trigger if exists set_purchase_document_storage_retention on public.cheffing_purchase_documents;
create trigger set_purchase_document_storage_retention
before insert or update on public.cheffing_purchase_documents
for each row
execute function public.cheffing_set_purchase_document_storage_retention();

drop trigger if exists enforce_purchase_document_apply_ready on public.cheffing_purchase_documents;
create trigger enforce_purchase_document_apply_ready
before insert or update on public.cheffing_purchase_documents
for each row
execute function public.cheffing_enforce_purchase_document_apply_ready();

drop trigger if exists set_purchase_line_effective_at on public.cheffing_purchase_document_lines;
create trigger set_purchase_line_effective_at
before insert or update on public.cheffing_purchase_document_lines
for each row
execute function public.cheffing_set_purchase_line_effective_at();


drop trigger if exists sync_purchase_lines_effective_at on public.cheffing_purchase_documents;
create trigger sync_purchase_lines_effective_at
after update of effective_at on public.cheffing_purchase_documents
for each row
when (old.effective_at is distinct from new.effective_at)
execute function public.cheffing_sync_purchase_lines_effective_at();
