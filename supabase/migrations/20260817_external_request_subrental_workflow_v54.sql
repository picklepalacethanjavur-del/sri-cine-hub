-- Sri Cine Hub V5.4
-- Customer request attachments + source-aware quotation lines + booking sub-rentals

alter table public.quotation_items add column if not exists section_name text not null default 'General';
alter table public.quotation_items add column if not exists requested_description text;
alter table public.quotation_items add column if not exists source_type text not null default 'own';
alter table public.quotation_items add column if not exists supplier_name text;
alter table public.quotation_items add column if not exists supplier_cost_inr numeric not null default 0;
alter table public.quotation_items add column if not exists supplier_rate_type text not null default 'daily';
alter table public.quotation_items add column if not exists supplier_status text not null default 'not_required';
alter table public.quotation_items add column if not exists supplier_reference text;

update public.quotation_items set source_type='manual' where item_type='other' and source_type='own';
update public.quotation_items set source_type='service' where item_type='service' and source_type='own';

alter table public.quotation_items drop constraint if exists quotation_items_source_type_check;
alter table public.quotation_items add constraint quotation_items_source_type_check check (source_type in ('own','sub_rental','manual','service'));
alter table public.quotation_items drop constraint if exists quotation_items_supplier_rate_type_check;
alter table public.quotation_items add constraint quotation_items_supplier_rate_type_check check (supplier_rate_type in ('daily','weekly','flat'));
alter table public.quotation_items drop constraint if exists quotation_items_supplier_status_check;
alter table public.quotation_items add constraint quotation_items_supplier_status_check check (supplier_status in ('not_required','not_checked','requested','confirmed','received','returned','cancelled'));

create table if not exists public.quote_request_attachments (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  content_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists quote_request_attachments_request_idx on public.quote_request_attachments(quote_request_id,created_at);
alter table public.quote_request_attachments enable row level security;
drop policy if exists staff_quote_request_attachments on public.quote_request_attachments;
create policy staff_quote_request_attachments on public.quote_request_attachments for all to authenticated
using (public.current_user_role() in ('admin','staff'))
with check (public.current_user_role() in ('admin','staff'));

create table if not exists public.booking_subrentals (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  quotation_item_id uuid references public.quotation_items(id) on delete set null,
  section_name text not null default 'External Equipment',
  description text not null,
  requested_description text,
  quantity numeric not null default 1 check (quantity>0),
  rental_days numeric not null default 1 check (rental_days>0),
  supplier_name text,
  supplier_cost_inr numeric not null default 0,
  supplier_rate_type text not null default 'daily' check (supplier_rate_type in ('daily','weekly','flat')),
  customer_rate_inr numeric not null default 0,
  status text not null default 'not_checked' check (status in ('not_checked','requested','confirmed','received','returned','cancelled')),
  supplier_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists booking_subrentals_booking_idx on public.booking_subrentals(booking_id,status);
alter table public.booking_subrentals enable row level security;
drop policy if exists staff_booking_subrentals on public.booking_subrentals;
create policy staff_booking_subrentals on public.booking_subrentals for all to authenticated
using (public.current_user_role() in ('admin','staff'))
with check (public.current_user_role() in ('admin','staff'));

insert into storage.buckets(id,name,public,file_size_limit)
values('quote-request-documents','quote-request-documents',false,26214400)
on conflict(id) do update set public=false,file_size_limit=26214400;

drop policy if exists staff_request_documents_select on storage.objects;
create policy staff_request_documents_select on storage.objects for select to authenticated
using (bucket_id='quote-request-documents' and public.current_user_role() in ('admin','staff'));
drop policy if exists staff_request_documents_insert on storage.objects;
create policy staff_request_documents_insert on storage.objects for insert to authenticated
with check (bucket_id='quote-request-documents' and public.current_user_role() in ('admin','staff'));
drop policy if exists staff_request_documents_update on storage.objects;
create policy staff_request_documents_update on storage.objects for update to authenticated
using (bucket_id='quote-request-documents' and public.current_user_role() in ('admin','staff'))
with check (bucket_id='quote-request-documents' and public.current_user_role() in ('admin','staff'));
drop policy if exists staff_request_documents_delete on storage.objects;
create policy staff_request_documents_delete on storage.objects for delete to authenticated
using (bucket_id='quote-request-documents' and public.current_user_role() in ('admin','staff'));

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
    if coalesce((v_item->>'quoted_rate_inr')::numeric,0)<0 or coalesce((v_item->>'supplier_cost_inr')::numeric,0)<0 then raise exception 'Rates cannot be negative'; end if;
    if coalesce(v_item->>'source_type','') not in ('own','sub_rental','manual','service') then raise exception 'Invalid source type'; end if;
    v_subtotal:=v_subtotal+((v_item->>'quantity')::numeric*(v_item->>'rental_days')::numeric*(v_item->>'quoted_rate_inr')::numeric);
  end loop;
  v_total:=greatest(0,v_subtotal-coalesce(p_discount_inr,0)+coalesce(p_tax_inr,0)+coalesce(p_other_charges_inr,0));
  insert into public.quotations(id,quote_request_id,customer_id,status,valid_until,subtotal_inr,discount_inr,tax_inr,other_charges_inr,customer_notes,internal_notes,created_by)
  values(v_quotation_id,r.id,v_customer_id,p_status,p_valid_until,v_subtotal,coalesce(p_discount_inr,0),coalesce(p_tax_inr,0),coalesce(p_other_charges_inr,0),p_customer_notes,p_internal_notes,auth.uid())
  returning quotation_code into v_code;
  insert into public.quotation_items(quotation_id,item_type,item_id,section_name,requested_description,description,source_type,quantity,rental_days,unit_rate_inr,internal_rate_inr,supplier_name,supplier_cost_inr,supplier_rate_type,supplier_status,supplier_reference,notes,sort_order)
  select v_quotation_id,x.item_type,nullif(x.item_id,'')::uuid,coalesce(nullif(x.section_name,''),'General'),nullif(x.requested_description,''),x.description,coalesce(nullif(x.source_type,''),'manual'),x.quantity,x.rental_days,x.quoted_rate_inr,coalesce(x.internal_rate_inr,0),nullif(x.supplier_name,''),coalesce(x.supplier_cost_inr,0),coalesce(nullif(x.supplier_rate_type,''),'daily'),coalesce(nullif(x.supplier_status,''),case when x.source_type='sub_rental' then 'not_checked' else 'not_required' end),nullif(x.supplier_reference,''),nullif(x.notes,''),x.sort_order
  from jsonb_to_recordset(p_items) as x(item_type text,item_id text,section_name text,requested_description text,description text,source_type text,quantity numeric,rental_days numeric,quoted_rate_inr numeric,internal_rate_inr numeric,supplier_name text,supplier_cost_inr numeric,supplier_rate_type text,supplier_status text,supplier_reference text,notes text,sort_order integer);
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
    if coalesce((v_item->>'quoted_rate_inr')::numeric,0)<0 or coalesce((v_item->>'supplier_cost_inr')::numeric,0)<0 then raise exception 'Rates cannot be negative'; end if;
    if coalesce(v_item->>'source_type','') not in ('own','sub_rental','manual','service') then raise exception 'Invalid source type'; end if;
    v_subtotal:=v_subtotal+((v_item->>'quantity')::numeric*(v_item->>'rental_days')::numeric*(v_item->>'quoted_rate_inr')::numeric);
  end loop;
  v_total:=greatest(0,v_subtotal-coalesce(p_discount_inr,0)+coalesce(p_tax_inr,0)+coalesce(p_other_charges_inr,0));
  update public.quotations set status=p_status,subtotal_inr=v_subtotal,discount_inr=coalesce(p_discount_inr,0),tax_inr=coalesce(p_tax_inr,0),other_charges_inr=coalesce(p_other_charges_inr,0),customer_notes=p_customer_notes,internal_notes=p_internal_notes,updated_at=now() where id=p_quotation_id;
  if not found then raise exception 'Quotation not found'; end if;
  delete from public.quotation_items where quotation_id=p_quotation_id;
  insert into public.quotation_items(quotation_id,item_type,item_id,section_name,requested_description,description,source_type,quantity,rental_days,unit_rate_inr,internal_rate_inr,supplier_name,supplier_cost_inr,supplier_rate_type,supplier_status,supplier_reference,notes,sort_order)
  select p_quotation_id,x.item_type,nullif(x.item_id,'')::uuid,coalesce(nullif(x.section_name,''),'General'),nullif(x.requested_description,''),x.description,coalesce(nullif(x.source_type,''),'manual'),x.quantity,x.rental_days,x.quoted_rate_inr,coalesce(x.internal_rate_inr,0),nullif(x.supplier_name,''),coalesce(x.supplier_cost_inr,0),coalesce(nullif(x.supplier_rate_type,''),'daily'),coalesce(nullif(x.supplier_status,''),case when x.source_type='sub_rental' then 'not_checked' else 'not_required' end),nullif(x.supplier_reference,''),nullif(x.notes,''),x.sort_order
  from jsonb_to_recordset(p_items) as x(item_type text,item_id text,section_name text,requested_description text,description text,source_type text,quantity numeric,rental_days numeric,quoted_rate_inr numeric,internal_rate_inr numeric,supplier_name text,supplier_cost_inr numeric,supplier_rate_type text,supplier_status text,supplier_reference text,notes text,sort_order integer);
  return jsonb_build_object('quotation_id',p_quotation_id,'subtotal_inr',v_subtotal,'total_inr',v_total,'item_count',jsonb_array_length(p_items),'status',p_status);
end $$;

create or replace function public.convert_quotation_to_booking_atomic(p_quotation_id uuid)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare
  q public.quotations%rowtype; r public.quote_requests%rowtype;
  v_booking_id uuid:=gen_random_uuid();
  v_booking_code text:='BK-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_role public.user_role; rec record;
  v_camera_charge numeric:=0; v_accessory_charge numeric:=0; v_other_charge numeric:=0;
begin
  v_role:=public.current_user_role();
  if v_role not in ('admin','staff') then raise exception 'Staff access required'; end if;
  select * into q from public.quotations where id=p_quotation_id for update;
  if not found then raise exception 'Quotation not found'; end if;
  if q.status<>'accepted' then raise exception 'Quotation must be Accepted before conversion'; end if;
  if q.quote_request_id is null then raise exception 'Quotation has no linked quote request'; end if;
  select * into r from public.quote_requests where id=q.quote_request_id for update;
  if not found then raise exception 'Quote request not found'; end if;
  if r.converted_booking_id is not null then raise exception 'Quote request is already converted'; end if;

  create temporary table tmp_q_cameras(camera_id uuid primary key,daily_rate numeric) on commit drop;
  create temporary table tmp_q_accessories(accessory_id uuid primary key,quantity integer,daily_rate numeric) on commit drop;
  insert into tmp_q_cameras(camera_id,daily_rate)
    select item_id,max(unit_rate_inr) from public.quotation_items where quotation_id=q.id and item_type='camera' and source_type='own' and item_id is not null group by item_id;
  insert into tmp_q_accessories(accessory_id,quantity,daily_rate)
    select item_id,greatest(1,round(sum(quantity))::int),max(unit_rate_inr) from public.quotation_items where quotation_id=q.id and item_type='accessory' and source_type='own' and item_id is not null group by item_id;
  insert into tmp_q_cameras(camera_id,daily_rate)
    select distinct eki.camera_id,0 from public.quotation_items qi join public.equipment_kit_items eki on eki.kit_id=qi.item_id where qi.quotation_id=q.id and qi.item_type='kit' and qi.source_type='own' and eki.camera_id is not null on conflict(camera_id) do nothing;
  insert into tmp_q_accessories(accessory_id,quantity,daily_rate)
    select eki.accessory_id,sum(greatest(1,eki.quantity))::int,0 from public.quotation_items qi join public.equipment_kit_items eki on eki.kit_id=qi.item_id where qi.quotation_id=q.id and qi.item_type='kit' and qi.source_type='own' and eki.accessory_id is not null group by eki.accessory_id on conflict(accessory_id) do update set quantity=greatest(tmp_q_accessories.quantity,excluded.quantity);
  for rec in select camera_id from tmp_q_cameras loop
    if not public.camera_is_available(rec.camera_id,r.start_at,r.end_at,null) then raise exception 'Camera unavailable for selected dates: %',rec.camera_id; end if;
  end loop;
  for rec in select accessory_id from tmp_q_accessories loop
    if not public.accessory_is_available(rec.accessory_id,r.start_at,r.end_at,null) then raise exception 'Accessory unavailable for selected dates: %',rec.accessory_id; end if;
  end loop;

  select coalesce(sum(quantity*rental_days*unit_rate_inr),0) into v_camera_charge from public.quotation_items where quotation_id=q.id and item_type='camera' and source_type='own';
  select coalesce(sum(quantity*rental_days*unit_rate_inr),0) into v_accessory_charge from public.quotation_items where quotation_id=q.id and item_type='accessory' and source_type='own';
  select coalesce(sum(quantity*rental_days*unit_rate_inr),0)+coalesce(q.tax_inr,0)+coalesce(q.other_charges_inr,0) into v_other_charge from public.quotation_items where quotation_id=q.id and not (source_type='own' and item_type in ('camera','accessory'));

  insert into public.bookings(id,booking_code,customer_id,status,project_name,production_name,contact_name,contact_phone,start_at,end_at,camera_charge_inr,accessories_charge_inr,other_charges_inr,discount_inr,notes,created_by)
  values(v_booking_id,v_booking_code,q.customer_id,'reserved',r.project_name,r.company_name,r.name,r.phone,r.start_at,r.end_at,v_camera_charge,v_accessory_charge,v_other_charge,coalesce(q.discount_inr,0),q.customer_notes,auth.uid());
  insert into public.booking_cameras(booking_id,camera_id,daily_rate_inr) select v_booking_id,camera_id,daily_rate from tmp_q_cameras;
  insert into public.booking_accessories(booking_id,accessory_id,quantity,daily_rate_inr) select v_booking_id,accessory_id,quantity,daily_rate from tmp_q_accessories;
  insert into public.booking_subrentals(booking_id,quotation_item_id,section_name,description,requested_description,quantity,rental_days,supplier_name,supplier_cost_inr,supplier_rate_type,customer_rate_inr,status,supplier_reference,notes)
  select v_booking_id,qi.id,qi.section_name,qi.description,qi.requested_description,qi.quantity,qi.rental_days,qi.supplier_name,qi.supplier_cost_inr,qi.supplier_rate_type,qi.unit_rate_inr,
    case when qi.supplier_status in ('requested','confirmed','received','returned','cancelled') then qi.supplier_status else 'not_checked' end,qi.supplier_reference,qi.notes
  from public.quotation_items qi where qi.quotation_id=q.id and qi.source_type='sub_rental';

  update public.quotations set status='converted',updated_at=now() where id=q.id;
  update public.quote_requests set status='converted',converted_booking_id=v_booking_id,updated_at=now() where id=r.id;
  return jsonb_build_object('booking_id',v_booking_id,'booking_code',v_booking_code,'quoted_total_inr',(select quoted_total_inr from public.bookings where id=v_booking_id),'camera_count',(select count(*) from tmp_q_cameras),'accessory_count',(select count(*) from tmp_q_accessories),'sub_rental_count',(select count(*) from public.booking_subrentals where booking_id=v_booking_id));
end $$;
