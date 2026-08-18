-- Sri Cine Hub V6.3: RLS + QA hardening
-- Not-live environment: make staff access predictable and move quote-request creation behind RPC.

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin','staff')
  );
$$;

revoke all on function public.is_active_staff() from public;
grant execute on function public.is_active_staff() to authenticated;

-- Add a consistent fallback staff policy to every rental/quote operational table.
-- Existing policies remain; PostgreSQL combines permissive policies with OR.
do $$
declare t text;
begin
  foreach t in array array[
    'accessories','asset_scan_events','audit_log','booking_accessories','booking_cameras',
    'booking_kits','booking_subrentals','bookings','cameras','customers','equipment_kit_items',
    'equipment_kits','evidence','internal_rates','maintenance','master_equipment_catalog','payments',
    'quotation_items','quotation_revisions','quotations','quote_request_attachments','quote_request_items',
    'quote_requests','receipts','supplier_catalog_items','supplier_rfq_attachments','supplier_rfq_items',
    'supplier_rfqs','suppliers'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', 'v63_staff_' || t, t);
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_active_staff()) with check (public.is_active_staff())',
        'v63_staff_' || t, t
      );
    end if;
  end loop;
end $$;

-- Storage policies for every private bucket used by the app.
drop policy if exists v63_quote_docs_select on storage.objects;
drop policy if exists v63_quote_docs_insert on storage.objects;
drop policy if exists v63_quote_docs_update on storage.objects;
drop policy if exists v63_quote_docs_delete on storage.objects;
create policy v63_quote_docs_select on storage.objects for select to authenticated
using (bucket_id='quote-request-documents' and public.is_active_staff());
create policy v63_quote_docs_insert on storage.objects for insert to authenticated
with check (bucket_id='quote-request-documents' and public.is_active_staff());
create policy v63_quote_docs_update on storage.objects for update to authenticated
using (bucket_id='quote-request-documents' and public.is_active_staff())
with check (bucket_id='quote-request-documents' and public.is_active_staff());
create policy v63_quote_docs_delete on storage.objects for delete to authenticated
using (bucket_id='quote-request-documents' and public.is_active_staff());

drop policy if exists v63_supplier_docs_select on storage.objects;
drop policy if exists v63_supplier_docs_insert on storage.objects;
drop policy if exists v63_supplier_docs_update on storage.objects;
drop policy if exists v63_supplier_docs_delete on storage.objects;
create policy v63_supplier_docs_select on storage.objects for select to authenticated
using (bucket_id='supplier-rfq-documents' and public.is_active_staff());
create policy v63_supplier_docs_insert on storage.objects for insert to authenticated
with check (bucket_id='supplier-rfq-documents' and public.is_active_staff());
create policy v63_supplier_docs_update on storage.objects for update to authenticated
using (bucket_id='supplier-rfq-documents' and public.is_active_staff())
with check (bucket_id='supplier-rfq-documents' and public.is_active_staff());
create policy v63_supplier_docs_delete on storage.objects for delete to authenticated
using (bucket_id='supplier-rfq-documents' and public.is_active_staff());

drop policy if exists v63_rental_evidence_select on storage.objects;
drop policy if exists v63_rental_evidence_insert on storage.objects;
drop policy if exists v63_rental_evidence_update on storage.objects;
drop policy if exists v63_rental_evidence_delete on storage.objects;
create policy v63_rental_evidence_select on storage.objects for select to authenticated
using (bucket_id='rental-evidence' and public.is_active_staff());
create policy v63_rental_evidence_insert on storage.objects for insert to authenticated
with check (bucket_id='rental-evidence' and public.is_active_staff());
create policy v63_rental_evidence_update on storage.objects for update to authenticated
using (bucket_id='rental-evidence' and public.is_active_staff())
with check (bucket_id='rental-evidence' and public.is_active_staff());
create policy v63_rental_evidence_delete on storage.objects for delete to authenticated
using (bucket_id='rental-evidence' and public.is_active_staff());

-- Internal quote request creation is an RPC instead of a browser table insert.
create or replace function public.staff_create_quote_request(
  p_name text default null,
  p_company_name text default null,
  p_phone text default null,
  p_project_name text default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  if not public.is_active_staff() then
    raise exception 'Staff access required';
  end if;
  if p_start_at is not null and p_end_at is not null and p_end_at <= p_start_at then
    raise exception 'Return must be after start';
  end if;

  insert into public.quote_requests(name,company_name,phone,project_name,start_at,end_at,notes,status)
  values(
    nullif(trim(coalesce(p_name,'')),''),
    nullif(trim(coalesce(p_company_name,'')),''),
    nullif(trim(coalesce(p_phone,'')),''),
    nullif(trim(coalesce(p_project_name,'')),''),
    p_start_at,p_end_at,
    nullif(trim(coalesce(p_notes,'')),''),
    'new'
  )
  returning id,request_code into v_id,v_code;

  return jsonb_build_object('id',v_id,'request_code',v_code);
end $$;
revoke all on function public.staff_create_quote_request(text,text,text,text,timestamptz,timestamptz,text) from public;
grant execute on function public.staff_create_quote_request(text,text,text,text,timestamptz,timestamptz,text) to authenticated;

-- Attachment metadata also goes through role-checked RPCs.
create or replace function public.staff_add_quote_request_attachment(
  p_quote_request_id uuid,
  p_file_name text,
  p_file_path text,
  p_content_type text default null,
  p_file_size bigint default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_active_staff() then raise exception 'Staff access required'; end if;
  if not exists(select 1 from public.quote_requests where id=p_quote_request_id) then raise exception 'Quote request not found'; end if;
  insert into public.quote_request_attachments(quote_request_id,file_name,file_path,content_type,file_size,uploaded_by)
  values(p_quote_request_id,p_file_name,p_file_path,p_content_type,p_file_size,auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.staff_add_quote_request_attachment(uuid,text,text,text,bigint) from public;
grant execute on function public.staff_add_quote_request_attachment(uuid,text,text,text,bigint) to authenticated;

create or replace function public.staff_delete_quote_request_attachment(p_attachment_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_path text;
begin
  if not public.is_active_staff() then raise exception 'Staff access required'; end if;
  delete from public.quote_request_attachments where id=p_attachment_id returning file_path into v_path;
  if v_path is null then raise exception 'Attachment not found'; end if;
  return v_path;
end $$;
revoke all on function public.staff_delete_quote_request_attachment(uuid) from public;
grant execute on function public.staff_delete_quote_request_attachment(uuid) to authenticated;
