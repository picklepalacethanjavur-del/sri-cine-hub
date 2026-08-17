-- V6 QA fix: tolerate omitted sort_order in permissive draft/item payloads.
create or replace function public.create_quotation_atomic(
  p_quote_request_id uuid,p_status text,p_valid_until date,p_discount_inr numeric,
  p_tax_inr numeric,p_other_charges_inr numeric,p_customer_notes text,
  p_internal_notes text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path='public' as $$
declare
  r public.quote_requests%rowtype; v_customer_id uuid; v_quotation_id uuid:=gen_random_uuid();
  v_subtotal numeric:=0; v_total numeric:=0; v_item jsonb; v_role public.user_role; v_code text; v_items jsonb:=coalesce(p_items,'[]'::jsonb);
begin
  v_role:=public.current_user_role(); if v_role not in ('admin','staff') then raise exception 'Staff access required'; end if;
  if p_status not in ('draft','generated','sent') then raise exception 'Invalid quotation status'; end if;
  select * into r from public.quote_requests where id=p_quote_request_id for update; if not found then raise exception 'Quote request not found'; end if;
  if nullif(trim(coalesce(r.phone,'')),'') is not null then
    select id into v_customer_id from public.customers where phone=r.phone order by created_at limit 1;
    if v_customer_id is null and nullif(trim(coalesce(r.name,'')),'') is not null then insert into public.customers(name,company_name,phone,whatsapp,email) values(r.name,r.company_name,r.phone,r.whatsapp,r.email) returning id into v_customer_id; end if;
  end if;
  if jsonb_typeof(v_items)<>'array' then raise exception 'Items must be an array'; end if;
  for v_item in select value from jsonb_array_elements(v_items) loop
    if coalesce((v_item->>'quantity')::numeric,0)<0 or coalesce((v_item->>'rental_days')::numeric,0)<0 then raise exception 'Quantity and days cannot be negative'; end if;
    if coalesce((v_item->>'quoted_rate_inr')::numeric,0)<0 or coalesce((v_item->>'cost_rate_inr')::numeric,0)<0 then raise exception 'Rates cannot be negative'; end if;
    v_subtotal:=v_subtotal+(coalesce((v_item->>'quantity')::numeric,0)*coalesce((v_item->>'rental_days')::numeric,0)*coalesce((v_item->>'quoted_rate_inr')::numeric,0));
  end loop;
  v_total:=greatest(0,v_subtotal-coalesce(p_discount_inr,0)+coalesce(p_tax_inr,0)+coalesce(p_other_charges_inr,0));
  insert into public.quotations(id,quote_request_id,customer_id,status,valid_until,subtotal_inr,discount_inr,tax_inr,other_charges_inr,customer_notes,internal_notes,created_by)
  values(v_quotation_id,r.id,v_customer_id,p_status,p_valid_until,v_subtotal,coalesce(p_discount_inr,0),coalesce(p_tax_inr,0),coalesce(p_other_charges_inr,0),p_customer_notes,p_internal_notes,auth.uid()) returning quotation_code into v_code;
  if jsonb_array_length(v_items)>0 then
    insert into public.quotation_items(quotation_id,item_type,item_id,request_item_id,catalog_item_id,section_name,requested_description,description,source_type,quantity,rental_days,unit_rate_inr,internal_rate_inr,cost_rate_inr,cost_rate_basis,supplier_id,supplier_catalog_item_id,supplier_name,supplier_cost_inr,supplier_rate_type,supplier_status,supplier_reference,notes,sort_order)
    select v_quotation_id,coalesce(nullif(x.item_type,''),'other'),nullif(x.item_id,'')::uuid,nullif(x.request_item_id,'')::uuid,nullif(x.catalog_item_id,'')::uuid,coalesce(nullif(x.section_name,''),'General'),nullif(x.requested_description,''),coalesce(x.description,''),coalesce(nullif(x.source_type,''),'manual'),greatest(coalesce(x.quantity,0),0),greatest(coalesce(x.rental_days,0),0),greatest(coalesce(x.quoted_rate_inr,0),0),greatest(coalesce(x.internal_rate_inr,0),0),greatest(coalesce(x.cost_rate_inr,0),0),coalesce(nullif(x.cost_rate_basis,''),'daily'),nullif(x.supplier_id,'')::uuid,nullif(x.supplier_catalog_item_id,'')::uuid,nullif(x.supplier_name,''),greatest(coalesce(x.cost_rate_inr,0),0),case when coalesce(nullif(x.cost_rate_basis,''),'daily') in ('daily','weekly','flat') then coalesce(nullif(x.cost_rate_basis,''),'daily') else 'daily' end,case when x.source_type='supplier' then 'not_checked' else 'not_required' end,nullif(x.supplier_reference,''),nullif(x.notes,''),coalesce(x.sort_order,0)
    from jsonb_to_recordset(v_items) as x(item_type text,item_id text,request_item_id text,catalog_item_id text,section_name text,requested_description text,description text,source_type text,quantity numeric,rental_days numeric,quoted_rate_inr numeric,internal_rate_inr numeric,cost_rate_inr numeric,cost_rate_basis text,supplier_id text,supplier_catalog_item_id text,supplier_name text,supplier_reference text,notes text,sort_order integer);
  end if;
  update public.quote_requests set status=case when p_status in ('generated','sent') then 'quoted' else 'reviewing' end,updated_at=now() where id=r.id;
  if p_status='generated' then insert into public.quotation_revisions(quotation_id,revision_no,status,snapshot,created_by) values(v_quotation_id,1,'generated',jsonb_build_object('quotation_code',v_code,'total_inr',v_total,'items',v_items),auth.uid()); end if;
  return jsonb_build_object('quotation_id',v_quotation_id,'quotation_code',v_code,'subtotal_inr',v_subtotal,'total_inr',v_total,'status',p_status);
end $$;

create or replace function public.save_quotation_atomic(
  p_quotation_id uuid,p_status text,p_discount_inr numeric,p_tax_inr numeric,
  p_other_charges_inr numeric,p_customer_notes text,p_internal_notes text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_subtotal numeric:=0; v_total numeric:=0; v_item jsonb; v_role public.user_role; v_items jsonb:=coalesce(p_items,'[]'::jsonb); v_rev integer;
begin
  v_role:=public.current_user_role(); if v_role not in ('admin','staff') then raise exception 'Staff access required'; end if; if p_status not in ('draft','generated','sent','accepted','declined','expired','converted') then raise exception 'Invalid quotation status'; end if; if jsonb_typeof(v_items)<>'array' then raise exception 'Items must be an array'; end if;
  for v_item in select value from jsonb_array_elements(v_items) loop if coalesce((v_item->>'quantity')::numeric,0)<0 or coalesce((v_item->>'rental_days')::numeric,0)<0 then raise exception 'Quantity and days cannot be negative'; end if; if coalesce((v_item->>'quoted_rate_inr')::numeric,0)<0 or coalesce((v_item->>'cost_rate_inr')::numeric,0)<0 then raise exception 'Rates cannot be negative'; end if; v_subtotal:=v_subtotal+(coalesce((v_item->>'quantity')::numeric,0)*coalesce((v_item->>'rental_days')::numeric,0)*coalesce((v_item->>'quoted_rate_inr')::numeric,0)); end loop;
  v_total:=greatest(0,v_subtotal-coalesce(p_discount_inr,0)+coalesce(p_tax_inr,0)+coalesce(p_other_charges_inr,0));
  update public.quotations set status=p_status,subtotal_inr=v_subtotal,discount_inr=coalesce(p_discount_inr,0),tax_inr=coalesce(p_tax_inr,0),other_charges_inr=coalesce(p_other_charges_inr,0),customer_notes=p_customer_notes,internal_notes=p_internal_notes,updated_at=now() where id=p_quotation_id; if not found then raise exception 'Quotation not found'; end if; delete from public.quotation_items where quotation_id=p_quotation_id;
  if jsonb_array_length(v_items)>0 then
    insert into public.quotation_items(quotation_id,item_type,item_id,request_item_id,catalog_item_id,section_name,requested_description,description,source_type,quantity,rental_days,unit_rate_inr,internal_rate_inr,cost_rate_inr,cost_rate_basis,supplier_id,supplier_catalog_item_id,supplier_name,supplier_cost_inr,supplier_rate_type,supplier_status,supplier_reference,notes,sort_order)
    select p_quotation_id,coalesce(nullif(x.item_type,''),'other'),nullif(x.item_id,'')::uuid,nullif(x.request_item_id,'')::uuid,nullif(x.catalog_item_id,'')::uuid,coalesce(nullif(x.section_name,''),'General'),nullif(x.requested_description,''),coalesce(x.description,''),coalesce(nullif(x.source_type,''),'manual'),greatest(coalesce(x.quantity,0),0),greatest(coalesce(x.rental_days,0),0),greatest(coalesce(x.quoted_rate_inr,0),0),greatest(coalesce(x.internal_rate_inr,0),0),greatest(coalesce(x.cost_rate_inr,0),0),coalesce(nullif(x.cost_rate_basis,''),'daily'),nullif(x.supplier_id,'')::uuid,nullif(x.supplier_catalog_item_id,'')::uuid,nullif(x.supplier_name,''),greatest(coalesce(x.cost_rate_inr,0),0),case when coalesce(nullif(x.cost_rate_basis,''),'daily') in ('daily','weekly','flat') then coalesce(nullif(x.cost_rate_basis,''),'daily') else 'daily' end,case when x.source_type='supplier' then coalesce(nullif(x.supplier_status,''),'not_checked') else 'not_required' end,nullif(x.supplier_reference,''),nullif(x.notes,''),coalesce(x.sort_order,0)
    from jsonb_to_recordset(v_items) as x(item_type text,item_id text,request_item_id text,catalog_item_id text,section_name text,requested_description text,description text,source_type text,quantity numeric,rental_days numeric,quoted_rate_inr numeric,internal_rate_inr numeric,cost_rate_inr numeric,cost_rate_basis text,supplier_id text,supplier_catalog_item_id text,supplier_name text,supplier_status text,supplier_reference text,notes text,sort_order integer);
  end if;
  if p_status='generated' then select coalesce(max(revision_no),0)+1 into v_rev from public.quotation_revisions where quotation_id=p_quotation_id; insert into public.quotation_revisions(quotation_id,revision_no,status,snapshot,created_by) values(p_quotation_id,v_rev,'generated',jsonb_build_object('total_inr',v_total,'items',v_items),auth.uid()); end if;
  return jsonb_build_object('quotation_id',p_quotation_id,'subtotal_inr',v_subtotal,'total_inr',v_total,'item_count',jsonb_array_length(v_items),'status',p_status);
end $$;
