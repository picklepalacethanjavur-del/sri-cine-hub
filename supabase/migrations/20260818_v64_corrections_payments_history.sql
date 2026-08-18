-- Sri Cine Hub V6.4 - correction-safe operations, payment ledger, and activity history.

alter table public.payments add column if not exists transaction_type text not null default 'payment';
alter table public.payments add column if not exists status text not null default 'posted';
alter table public.payments add column if not exists reversed_payment_id uuid null references public.payments(id) on delete set null;
alter table public.payments add column if not exists correction_reason text null;
alter table public.payments add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists(select 1 from pg_constraint where conname='payments_transaction_type_check') then
    alter table public.payments add constraint payments_transaction_type_check check(transaction_type in ('payment','refund','reversal','adjustment'));
  end if;
  if not exists(select 1 from pg_constraint where conname='payments_status_check') then
    alter table public.payments add constraint payments_status_check check(status in ('posted','voided'));
  end if;
  if not exists(select 1 from pg_constraint where conname='payments_amount_positive_check') then
    alter table public.payments add constraint payments_amount_positive_check check(amount_inr >= 0);
  end if;
end $$;

-- Backfill old receipt payment snapshots into the ledger only where no ledger exists.
insert into public.payments(booking_id,amount_inr,method,reference,received_at,received_by,notes,transaction_type,status)
select r.booking_id,r.amount_paid_inr,r.payment_method,r.payment_reference,r.issued_at,r.issued_by,'Backfilled from legacy receipt payment snapshot','payment','posted'
from public.receipts r
where r.amount_paid_inr>0
and not exists(select 1 from public.payments p where p.booking_id=r.booking_id);

create or replace function public.payment_total_for_booking(p_booking_id uuid)
returns numeric language sql stable security definer set search_path=public as $$
  select coalesce(sum(case when status<>'posted' then 0 when transaction_type in ('refund','reversal') then -amount_inr else amount_inr end),0)
  from public.payments where booking_id=p_booking_id;
$$;
revoke execute on function public.payment_total_for_booking(uuid) from anon, public;
grant execute on function public.payment_total_for_booking(uuid) to authenticated;

create or replace function public.refresh_booking_financials(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  b public.bookings%rowtype;
  r public.receipts%rowtype;
  v_paid numeric:=0;
  v_total numeric:=0;
  v_balance numeric:=0;
  v_status public.payment_status;
  v_last public.payments%rowtype;
begin
  select * into b from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  select * into r from public.receipts where booking_id=p_booking_id for update;
  v_paid:=public.payment_total_for_booking(p_booking_id);
  if r.id is not null then
    v_total:=coalesce(r.rental_amount_inr,0)+coalesce(r.damage_charges_inr,0)+coalesce(r.late_charges_inr,0)+coalesce(r.other_charges_inr,0)-coalesce(r.discount_inr,0);
  else
    v_total:=coalesce(b.quoted_total_inr,0);
  end if;
  v_balance:=greatest(0,v_total-v_paid);
  v_status:=case when v_balance<=0 then 'paid'::public.payment_status when v_paid>0 then 'partial'::public.payment_status else 'pending'::public.payment_status end;
  select * into v_last from public.payments where booking_id=p_booking_id and status='posted' order by received_at desc,created_at desc limit 1;
  update public.bookings set amount_received_inr=v_paid,payment_status=v_status,updated_at=now() where id=p_booking_id;
  if r.id is not null then
    update public.receipts set amount_paid_inr=v_paid,balance_inr=v_balance,
      payment_method=v_last.method,payment_reference=v_last.reference
    where id=r.id;
  end if;
  return jsonb_build_object('booking_id',p_booking_id,'paid_inr',v_paid,'total_inr',v_total,'balance_inr',v_balance,'payment_status',v_status);
end $$;
revoke execute on function public.refresh_booking_financials(uuid) from anon, public;
grant execute on function public.refresh_booking_financials(uuid) to authenticated;

create or replace function public.add_booking_payment(
  p_booking_id uuid,p_amount_inr numeric,p_method text default null,p_reference text default null,p_notes text default null,p_received_at timestamptz default now()
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_result jsonb;
begin
  if not public.is_active_staff() then raise exception 'Staff access required'; end if;
  if coalesce(p_amount_inr,0)<=0 then raise exception 'Payment amount must be greater than zero'; end if;
  if not exists(select 1 from public.bookings where id=p_booking_id) then raise exception 'Booking not found'; end if;
  insert into public.payments(booking_id,amount_inr,method,reference,received_at,received_by,notes,transaction_type,status)
  values(p_booking_id,p_amount_inr,nullif(trim(coalesce(p_method,'')),''),nullif(trim(coalesce(p_reference,'')),''),coalesce(p_received_at,now()),auth.uid(),nullif(trim(coalesce(p_notes,'')),''),'payment','posted') returning id into v_id;
  v_result:=public.refresh_booking_financials(p_booking_id);
  insert into public.audit_log(actor_id,action,entity_type,entity_id,new_data)
  values(auth.uid(),'payment_added','booking',p_booking_id,jsonb_build_object('payment_id',v_id,'amount_inr',p_amount_inr,'method',p_method,'reference',p_reference));
  return v_result||jsonb_build_object('payment_id',v_id);
end $$;
revoke execute on function public.add_booking_payment(uuid,numeric,text,text,text,timestamptz) from anon, public;
grant execute on function public.add_booking_payment(uuid,numeric,text,text,text,timestamptz) to authenticated;

create or replace function public.reverse_booking_payment(p_payment_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.payments%rowtype;v_id uuid;v_result jsonb;
begin
  if not public.is_active_staff() then raise exception 'Staff access required'; end if;
  if char_length(trim(coalesce(p_reason,'')))<4 then raise exception 'Correction reason is required'; end if;
  select * into p from public.payments where id=p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if p.status<>'posted' or p.transaction_type not in ('payment','adjustment') then raise exception 'Only a posted payment can be reversed'; end if;
  if exists(select 1 from public.payments where reversed_payment_id=p.id and transaction_type='reversal' and status='posted') then raise exception 'This payment has already been reversed'; end if;
  insert into public.payments(booking_id,amount_inr,method,reference,received_at,received_by,notes,transaction_type,status,reversed_payment_id,correction_reason)
  values(p.booking_id,p.amount_inr,p.method,p.reference,now(),auth.uid(),'Reversal of payment '||p.id,'reversal','posted',p.id,trim(p_reason)) returning id into v_id;
  v_result:=public.refresh_booking_financials(p.booking_id);
  insert into public.audit_log(actor_id,action,entity_type,entity_id,old_data,new_data)
  values(auth.uid(),'payment_reversed','booking',p.booking_id,to_jsonb(p),jsonb_build_object('reversal_payment_id',v_id,'reason',trim(p_reason)));
  return v_result||jsonb_build_object('reversal_payment_id',v_id);
end $$;
revoke execute on function public.reverse_booking_payment(uuid,text) from anon, public;
grant execute on function public.reverse_booking_payment(uuid,text) to authenticated;

create or replace function public.correct_receipt_charges(
 p_receipt_id uuid,p_damage_inr numeric,p_late_inr numeric,p_other_inr numeric,p_discount_inr numeric,p_notes text,p_reason text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare oldr public.receipts%rowtype;newr public.receipts%rowtype;v_result jsonb;
begin
 if not public.is_active_staff() then raise exception 'Staff access required'; end if;
 if char_length(trim(coalesce(p_reason,'')))<4 then raise exception 'Correction reason is required'; end if;
 if least(coalesce(p_damage_inr,0),coalesce(p_late_inr,0),coalesce(p_other_inr,0),coalesce(p_discount_inr,0))<0 then raise exception 'Charges cannot be negative'; end if;
 select * into oldr from public.receipts where id=p_receipt_id for update;
 if not found then raise exception 'Receipt not found'; end if;
 update public.receipts set damage_charges_inr=coalesce(p_damage_inr,0),late_charges_inr=coalesce(p_late_inr,0),other_charges_inr=coalesce(p_other_inr,0),discount_inr=coalesce(p_discount_inr,0),return_notes=nullif(trim(coalesce(p_notes,'')),'') where id=p_receipt_id returning * into newr;
 v_result:=public.refresh_booking_financials(oldr.booking_id);
 insert into public.audit_log(actor_id,action,entity_type,entity_id,old_data,new_data)
 values(auth.uid(),'receipt_charges_corrected','receipt',p_receipt_id,to_jsonb(oldr),to_jsonb(newr)||jsonb_build_object('reason',trim(p_reason)));
 return v_result||jsonb_build_object('receipt_id',p_receipt_id);
end $$;
revoke execute on function public.correct_receipt_charges(uuid,numeric,numeric,numeric,numeric,text,text) from anon, public;
grant execute on function public.correct_receipt_charges(uuid,numeric,numeric,numeric,numeric,text,text) to authenticated;

create or replace function public.correct_quote_request(
 p_request_id uuid,p_name text,p_company_name text,p_phone text,p_email text,p_project_name text,p_start_at timestamptz,p_end_at timestamptz,p_notes text,p_reason text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare oldr public.quote_requests%rowtype;newr public.quote_requests%rowtype;
begin
 if not public.is_active_staff() then raise exception 'Staff access required'; end if;
 if char_length(trim(coalesce(p_reason,'')))<4 then raise exception 'Correction reason is required'; end if;
 if p_start_at is not null and p_end_at is not null and p_end_at<=p_start_at then raise exception 'Return time must be after start time'; end if;
 select * into oldr from public.quote_requests where id=p_request_id for update;if not found then raise exception 'Request not found'; end if;
 update public.quote_requests set name=nullif(trim(coalesce(p_name,'')),''),company_name=nullif(trim(coalesce(p_company_name,'')),''),phone=nullif(trim(coalesce(p_phone,'')),''),email=nullif(trim(coalesce(p_email,'')),''),project_name=nullif(trim(coalesce(p_project_name,'')),''),start_at=p_start_at,end_at=p_end_at,notes=nullif(trim(coalesce(p_notes,'')),''),updated_at=now() where id=p_request_id returning * into newr;
 insert into public.audit_log(actor_id,action,entity_type,entity_id,old_data,new_data) values(auth.uid(),'quote_request_corrected','quote_request',p_request_id,to_jsonb(oldr),to_jsonb(newr)||jsonb_build_object('reason',trim(p_reason)));
 return jsonb_build_object('request_id',p_request_id,'request_code',newr.request_code);
end $$;
revoke execute on function public.correct_quote_request(uuid,text,text,text,text,text,timestamptz,timestamptz,text,text) from anon, public;
grant execute on function public.correct_quote_request(uuid,text,text,text,text,text,timestamptz,timestamptz,text,text) to authenticated;

create or replace function public.correct_booking_details(
 p_booking_id uuid,p_project_name text,p_production_name text,p_contact_name text,p_contact_phone text,p_start_at timestamptz,p_end_at timestamptz,p_pickup_location text,p_return_location text,p_operator_name text,p_notes text,p_reason text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare oldb public.bookings%rowtype;newb public.bookings%rowtype;
begin
 if not public.is_active_staff() then raise exception 'Staff access required'; end if;
 if char_length(trim(coalesce(p_reason,'')))<4 then raise exception 'Correction reason is required'; end if;
 select * into oldb from public.bookings where id=p_booking_id for update;if not found then raise exception 'Booking not found'; end if;
 if oldb.status in ('checked_out','overdue','returned','closed') and (p_start_at is distinct from oldb.start_at or p_end_at is distinct from oldb.end_at) then raise exception 'Rental dates cannot be changed after checkout'; end if;
 if p_start_at is null or p_end_at is null or p_end_at<=p_start_at then raise exception 'Valid rental dates are required'; end if;
 update public.bookings set project_name=nullif(trim(coalesce(p_project_name,'')),''),production_name=nullif(trim(coalesce(p_production_name,'')),''),contact_name=nullif(trim(coalesce(p_contact_name,'')),''),contact_phone=nullif(trim(coalesce(p_contact_phone,'')),''),start_at=p_start_at,end_at=p_end_at,pickup_location=nullif(trim(coalesce(p_pickup_location,'')),''),return_location=nullif(trim(coalesce(p_return_location,'')),''),operator_name=nullif(trim(coalesce(p_operator_name,'')),''),notes=nullif(trim(coalesce(p_notes,'')),''),updated_at=now() where id=p_booking_id returning * into newb;
 insert into public.audit_log(actor_id,action,entity_type,entity_id,old_data,new_data) values(auth.uid(),'booking_details_corrected','booking',p_booking_id,to_jsonb(oldb),to_jsonb(newb)||jsonb_build_object('reason',trim(p_reason)));
 return jsonb_build_object('booking_id',p_booking_id,'booking_code',newb.booking_code,'status',newb.status);
end $$;
revoke execute on function public.correct_booking_details(uuid,text,text,text,text,timestamptz,timestamptz,text,text,text,text,text) from anon, public;
grant execute on function public.correct_booking_details(uuid,text,text,text,text,timestamptz,timestamptz,text,text,text,text,text) to authenticated;

-- Update return RPC so money received is written as a ledger transaction, not only as a mutable receipt snapshot.
create or replace function public.return_booking_atomic(
  p_booking_id uuid,p_items jsonb,p_damage_inr numeric default 0,p_late_inr numeric default 0,p_other_inr numeric default 0,p_paid_inr numeric default 0,p_payment_method text default null,p_payment_reference text default null,p_notes text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  b public.bookings%rowtype;x jsonb;v_kind text;v_asset_id uuid;v_hours numeric;v_checkout_hours numeric;v_condition text;v_path text;v_line_id uuid;v_expected integer;v_supplied integer;v_rental numeric:=0;v_receipt_id uuid;v_receipt_code text;v_has_damage boolean:=false;v_notes text;v_fin jsonb;
begin
  if not public.is_active_staff() then raise exception 'Staff access required'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' then raise exception 'Items must be an array'; end if;
  if coalesce(p_damage_inr,0)<0 or coalesce(p_late_inr,0)<0 or coalesce(p_other_inr,0)<0 or coalesce(p_paid_inr,0)<0 then raise exception 'Charges and payment cannot be negative'; end if;
  select * into b from public.bookings where id=p_booking_id for update;if not found then raise exception 'Booking not found'; end if;
  if b.status not in ('checked_out','overdue') then raise exception 'Booking is not checked out (status: %)',b.status; end if;
  select (select count(*) from public.booking_cameras where booking_id=b.id)+(select count(*) from public.booking_accessories where booking_id=b.id) into v_expected;
  select count(*) into v_supplied from jsonb_array_elements(coalesce(p_items,'[]'::jsonb));if v_supplied<>v_expected then raise exception 'Return asset count mismatch: expected %, received %',v_expected,v_supplied;end if;
  for x in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_kind:=x->>'kind';begin v_asset_id:=(x->>'asset_id')::uuid;exception when others then raise exception 'Invalid asset id';end;v_condition:=coalesce(nullif(x->>'condition',''),'good');v_path:=nullif(x->>'evidence_path','');if v_condition not in ('good','fair','damaged','missing') then raise exception 'Invalid return condition: %',v_condition;end if;if v_condition in ('damaged','missing') then v_has_damage:=true;end if;
    if v_kind='camera' then
      v_hours:=coalesce((x->>'hours')::numeric,0);select id,checkout_hours into v_line_id,v_checkout_hours from public.booking_cameras where booking_id=b.id and camera_id=v_asset_id for update;if v_line_id is null then raise exception 'Camera % is not assigned to this booking',v_asset_id;end if;if v_hours<coalesce(v_checkout_hours,0) then raise exception 'Return hours cannot be lower than checkout hours';end if;
      update public.booking_cameras set return_hours=v_hours,condition_in=v_condition where id=v_line_id;update public.cameras set status=case when v_condition in ('good','fair') then 'available'::public.asset_status else 'maintenance'::public.asset_status end,current_hours=v_hours,updated_at=now() where id=v_asset_id;
      if v_path is not null then insert into public.evidence(booking_id,camera_id,evidence_type,camera_hours,file_path,captured_by) values(b.id,v_asset_id,case when v_condition in ('damaged','missing') then 'damage'::public.evidence_type else 'return_hours'::public.evidence_type end,v_hours,v_path,auth.uid());end if;
      if v_condition in ('damaged','missing') and not exists(select 1 from public.maintenance where camera_id=v_asset_id and status in ('scheduled','in_progress')) then insert into public.maintenance(camera_id,status,start_at,reason,notes,created_by) values(v_asset_id,'scheduled',now(),case when v_condition='missing' then 'Asset reported missing on return' else 'Damage reported on return' end,'Created automatically from booking '||b.booking_code,auth.uid());end if;
    elsif v_kind='accessory' then
      select id into v_line_id from public.booking_accessories where booking_id=b.id and accessory_id=v_asset_id for update;if v_line_id is null then raise exception 'Accessory % is not assigned to this booking',v_asset_id;end if;update public.booking_accessories set condition_in=v_condition where id=v_line_id;update public.accessories set status=case when v_condition in ('good','fair') then 'available'::public.asset_status else 'maintenance'::public.asset_status end,updated_at=now() where id=v_asset_id;
      if v_path is not null then insert into public.evidence(booking_id,accessory_id,evidence_type,file_path,captured_by) values(b.id,v_asset_id,case when v_condition in ('damaged','missing') then 'damage'::public.evidence_type else 'condition'::public.evidence_type end,v_path,auth.uid());end if;
      if v_condition in ('damaged','missing') and not exists(select 1 from public.maintenance where accessory_id=v_asset_id and status in ('scheduled','in_progress')) then insert into public.maintenance(accessory_id,status,start_at,reason,notes,created_by) values(v_asset_id,'scheduled',now(),case when v_condition='missing' then 'Asset reported missing on return' else 'Damage reported on return' end,'Created automatically from booking '||b.booking_code,auth.uid());end if;
    else raise exception 'Invalid asset kind: %',coalesce(v_kind,'');end if;
  end loop;
  v_rental:=coalesce(b.quoted_total_inr,0);v_notes:=nullif(trim(coalesce(p_notes,'')),'');if v_has_damage then v_notes:=concat_ws(E'\n',v_notes,'One or more owned assets were marked damaged/missing and moved to maintenance.');end if;
  update public.bookings set status='returned',returned_at=now(),updated_at=now() where id=b.id;
  insert into public.receipts(booking_id,customer_id,rental_amount_inr,damage_charges_inr,late_charges_inr,other_charges_inr,amount_paid_inr,balance_inr,payment_method,payment_reference,return_notes,issued_by)
  values(b.id,b.customer_id,v_rental,coalesce(p_damage_inr,0),coalesce(p_late_inr,0),coalesce(p_other_inr,0),0,v_rental+coalesce(p_damage_inr,0)+coalesce(p_late_inr,0)+coalesce(p_other_inr,0),null,null,v_notes,auth.uid())
  on conflict(booking_id) do update set customer_id=excluded.customer_id,rental_amount_inr=excluded.rental_amount_inr,damage_charges_inr=excluded.damage_charges_inr,late_charges_inr=excluded.late_charges_inr,other_charges_inr=excluded.other_charges_inr,return_notes=excluded.return_notes,issued_by=excluded.issued_by,issued_at=now() returning id,receipt_code into v_receipt_id,v_receipt_code;
  if coalesce(p_paid_inr,0)>0 then insert into public.payments(booking_id,amount_inr,method,reference,received_at,received_by,notes,transaction_type,status) values(b.id,p_paid_inr,nullif(trim(coalesce(p_payment_method,'')),''),nullif(trim(coalesce(p_payment_reference,'')),''),now(),auth.uid(),'Payment recorded during equipment return','payment','posted');end if;
  v_fin:=public.refresh_booking_financials(b.id);
  insert into public.audit_log(actor_id,action,entity_type,entity_id,new_data) values(auth.uid(),'booking_returned','booking',b.id,jsonb_build_object('receipt_id',v_receipt_id,'receipt_code',v_receipt_code,'charges',jsonb_build_object('damage',p_damage_inr,'late',p_late_inr,'other',p_other_inr),'initial_payment',p_paid_inr));
  return v_fin||jsonb_build_object('booking_id',b.id,'status','returned','receipt_id',v_receipt_id,'receipt_code',v_receipt_code,'rental_inr',v_rental,'asset_count',v_expected);
end $$;
revoke execute on function public.return_booking_atomic(uuid,jsonb,numeric,numeric,numeric,numeric,text,text,text) from anon, public;
grant execute on function public.return_booking_atomic(uuid,jsonb,numeric,numeric,numeric,numeric,text,text,text) to authenticated;

-- Add audit entry to checkout while preserving current atomic behavior.
create or replace function public.checkout_booking_atomic(p_booking_id uuid,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.bookings%rowtype;x jsonb;v_kind text;v_asset_id uuid;v_hours numeric;v_condition text;v_path text;v_line_id uuid;v_expected integer;v_supplied integer;
begin
 if not public.is_active_staff() then raise exception 'Staff access required';end if;if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' then raise exception 'Items must be an array';end if;select * into b from public.bookings where id=p_booking_id for update;if not found then raise exception 'Booking not found';end if;if b.status not in ('reserved','confirmed','preparing') then raise exception 'Booking is not ready for checkout (status: %)',b.status;end if;
 select (select count(*) from public.booking_cameras where booking_id=b.id)+(select count(*) from public.booking_accessories where booking_id=b.id) into v_expected;select count(*) into v_supplied from jsonb_array_elements(coalesce(p_items,'[]'::jsonb));if v_supplied<>v_expected then raise exception 'Checkout asset count mismatch: expected %, received %',v_expected,v_supplied;end if;
 for x in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop v_kind:=x->>'kind';begin v_asset_id:=(x->>'asset_id')::uuid;exception when others then raise exception 'Invalid asset id';end;v_condition:=coalesce(nullif(x->>'condition',''),'good');v_path:=nullif(x->>'evidence_path','');if v_condition not in ('good','fair','damaged') then raise exception 'Invalid checkout condition: %',v_condition;end if;
  if v_kind='camera' then v_hours:=coalesce((x->>'hours')::numeric,0);if v_hours<0 then raise exception 'Camera hours cannot be negative';end if;select id into v_line_id from public.booking_cameras where booking_id=b.id and camera_id=v_asset_id for update;if v_line_id is null then raise exception 'Camera % is not assigned to this booking',v_asset_id;end if;update public.booking_cameras set checkout_hours=v_hours,condition_out=v_condition where id=v_line_id;update public.cameras set status='out',current_hours=v_hours,updated_at=now() where id=v_asset_id;if v_path is not null then insert into public.evidence(booking_id,camera_id,evidence_type,camera_hours,file_path,captured_by) values(b.id,v_asset_id,'checkout_hours',v_hours,v_path,auth.uid());end if;
  elsif v_kind='accessory' then select id into v_line_id from public.booking_accessories where booking_id=b.id and accessory_id=v_asset_id for update;if v_line_id is null then raise exception 'Accessory % is not assigned to this booking',v_asset_id;end if;update public.booking_accessories set condition_out=v_condition where id=v_line_id;update public.accessories set status='out',updated_at=now() where id=v_asset_id;if v_path is not null then insert into public.evidence(booking_id,accessory_id,evidence_type,file_path,captured_by) values(b.id,v_asset_id,'condition',v_path,auth.uid());end if;
  else raise exception 'Invalid asset kind: %',coalesce(v_kind,'');end if;end loop;
 update public.bookings set status='checked_out',checked_out_at=now(),updated_at=now() where id=b.id;insert into public.audit_log(actor_id,action,entity_type,entity_id,new_data) values(auth.uid(),'booking_checked_out','booking',b.id,jsonb_build_object('asset_count',v_expected));return jsonb_build_object('booking_id',b.id,'status','checked_out','asset_count',v_expected);
end $$;
revoke execute on function public.checkout_booking_atomic(uuid,jsonb) from anon, public;
grant execute on function public.checkout_booking_atomic(uuid,jsonb) to authenticated;
