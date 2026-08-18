-- V6.3 atomic checkout/return workflow.
-- Files are uploaded first; DB state changes happen in one transaction through these RPCs.

create or replace function public.checkout_booking_atomic(
  p_booking_id uuid,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  b public.bookings%rowtype;
  x jsonb;
  v_kind text;
  v_asset_id uuid;
  v_hours numeric;
  v_condition text;
  v_path text;
  v_line_id uuid;
  v_expected integer;
  v_supplied integer;
begin
  if not public.is_active_staff() then raise exception 'Staff access required'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' then raise exception 'Items must be an array'; end if;

  select * into b from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.status not in ('reserved','confirmed','preparing') then raise exception 'Booking is not ready for checkout (status: %)',b.status; end if;

  select (select count(*) from public.booking_cameras where booking_id=b.id)
       + (select count(*) from public.booking_accessories where booking_id=b.id)
    into v_expected;
  select count(*) into v_supplied from jsonb_array_elements(coalesce(p_items,'[]'::jsonb));
  if v_supplied <> v_expected then raise exception 'Checkout asset count mismatch: expected %, received %',v_expected,v_supplied; end if;

  for x in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_kind:=x->>'kind';
    begin v_asset_id:=(x->>'asset_id')::uuid; exception when others then raise exception 'Invalid asset id'; end;
    v_condition:=coalesce(nullif(x->>'condition',''),'good');
    v_path:=nullif(x->>'evidence_path','');
    if v_condition not in ('good','fair','damaged') then raise exception 'Invalid checkout condition: %',v_condition; end if;

    if v_kind='camera' then
      v_hours:=coalesce((x->>'hours')::numeric,0);
      if v_hours<0 then raise exception 'Camera hours cannot be negative'; end if;
      select id into v_line_id from public.booking_cameras where booking_id=b.id and camera_id=v_asset_id for update;
      if v_line_id is null then raise exception 'Camera % is not assigned to this booking',v_asset_id; end if;
      update public.booking_cameras set checkout_hours=v_hours,condition_out=v_condition where id=v_line_id;
      update public.cameras set status='out',current_hours=v_hours,updated_at=now() where id=v_asset_id;
      if v_path is not null then
        insert into public.evidence(booking_id,camera_id,evidence_type,camera_hours,file_path,captured_by)
        values(b.id,v_asset_id,'checkout_hours',v_hours,v_path,auth.uid());
      end if;
    elsif v_kind='accessory' then
      select id into v_line_id from public.booking_accessories where booking_id=b.id and accessory_id=v_asset_id for update;
      if v_line_id is null then raise exception 'Accessory % is not assigned to this booking',v_asset_id; end if;
      update public.booking_accessories set condition_out=v_condition where id=v_line_id;
      update public.accessories set status='out',updated_at=now() where id=v_asset_id;
      if v_path is not null then
        insert into public.evidence(booking_id,accessory_id,evidence_type,file_path,captured_by)
        values(b.id,v_asset_id,'condition',v_path,auth.uid());
      end if;
    else
      raise exception 'Invalid asset kind: %',coalesce(v_kind,'');
    end if;
  end loop;

  update public.bookings set status='checked_out',checked_out_at=now(),updated_at=now() where id=b.id;
  return jsonb_build_object('booking_id',b.id,'status','checked_out','asset_count',v_expected);
end $$;

create or replace function public.return_booking_atomic(
  p_booking_id uuid,
  p_items jsonb,
  p_damage_inr numeric default 0,
  p_late_inr numeric default 0,
  p_other_inr numeric default 0,
  p_paid_inr numeric default 0,
  p_payment_method text default null,
  p_payment_reference text default null,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  b public.bookings%rowtype;
  x jsonb;
  v_kind text;
  v_asset_id uuid;
  v_hours numeric;
  v_checkout_hours numeric;
  v_condition text;
  v_path text;
  v_line_id uuid;
  v_expected integer;
  v_supplied integer;
  v_rental numeric:=0;
  v_balance numeric:=0;
  v_payment_status public.payment_status;
  v_receipt_id uuid;
  v_receipt_code text;
  v_has_damage boolean:=false;
  v_notes text;
begin
  if not public.is_active_staff() then raise exception 'Staff access required'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' then raise exception 'Items must be an array'; end if;
  if coalesce(p_damage_inr,0)<0 or coalesce(p_late_inr,0)<0 or coalesce(p_other_inr,0)<0 or coalesce(p_paid_inr,0)<0 then raise exception 'Charges and payment cannot be negative'; end if;

  select * into b from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.status not in ('checked_out','overdue') then raise exception 'Booking is not checked out (status: %)',b.status; end if;

  select (select count(*) from public.booking_cameras where booking_id=b.id)
       + (select count(*) from public.booking_accessories where booking_id=b.id)
    into v_expected;
  select count(*) into v_supplied from jsonb_array_elements(coalesce(p_items,'[]'::jsonb));
  if v_supplied <> v_expected then raise exception 'Return asset count mismatch: expected %, received %',v_expected,v_supplied; end if;

  for x in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_kind:=x->>'kind';
    begin v_asset_id:=(x->>'asset_id')::uuid; exception when others then raise exception 'Invalid asset id'; end;
    v_condition:=coalesce(nullif(x->>'condition',''),'good');
    v_path:=nullif(x->>'evidence_path','');
    if v_condition not in ('good','fair','damaged','missing') then raise exception 'Invalid return condition: %',v_condition; end if;
    if v_condition in ('damaged','missing') then v_has_damage:=true; end if;

    if v_kind='camera' then
      v_hours:=coalesce((x->>'hours')::numeric,0);
      select id,checkout_hours into v_line_id,v_checkout_hours from public.booking_cameras where booking_id=b.id and camera_id=v_asset_id for update;
      if v_line_id is null then raise exception 'Camera % is not assigned to this booking',v_asset_id; end if;
      if v_hours<coalesce(v_checkout_hours,0) then raise exception 'Return hours cannot be lower than checkout hours'; end if;
      update public.booking_cameras set return_hours=v_hours,condition_in=v_condition where id=v_line_id;
      update public.cameras set status=case when v_condition in ('good','fair') then 'available'::public.asset_status else 'maintenance'::public.asset_status end,current_hours=v_hours,updated_at=now() where id=v_asset_id;
      if v_path is not null then
        insert into public.evidence(booking_id,camera_id,evidence_type,camera_hours,file_path,captured_by)
        values(b.id,v_asset_id,case when v_condition in ('damaged','missing') then 'damage'::public.evidence_type else 'return_hours'::public.evidence_type end,v_hours,v_path,auth.uid());
      end if;
      if v_condition in ('damaged','missing') and not exists(select 1 from public.maintenance where camera_id=v_asset_id and status in ('scheduled','in_progress')) then
        insert into public.maintenance(camera_id,status,start_at,reason,notes,created_by)
        values(v_asset_id,'scheduled',now(),case when v_condition='missing' then 'Asset reported missing on return' else 'Damage reported on return' end,'Created automatically from booking '||b.booking_code,auth.uid());
      end if;
    elsif v_kind='accessory' then
      select id into v_line_id from public.booking_accessories where booking_id=b.id and accessory_id=v_asset_id for update;
      if v_line_id is null then raise exception 'Accessory % is not assigned to this booking',v_asset_id; end if;
      update public.booking_accessories set condition_in=v_condition where id=v_line_id;
      update public.accessories set status=case when v_condition in ('good','fair') then 'available'::public.asset_status else 'maintenance'::public.asset_status end,updated_at=now() where id=v_asset_id;
      if v_path is not null then
        insert into public.evidence(booking_id,accessory_id,evidence_type,file_path,captured_by)
        values(b.id,v_asset_id,case when v_condition in ('damaged','missing') then 'damage'::public.evidence_type else 'condition'::public.evidence_type end,v_path,auth.uid());
      end if;
      if v_condition in ('damaged','missing') and not exists(select 1 from public.maintenance where accessory_id=v_asset_id and status in ('scheduled','in_progress')) then
        insert into public.maintenance(accessory_id,status,start_at,reason,notes,created_by)
        values(v_asset_id,'scheduled',now(),case when v_condition='missing' then 'Asset reported missing on return' else 'Damage reported on return' end,'Created automatically from booking '||b.booking_code,auth.uid());
      end if;
    else
      raise exception 'Invalid asset kind: %',coalesce(v_kind,'');
    end if;
  end loop;

  v_rental:=coalesce(b.quoted_total_inr,0);
  v_balance:=greatest(0,v_rental+coalesce(p_damage_inr,0)+coalesce(p_late_inr,0)+coalesce(p_other_inr,0)-coalesce(p_paid_inr,0));
  v_payment_status:=case when v_balance<=0 then 'paid'::public.payment_status when coalesce(p_paid_inr,0)>0 then 'partial'::public.payment_status else 'pending'::public.payment_status end;
  v_notes:=nullif(trim(coalesce(p_notes,'')),'');
  if v_has_damage then v_notes:=concat_ws(E'\n',v_notes,'One or more owned assets were marked damaged/missing and moved to maintenance.'); end if;

  update public.bookings set status='returned',returned_at=now(),amount_received_inr=coalesce(p_paid_inr,0),payment_status=v_payment_status,updated_at=now() where id=b.id;

  insert into public.receipts(booking_id,customer_id,rental_amount_inr,damage_charges_inr,late_charges_inr,other_charges_inr,amount_paid_inr,balance_inr,payment_method,payment_reference,return_notes,issued_by)
  values(b.id,b.customer_id,v_rental,coalesce(p_damage_inr,0),coalesce(p_late_inr,0),coalesce(p_other_inr,0),coalesce(p_paid_inr,0),v_balance,nullif(trim(coalesce(p_payment_method,'')),''),nullif(trim(coalesce(p_payment_reference,'')),''),v_notes,auth.uid())
  on conflict(booking_id) do update set
    customer_id=excluded.customer_id,rental_amount_inr=excluded.rental_amount_inr,damage_charges_inr=excluded.damage_charges_inr,
    late_charges_inr=excluded.late_charges_inr,other_charges_inr=excluded.other_charges_inr,amount_paid_inr=excluded.amount_paid_inr,
    balance_inr=excluded.balance_inr,payment_method=excluded.payment_method,payment_reference=excluded.payment_reference,
    return_notes=excluded.return_notes,issued_by=excluded.issued_by,issued_at=now()
  returning id,receipt_code into v_receipt_id,v_receipt_code;

  return jsonb_build_object('booking_id',b.id,'status','returned','receipt_id',v_receipt_id,'receipt_code',v_receipt_code,'rental_inr',v_rental,'balance_inr',v_balance,'payment_status',v_payment_status,'asset_count',v_expected);
end $$;

revoke execute on function public.checkout_booking_atomic(uuid,jsonb) from anon, public;
revoke execute on function public.return_booking_atomic(uuid,jsonb,numeric,numeric,numeric,numeric,text,text,text) from anon, public;
grant execute on function public.checkout_booking_atomic(uuid,jsonb) to authenticated;
grant execute on function public.return_booking_atomic(uuid,jsonb,numeric,numeric,numeric,numeric,text,text,text) to authenticated;
