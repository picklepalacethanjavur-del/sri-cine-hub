-- Sri Cine Hub V6 foundation
-- Supplier network + master equipment catalog + flexible quote requests + supplier RFQs

-- 1) Master equipment catalog: canonical 'what is this item?' layer.
create table if not exists public.master_equipment_catalog (
  id uuid primary key default gen_random_uuid(),
  catalog_code text not null unique default ('EQ-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  canonical_name text not null,
  category text not null default 'Other',
  manufacturer text,
  model text,
  description text,
  aliases text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists master_equipment_catalog_name_category_uq
  on public.master_equipment_catalog(lower(canonical_name),lower(category));
alter table public.master_equipment_catalog enable row level security;
drop policy if exists staff_master_equipment_catalog on public.master_equipment_catalog;
create policy staff_master_equipment_catalog on public.master_equipment_catalog for all to authenticated
using (public.current_user_role() in ('admin','staff'))
with check (public.current_user_role() in ('admin','staff'));

-- Link owned physical assets to the canonical catalog when possible.
alter table public.cameras add column if not exists catalog_item_id uuid references public.master_equipment_catalog(id) on delete set null;
alter table public.accessories add column if not exists catalog_item_id uuid references public.master_equipment_catalog(id) on delete set null;

-- Seed catalog from Sri Cine Hub inventory without changing physical asset rows.
insert into public.master_equipment_catalog(canonical_name,category,manufacturer,model)
select distinct c.name,'Camera',c.manufacturer,c.model from public.cameras c
where nullif(trim(c.name),'') is not null
on conflict do nothing;
insert into public.master_equipment_catalog(canonical_name,category)
select distinct a.name,coalesce(nullif(trim(a.category),''),'Accessories') from public.accessories a
where nullif(trim(a.name),'') is not null
on conflict do nothing;

update public.cameras c set catalog_item_id=m.id
from public.master_equipment_catalog m
where c.catalog_item_id is null and lower(m.canonical_name)=lower(c.name) and lower(m.category)='camera';
update public.accessories a set catalog_item_id=m.id
from public.master_equipment_catalog m
where a.catalog_item_id is null and lower(m.canonical_name)=lower(a.name)
  and lower(m.category)=lower(coalesce(nullif(trim(a.category),''),'Accessories'));

-- 2) Supplier master + reusable supplier catalog.
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_code text not null unique default ('SUP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  company_name text not null,
  contact_name text,
  phone text,
  whatsapp text,
  email text,
  city text,
  state text,
  address text,
  gstin text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists suppliers_company_idx on public.suppliers(lower(company_name));
alter table public.suppliers enable row level security;
drop policy if exists staff_suppliers on public.suppliers;
create policy staff_suppliers on public.suppliers for all to authenticated
using (public.current_user_role() in ('admin','staff'))
with check (public.current_user_role() in ('admin','staff'));

create table if not exists public.supplier_catalog_items (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  catalog_item_id uuid references public.master_equipment_catalog(id) on delete set null,
  supplier_item_name text not null,
  category text not null default 'Other',
  quantity_available numeric not null default 1,
  default_cost_inr numeric not null default 0,
  rate_basis text not null default 'daily' check (rate_basis in ('hourly','daily','weekly','flat')),
  location text,
  availability_notes text,
  supplier_notes text,
  is_active boolean not null default true,
  last_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists supplier_catalog_supplier_idx on public.supplier_catalog_items(supplier_id,is_active);
create index if not exists supplier_catalog_catalog_idx on public.supplier_catalog_items(catalog_item_id);
alter table public.supplier_catalog_items enable row level security;
drop policy if exists staff_supplier_catalog_items on public.supplier_catalog_items;
create policy staff_supplier_catalog_items on public.supplier_catalog_items for all to authenticated
using (public.current_user_role() in ('admin','staff'))
with check (public.current_user_role() in ('admin','staff'));

-- 3) Requests become permissive workspaces. Fields can be filled later.
alter table public.quote_requests alter column name drop not null;
alter table public.quote_requests alter column phone drop not null;
alter table public.quote_requests alter column start_at drop not null;
alter table public.quote_requests alter column end_at drop not null;
alter table public.quote_requests drop constraint if exists quote_requests_check;
alter table public.quote_requests add constraint quote_requests_dates_check
  check (start_at is null or end_at is null or end_at > start_at);

create table if not exists public.quote_request_items (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  section_name text not null default 'General',
  requested_description text not null default '',
  catalog_item_id uuid references public.master_equipment_catalog(id) on delete set null,
  quantity numeric not null default 1,
  requested_days numeric,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_request_items_request_idx on public.quote_request_items(quote_request_id,sort_order);
alter table public.quote_request_items enable row level security;
drop policy if exists staff_quote_request_items on public.quote_request_items;
create policy staff_quote_request_items on public.quote_request_items for all to authenticated
using (public.current_user_role() in ('admin','staff'))
with check (public.current_user_role() in ('admin','staff'));

-- 4) Normalize quote lines around sourcing rather than assuming inventory.
alter table public.quotation_items drop constraint if exists quotation_items_source_type_check;
update public.quotation_items set source_type='supplier' where source_type='sub_rental';
alter table public.quotation_items add constraint quotation_items_source_type_check
  check (source_type in ('own','supplier','manual','service'));
alter table public.quotation_items add column if not exists request_item_id uuid references public.quote_request_items(id) on delete set null;
alter table public.quotation_items add column if not exists catalog_item_id uuid references public.master_equipment_catalog(id) on delete set null;
alter table public.quotation_items add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.quotation_items add column if not exists supplier_catalog_item_id uuid references public.supplier_catalog_items(id) on delete set null;
alter table public.quotation_items add column if not exists cost_rate_inr numeric not null default 0;
alter table public.quotation_items add column if not exists cost_rate_basis text not null default 'daily';
alter table public.quotation_items drop constraint if exists quotation_items_cost_rate_basis_check;
alter table public.quotation_items add constraint quotation_items_cost_rate_basis_check
  check (cost_rate_basis in ('hourly','daily','weekly','flat'));

-- Keep old supplier fields in sync for compatibility with existing sub-rental screens.
update public.quotation_items set cost_rate_inr=supplier_cost_inr where cost_rate_inr=0 and supplier_cost_inr>0;
update public.quotation_items set cost_rate_basis=supplier_rate_type where cost_rate_basis='daily' and supplier_rate_type in ('daily','weekly','flat');

-- Quotation document revisions / immutable sent snapshots.
create table if not exists public.quotation_revisions (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  revision_no integer not null,
  status text not null default 'generated',
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(quotation_id,revision_no)
);
alter table public.quotation_revisions enable row level security;
drop policy if exists staff_quotation_revisions on public.quotation_revisions;
create policy staff_quotation_revisions on public.quotation_revisions for all to authenticated
using (public.current_user_role() in ('admin','staff'))
with check (public.current_user_role() in ('admin','staff'));

-- 5) Supplier RFQ workflow.
create table if not exists public.supplier_rfqs (
  id uuid primary key default gen_random_uuid(),
  rfq_code text not null unique default ('RFQ-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  quote_request_id uuid references public.quote_requests(id) on delete set null,
  quotation_id uuid references public.quotations(id) on delete set null,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','generated','sent','quote_received','confirmed','declined','closed')),
  project_name text,
  start_at timestamptz,
  end_at timestamptz,
  supplier_notes text,
  internal_notes text,
  response_reference text,
  response_total_inr numeric,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists supplier_rfqs_supplier_idx on public.supplier_rfqs(supplier_id,status,created_at desc);
alter table public.supplier_rfqs enable row level security;
drop policy if exists staff_supplier_rfqs on public.supplier_rfqs;
create policy staff_supplier_rfqs on public.supplier_rfqs for all to authenticated
using (public.current_user_role() in ('admin','staff'))
with check (public.current_user_role() in ('admin','staff'));

create table if not exists public.supplier_rfq_items (
  id uuid primary key default gen_random_uuid(),
  supplier_rfq_id uuid not null references public.supplier_rfqs(id) on delete cascade,
  quote_request_item_id uuid references public.quote_request_items(id) on delete set null,
  supplier_catalog_item_id uuid references public.supplier_catalog_items(id) on delete set null,
  catalog_item_id uuid references public.master_equipment_catalog(id) on delete set null,
  section_name text not null default 'General',
  description text not null default '',
  quantity numeric not null default 1,
  rental_days numeric not null default 1,
  supplier_quoted_rate_inr numeric not null default 0,
  rate_basis text not null default 'daily' check (rate_basis in ('hourly','daily','weekly','flat')),
  availability_status text not null default 'unknown' check (availability_status in ('unknown','available','partial','unavailable')),
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.supplier_rfq_items enable row level security;
drop policy if exists staff_supplier_rfq_items on public.supplier_rfq_items;
create policy staff_supplier_rfq_items on public.supplier_rfq_items for all to authenticated
using (public.current_user_role() in ('admin','staff'))
with check (public.current_user_role() in ('admin','staff'));

-- Supplier response attachments (supplier's PDF/photo received manually for now).
create table if not exists public.supplier_rfq_attachments (
  id uuid primary key default gen_random_uuid(),
  supplier_rfq_id uuid not null references public.supplier_rfqs(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  content_type text,
  file_size bigint,
  attachment_type text not null default 'response' check (attachment_type in ('request','response','other')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.supplier_rfq_attachments enable row level security;
drop policy if exists staff_supplier_rfq_attachments on public.supplier_rfq_attachments;
create policy staff_supplier_rfq_attachments on public.supplier_rfq_attachments for all to authenticated
using (public.current_user_role() in ('admin','staff'))
with check (public.current_user_role() in ('admin','staff'));

insert into storage.buckets(id,name,public,file_size_limit)
values('supplier-rfq-documents','supplier-rfq-documents',false,26214400)
on conflict(id) do update set public=false,file_size_limit=26214400;

drop policy if exists staff_supplier_rfq_documents_select on storage.objects;
create policy staff_supplier_rfq_documents_select on storage.objects for select to authenticated
using (bucket_id='supplier-rfq-documents' and public.current_user_role() in ('admin','staff'));
drop policy if exists staff_supplier_rfq_documents_insert on storage.objects;
create policy staff_supplier_rfq_documents_insert on storage.objects for insert to authenticated
with check (bucket_id='supplier-rfq-documents' and public.current_user_role() in ('admin','staff'));
drop policy if exists staff_supplier_rfq_documents_delete on storage.objects;
create policy staff_supplier_rfq_documents_delete on storage.objects for delete to authenticated
using (bucket_id='supplier-rfq-documents' and public.current_user_role() in ('admin','staff'));

-- 6) Flexible V6 quote RPCs. Drafts may be empty/incomplete.
create or replace function public.create_quotation_atomic(
  p_quote_request_id uuid,p_status text,p_valid_until date,p_discount_inr numeric,
  p_tax_inr numeric,p_other_charges_inr numeric,p_customer_notes text,
  p_internal_notes text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path='public' as $$
declare
  r public.quote_requests%rowtype; v_customer_id uuid; v_quotation_id uuid:=gen_random_uuid();
  v_subtotal numeric:=0; v_total numeric:=0; v_item jsonb; v_role public.user_role; v_code text; v_items jsonb:=coalesce(p_items,'[]'::jsonb);
begin
  v_role:=public.current_user_role();
  if v_role not in ('admin','staff') then raise exception 'Staff access required'; end if;
  if p_status not in ('draft','generated','sent') then raise exception 'Invalid quotation status'; end if;
  select * into r from public.quote_requests where id=p_quote_request_id for update;
  if not found then raise exception 'Quote request not found'; end if;

  if nullif(trim(coalesce(r.phone,'')),'') is not null then
    select id into v_customer_id from public.customers where phone=r.phone order by created_at limit 1;
    if v_customer_id is null and nullif(trim(coalesce(r.name,'')),'') is not null then
      insert into public.customers(name,company_name,phone,whatsapp,email)
      values(r.name,r.company_name,r.phone,r.whatsapp,r.email) returning id into v_customer_id;
    end if;
  end if;

  if jsonb_typeof(v_items)<>'array' then raise exception 'Items must be an array'; end if;
  for v_item in select value from jsonb_array_elements(v_items) loop
    if coalesce((v_item->>'quantity')::numeric,0)<0 or coalesce((v_item->>'rental_days')::numeric,0)<0 then raise exception 'Quantity and days cannot be negative'; end if;
    if coalesce((v_item->>'quoted_rate_inr')::numeric,0)<0 or coalesce((v_item->>'cost_rate_inr')::numeric,0)<0 then raise exception 'Rates cannot be negative'; end if;
    v_subtotal:=v_subtotal+(coalesce((v_item->>'quantity')::numeric,0)*coalesce((v_item->>'rental_days')::numeric,0)*coalesce((v_item->>'quoted_rate_inr')::numeric,0));
  end loop;
  v_total:=greatest(0,v_subtotal-coalesce(p_discount_inr,0)+coalesce(p_tax_inr,0)+coalesce(p_other_charges_inr,0));

  insert into public.quotations(id,quote_request_id,customer_id,status,valid_until,subtotal_inr,discount_inr,tax_inr,other_charges_inr,customer_notes,internal_notes,created_by)
  values(v_quotation_id,r.id,v_customer_id,p_status,p_valid_until,v_subtotal,coalesce(p_discount_inr,0),coalesce(p_tax_inr,0),coalesce(p_other_charges_inr,0),p_customer_notes,p_internal_notes,auth.uid())
  returning quotation_code into v_code;

  if jsonb_array_length(v_items)>0 then
    insert into public.quotation_items(
      quotation_id,item_type,item_id,request_item_id,catalog_item_id,section_name,requested_description,description,source_type,
      quantity,rental_days,unit_rate_inr,internal_rate_inr,cost_rate_inr,cost_rate_basis,
      supplier_id,supplier_catalog_item_id,supplier_name,supplier_cost_inr,supplier_rate_type,supplier_status,supplier_reference,notes,sort_order
    )
    select v_quotation_id,coalesce(nullif(x.item_type,''),'other'),nullif(x.item_id,'')::uuid,nullif(x.request_item_id,'')::uuid,nullif(x.catalog_item_id,'')::uuid,
      coalesce(nullif(x.section_name,''),'General'),nullif(x.requested_description,''),coalesce(x.description,''),coalesce(nullif(x.source_type,''),'manual'),
      greatest(coalesce(x.quantity,0),0),greatest(coalesce(x.rental_days,0),0),greatest(coalesce(x.quoted_rate_inr,0),0),greatest(coalesce(x.internal_rate_inr,0),0),
      greatest(coalesce(x.cost_rate_inr,0),0),coalesce(nullif(x.cost_rate_basis,''),'daily'),nullif(x.supplier_id,'')::uuid,nullif(x.supplier_catalog_item_id,'')::uuid,
      nullif(x.supplier_name,''),greatest(coalesce(x.cost_rate_inr,0),0),case when coalesce(nullif(x.cost_rate_basis,''),'daily') in ('daily','weekly','flat') then coalesce(nullif(x.cost_rate_basis,''),'daily') else 'daily' end,
      case when x.source_type='supplier' then 'not_checked' else 'not_required' end,nullif(x.supplier_reference,''),nullif(x.notes,''),coalesce(x.sort_order,0)
    from jsonb_to_recordset(v_items) as x(
      item_type text,item_id text,request_item_id text,catalog_item_id text,section_name text,requested_description text,description text,source_type text,
      quantity numeric,rental_days numeric,quoted_rate_inr numeric,internal_rate_inr numeric,cost_rate_inr numeric,cost_rate_basis text,
      supplier_id text,supplier_catalog_item_id text,supplier_name text,supplier_reference text,notes text,sort_order integer
    );
  end if;

  update public.quote_requests set status=case when p_status in ('generated','sent') then 'quoted' else 'reviewing' end,updated_at=now() where id=r.id;
  if p_status='generated' then
    insert into public.quotation_revisions(quotation_id,revision_no,status,snapshot,created_by)
    values(v_quotation_id,1,'generated',jsonb_build_object('quotation_code',v_code,'total_inr',v_total,'items',v_items),auth.uid());
  end if;
  return jsonb_build_object('quotation_id',v_quotation_id,'quotation_code',v_code,'subtotal_inr',v_subtotal,'total_inr',v_total,'status',p_status);
end $$;

create or replace function public.save_quotation_atomic(
  p_quotation_id uuid,p_status text,p_discount_inr numeric,p_tax_inr numeric,
  p_other_charges_inr numeric,p_customer_notes text,p_internal_notes text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path='public' as $$
declare
  v_subtotal numeric:=0; v_total numeric:=0; v_item jsonb; v_role public.user_role; v_items jsonb:=coalesce(p_items,'[]'::jsonb); v_rev integer;
begin
  v_role:=public.current_user_role();
  if v_role not in ('admin','staff') then raise exception 'Staff access required'; end if;
  if p_status not in ('draft','generated','sent','accepted','declined','expired','converted') then raise exception 'Invalid quotation status'; end if;
  if jsonb_typeof(v_items)<>'array' then raise exception 'Items must be an array'; end if;
  for v_item in select value from jsonb_array_elements(v_items) loop
    if coalesce((v_item->>'quantity')::numeric,0)<0 or coalesce((v_item->>'rental_days')::numeric,0)<0 then raise exception 'Quantity and days cannot be negative'; end if;
    if coalesce((v_item->>'quoted_rate_inr')::numeric,0)<0 or coalesce((v_item->>'cost_rate_inr')::numeric,0)<0 then raise exception 'Rates cannot be negative'; end if;
    v_subtotal:=v_subtotal+(coalesce((v_item->>'quantity')::numeric,0)*coalesce((v_item->>'rental_days')::numeric,0)*coalesce((v_item->>'quoted_rate_inr')::numeric,0));
  end loop;
  v_total:=greatest(0,v_subtotal-coalesce(p_discount_inr,0)+coalesce(p_tax_inr,0)+coalesce(p_other_charges_inr,0));

  update public.quotations set status=p_status,subtotal_inr=v_subtotal,discount_inr=coalesce(p_discount_inr,0),tax_inr=coalesce(p_tax_inr,0),other_charges_inr=coalesce(p_other_charges_inr,0),customer_notes=p_customer_notes,internal_notes=p_internal_notes,updated_at=now() where id=p_quotation_id;
  if not found then raise exception 'Quotation not found'; end if;
  delete from public.quotation_items where quotation_id=p_quotation_id;

  if jsonb_array_length(v_items)>0 then
    insert into public.quotation_items(
      quotation_id,item_type,item_id,request_item_id,catalog_item_id,section_name,requested_description,description,source_type,
      quantity,rental_days,unit_rate_inr,internal_rate_inr,cost_rate_inr,cost_rate_basis,
      supplier_id,supplier_catalog_item_id,supplier_name,supplier_cost_inr,supplier_rate_type,supplier_status,supplier_reference,notes,sort_order
    )
    select p_quotation_id,coalesce(nullif(x.item_type,''),'other'),nullif(x.item_id,'')::uuid,nullif(x.request_item_id,'')::uuid,nullif(x.catalog_item_id,'')::uuid,
      coalesce(nullif(x.section_name,''),'General'),nullif(x.requested_description,''),coalesce(x.description,''),coalesce(nullif(x.source_type,''),'manual'),
      greatest(coalesce(x.quantity,0),0),greatest(coalesce(x.rental_days,0),0),greatest(coalesce(x.quoted_rate_inr,0),0),greatest(coalesce(x.internal_rate_inr,0),0),
      greatest(coalesce(x.cost_rate_inr,0),0),coalesce(nullif(x.cost_rate_basis,''),'daily'),nullif(x.supplier_id,'')::uuid,nullif(x.supplier_catalog_item_id,'')::uuid,
      nullif(x.supplier_name,''),greatest(coalesce(x.cost_rate_inr,0),0),case when coalesce(nullif(x.cost_rate_basis,''),'daily') in ('daily','weekly','flat') then coalesce(nullif(x.cost_rate_basis,''),'daily') else 'daily' end,
      case when x.source_type='supplier' then coalesce(nullif(x.supplier_status,''),'not_checked') else 'not_required' end,nullif(x.supplier_reference,''),nullif(x.notes,''),coalesce(x.sort_order,0)
    from jsonb_to_recordset(v_items) as x(
      item_type text,item_id text,request_item_id text,catalog_item_id text,section_name text,requested_description text,description text,source_type text,
      quantity numeric,rental_days numeric,quoted_rate_inr numeric,internal_rate_inr numeric,cost_rate_inr numeric,cost_rate_basis text,
      supplier_id text,supplier_catalog_item_id text,supplier_name text,supplier_status text,supplier_reference text,notes text,sort_order integer
    );
  end if;

  if p_status='generated' then
    select coalesce(max(revision_no),0)+1 into v_rev from public.quotation_revisions where quotation_id=p_quotation_id;
    insert into public.quotation_revisions(quotation_id,revision_no,status,snapshot,created_by)
    values(p_quotation_id,v_rev,'generated',jsonb_build_object('total_inr',v_total,'items',v_items),auth.uid());
  end if;
  return jsonb_build_object('quotation_id',p_quotation_id,'subtotal_inr',v_subtotal,'total_inr',v_total,'item_count',jsonb_array_length(v_items),'status',p_status);
end $$;

-- Booking conversion: only OWN lines reserve physical assets; SUPPLIER lines create procurement checklist.
create or replace function public.convert_quotation_to_booking_atomic(p_quotation_id uuid)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare
  q public.quotations%rowtype; r public.quote_requests%rowtype; v_booking_id uuid:=gen_random_uuid();
  v_booking_code text:='BK-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_role public.user_role; rec record; v_camera_charge numeric:=0; v_accessory_charge numeric:=0; v_other_charge numeric:=0;
begin
  v_role:=public.current_user_role();
  if v_role not in ('admin','staff') then raise exception 'Staff access required'; end if;
  select * into q from public.quotations where id=p_quotation_id for update;
  if not found then raise exception 'Quotation not found'; end if;
  if q.status<>'accepted' then raise exception 'Quotation must be Accepted before conversion'; end if;
  if q.quote_request_id is null then raise exception 'Quotation has no linked request'; end if;
  select * into r from public.quote_requests where id=q.quote_request_id for update;
  if r.start_at is null or r.end_at is null then raise exception 'Rental start and return dates are required before booking conversion'; end if;
  if r.converted_booking_id is not null then raise exception 'Request is already converted'; end if;

  create temporary table tmp_q_cameras(camera_id uuid primary key,daily_rate numeric) on commit drop;
  create temporary table tmp_q_accessories(accessory_id uuid primary key,quantity integer,daily_rate numeric) on commit drop;
  insert into tmp_q_cameras select item_id,max(unit_rate_inr) from public.quotation_items where quotation_id=q.id and source_type='own' and item_type='camera' and item_id is not null group by item_id;
  insert into tmp_q_accessories select item_id,greatest(1,round(sum(quantity))::int),max(unit_rate_inr) from public.quotation_items where quotation_id=q.id and source_type='own' and item_type='accessory' and item_id is not null group by item_id;
  insert into tmp_q_cameras select distinct eki.camera_id,0 from public.quotation_items qi join public.equipment_kit_items eki on eki.kit_id=qi.item_id where qi.quotation_id=q.id and qi.source_type='own' and qi.item_type='kit' and eki.camera_id is not null on conflict(camera_id) do nothing;
  insert into tmp_q_accessories select eki.accessory_id,sum(greatest(1,eki.quantity))::int,0 from public.quotation_items qi join public.equipment_kit_items eki on eki.kit_id=qi.item_id where qi.quotation_id=q.id and qi.source_type='own' and qi.item_type='kit' and eki.accessory_id is not null group by eki.accessory_id on conflict(accessory_id) do update set quantity=greatest(tmp_q_accessories.quantity,excluded.quantity);

  for rec in select camera_id from tmp_q_cameras loop
    if not public.camera_is_available(rec.camera_id,r.start_at,r.end_at,null) then raise exception 'Camera unavailable for selected dates: %',rec.camera_id; end if;
  end loop;
  for rec in select accessory_id from tmp_q_accessories loop
    if not public.accessory_is_available(rec.accessory_id,r.start_at,r.end_at,null) then raise exception 'Accessory unavailable for selected dates: %',rec.accessory_id; end if;
  end loop;

  select coalesce(sum(quantity*rental_days*unit_rate_inr),0) into v_camera_charge from public.quotation_items where quotation_id=q.id and source_type='own' and item_type='camera';
  select coalesce(sum(quantity*rental_days*unit_rate_inr),0) into v_accessory_charge from public.quotation_items where quotation_id=q.id and source_type='own' and item_type='accessory';
  v_other_charge:=coalesce(q.subtotal_inr,0)-v_camera_charge-v_accessory_charge+coalesce(q.tax_inr,0)+coalesce(q.other_charges_inr,0);

  insert into public.bookings(id,booking_code,customer_id,status,project_name,production_name,contact_name,contact_phone,start_at,end_at,camera_charge_inr,accessories_charge_inr,other_charges_inr,discount_inr,notes,created_by)
  values(v_booking_id,v_booking_code,q.customer_id,'reserved',r.project_name,r.company_name,r.name,r.phone,r.start_at,r.end_at,v_camera_charge,v_accessory_charge,v_other_charge,coalesce(q.discount_inr,0),q.customer_notes,auth.uid());
  insert into public.booking_cameras(booking_id,camera_id,daily_rate_inr) select v_booking_id,camera_id,daily_rate from tmp_q_cameras;
  insert into public.booking_accessories(booking_id,accessory_id,quantity,daily_rate_inr) select v_booking_id,accessory_id,quantity,daily_rate from tmp_q_accessories;

  insert into public.booking_subrentals(booking_id,quotation_item_id,section_name,description,requested_description,quantity,rental_days,supplier_name,supplier_cost_inr,supplier_rate_type,customer_rate_inr,status,supplier_reference,notes)
  select v_booking_id,qi.id,qi.section_name,qi.description,qi.requested_description,qi.quantity,qi.rental_days,coalesce(s.company_name,qi.supplier_name),qi.cost_rate_inr,
    case when qi.cost_rate_basis in ('daily','weekly','flat') then qi.cost_rate_basis else 'daily' end,qi.unit_rate_inr,
    case when qi.supplier_status in ('requested','confirmed','received','returned','cancelled') then qi.supplier_status else 'not_checked' end,qi.supplier_reference,qi.notes
  from public.quotation_items qi left join public.suppliers s on s.id=qi.supplier_id
  where qi.quotation_id=q.id and qi.source_type='supplier';

  update public.quotations set status='converted',updated_at=now() where id=q.id;
  update public.quote_requests set status='converted',converted_booking_id=v_booking_id,updated_at=now() where id=r.id;
  return jsonb_build_object('booking_id',v_booking_id,'booking_code',v_booking_code,'quoted_total_inr',(select quoted_total_inr from public.bookings where id=v_booking_id),'camera_count',(select count(*) from tmp_q_cameras),'accessory_count',(select count(*) from tmp_q_accessories),'supplier_count',(select count(*) from public.booking_subrentals where booking_id=v_booking_id));
end $$;

-- RFQ creation RPC keeps the PDF request model separate from the customer quote.
create or replace function public.create_supplier_rfq(
  p_supplier_id uuid,p_quote_request_id uuid,p_quotation_id uuid,p_project_name text,
  p_start_at timestamptz,p_end_at timestamptz,p_notes text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_role public.user_role; v_id uuid:=gen_random_uuid(); v_code text; v_items jsonb:=coalesce(p_items,'[]'::jsonb);
begin
  v_role:=public.current_user_role();
  if v_role not in ('admin','staff') then raise exception 'Staff access required'; end if;
  insert into public.supplier_rfqs(id,quote_request_id,quotation_id,supplier_id,status,project_name,start_at,end_at,supplier_notes,created_by)
  values(v_id,p_quote_request_id,p_quotation_id,p_supplier_id,'generated',p_project_name,p_start_at,p_end_at,p_notes,auth.uid()) returning rfq_code into v_code;
  if jsonb_typeof(v_items)='array' and jsonb_array_length(v_items)>0 then
    insert into public.supplier_rfq_items(supplier_rfq_id,quote_request_item_id,supplier_catalog_item_id,catalog_item_id,section_name,description,quantity,rental_days,sort_order)
    select v_id,nullif(x.quote_request_item_id,'')::uuid,nullif(x.supplier_catalog_item_id,'')::uuid,nullif(x.catalog_item_id,'')::uuid,coalesce(nullif(x.section_name,''),'General'),coalesce(x.description,''),greatest(coalesce(x.quantity,0),0),greatest(coalesce(x.rental_days,0),0),x.sort_order
    from jsonb_to_recordset(v_items) as x(quote_request_item_id text,supplier_catalog_item_id text,catalog_item_id text,section_name text,description text,quantity numeric,rental_days numeric,sort_order integer);
  end if;
  return jsonb_build_object('supplier_rfq_id',v_id,'rfq_code',v_code);
end $$;

revoke all on function public.create_supplier_rfq(uuid,uuid,uuid,text,timestamptz,timestamptz,text,jsonb) from public;
grant execute on function public.create_supplier_rfq(uuid,uuid,uuid,text,timestamptz,timestamptz,text,jsonb) to authenticated;
