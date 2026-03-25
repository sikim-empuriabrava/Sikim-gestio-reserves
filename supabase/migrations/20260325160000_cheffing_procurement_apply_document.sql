create or replace function public.cheffing_apply_purchase_document(
  p_document_id uuid,
  p_applied_by text default null
)
returns table(applied_lines integer, updated_ingredients integer)
language plpgsql
as $$
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
