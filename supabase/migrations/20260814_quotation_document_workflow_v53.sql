-- Sri Cine Hub V5.3 quotation document workflow
alter table public.quotations drop constraint if exists quotations_status_check;
alter table public.quotations add constraint quotations_status_check
check (status in ('draft','generated','sent','accepted','declined','expired','converted'));

create or replace function public.create_quotation_atomic(
  p_quote_request_id uuid,p_status text,p_valid_until date,p_discount_inr numeric,
  p_tax_inr numeric,p_other_charges_inr numeric,p_customer_notes text,
  p_internal_notes text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path='public' as $$
declare
  r public.quote_requests%rowtype; v_customer_id uuid; v_quotation_id uuid:=gen_random_uuid();
  v_subtotal numeric:=0; v_total numeric:=0; v_item jsonb; v_role public.user_role; v_code text;
begin
  v_role:=public.current_user_role();
  if v_role not in ('admin','staff') then raise exception 'Staff access required'; end if;
  if p_status not in ('draft','generated','sent') then raise exception 'New quotation must be Draft, Generated or Sent'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one quotation item is required'; end if;
  select * into r from public.quote_requests where id=p_quote_request_id for update;
  if not found then raise exception 'Quote request not found'; end if;
  select id into v_customer_id from public.customers where phone=r.phone order by created_at limit 1;
  if v_customer_id is null then
    insert into public.customers(name,company_name,phone,whatsapp,email)
    values(r.name,r.company_name,r.phone,r.whatsapp,r.email) returning id into v_customer_id;
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce((v_item->>'quantity')::numeric,0)<=0 or coalesce((v_item->>'rental_days')::numeric,0)<=0 then raise exception 'Quantity and rental days must be greater than zero'; end if;
    if coalesce((v_item->>'quoted_rate_inr')::numeric,0)<0 then raise exception 'Quote rate cannot be negative'; end if;
    v_subtotal:=v_subtotal+((v_item->>'quantity')::numeric*(v_item->>'rental_days')::numeric*(v_item->>'quoted_rate_inr')::numeric);
  end loop;
  v_total:=greatest(0,v_subtotal-coalesce(p_discount_inr,0)+coalesce(p_tax_inr,0)+coalesce(p_other_charges_inr,0));
  insert into public.quotations(id,quote_request_id,customer_id,status,valid_until,subtotal_inr,discount_inr,tax_inr,other_charges_inr,customer_notes,internal_notes,created_by)
  values(v_quotation_id,r.id,v_customer_id,p_status,p_valid_until,v_subtotal,coalesce(p_discount_inr,0),coalesce(p_tax_inr,0),coalesce(p_other_charges_inr,0),p_customer_notes,p_internal_notes,auth.uid())
  returning quotation_code into v_code;
  insert into public.quotation_items(quotation_id,item_type,item_id,description,quantity,rental_days,unit_rate_inr,internal_rate_inr,notes,sort_order)
  select v_quotation_id,x.item_type,nullif(x.item_id,'')::uuid,x.description,x.quantity,x.rental_days,x.quoted_rate_inr,x.internal_rate_inr,nullif(x.notes,''),x.sort_order
  from jsonb_to_recordset(p_items) as x(item_type text,item_id text,description text,quantity numeric,rental_days numeric,quoted_rate_inr numeric,internal_rate_inr numeric,notes text,sort_order integer);
  update public.quote_requests set status=case when p_status in ('generated','sent') then 'quoted' else 'reviewing' end,updated_at=now() where id=r.id;
  return jsonb_build_object('quotation_id',v_quotation_id,'quotation_code',v_code,'subtotal_inr',v_subtotal,'total_inr',v_total,'status',p_status);
end $$;

create or replace function public.save_quotation_atomic(
  p_quotation_id uuid,p_status text,p_discount_inr numeric,p_tax_inr numeric,
  p_other_charges_inr numeric,p_customer_notes text,p_internal_notes text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_subtotal numeric:=0; v_total numeric:=0; v_item jsonb; v_role public.user_role;
begin
  v_role:=public.current_user_role();
  if v_role not in ('admin','staff') then raise exception 'Staff access required'; end if;
  if p_status not in ('draft','generated','sent','accepted','declined','expired','converted') then raise exception 'Invalid quotation status'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one quotation item is required'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce((v_item->>'quantity')::numeric,0)<=0 or coalesce((v_item->>'rental_days')::numeric,0)<=0 then raise exception 'Quantity and rental days must be greater than zero'; end if;
    if coalesce((v_item->>'quoted_rate_inr')::numeric,0)<0 then raise exception 'Quote rate cannot be negative'; end if;
    v_subtotal:=v_subtotal+((v_item->>'quantity')::numeric*(v_item->>'rental_days')::numeric*(v_item->>'quoted_rate_inr')::numeric);
  end loop;
  v_total:=greatest(0,v_subtotal-coalesce(p_discount_inr,0)+coalesce(p_tax_inr,0)+coalesce(p_other_charges_inr,0));
  update public.quotations set status=p_status,subtotal_inr=v_subtotal,discount_inr=coalesce(p_discount_inr,0),
    tax_inr=coalesce(p_tax_inr,0),other_charges_inr=coalesce(p_other_charges_inr,0),
    customer_notes=p_customer_notes,internal_notes=p_internal_notes,updated_at=now()
    where id=p_quotation_id;
  if not found then raise exception 'Quotation not found'; end if;
  delete from public.quotation_items where quotation_id=p_quotation_id;
  insert into public.quotation_items(quotation_id,item_type,item_id,description,quantity,rental_days,unit_rate_inr,internal_rate_inr,notes,sort_order)
  select p_quotation_id,x.item_type,nullif(x.item_id,'')::uuid,x.description,x.quantity,x.rental_days,x.quoted_rate_inr,x.internal_rate_inr,nullif(x.notes,''),x.sort_order
  from jsonb_to_recordset(p_items) as x(item_type text,item_id text,description text,quantity numeric,rental_days numeric,quoted_rate_inr numeric,internal_rate_inr numeric,notes text,sort_order integer);
  return jsonb_build_object('quotation_id',p_quotation_id,'subtotal_inr',v_subtotal,'total_inr',v_total,'item_count',jsonb_array_length(p_items),'status',p_status);
end $$;

create or replace function public.set_quotation_status(p_quotation_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare q public.quotations%rowtype; v_role public.user_role;
begin
  v_role:=public.current_user_role();
  if v_role not in ('admin','staff') then raise exception 'Staff access required'; end if;
  if p_status not in ('generated','sent','accepted','declined','expired') then raise exception 'Invalid quotation status transition'; end if;
  select * into q from public.quotations where id=p_quotation_id for update;
  if not found then raise exception 'Quotation not found'; end if;
  if q.status='converted' then raise exception 'Converted quotation cannot be changed'; end if;
  update public.quotations set status=p_status,updated_at=now() where id=q.id;
  if q.quote_request_id is not null then
    update public.quote_requests set status=case when p_status in ('declined','expired') then 'closed' else 'quoted' end,updated_at=now()
    where id=q.quote_request_id;
  end if;
  return jsonb_build_object('quotation_id',q.id,'status',p_status);
end $$;
revoke all on function public.set_quotation_status(uuid,text) from public;
grant execute on function public.set_quotation_status(uuid,text) to authenticated;
