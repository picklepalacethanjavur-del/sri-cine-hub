-- V6.4 controlled corrections for operational evidence fields.
create or replace function public.correct_checkout_asset(p_booking_id uuid,p_kind text,p_asset_id uuid,p_hours numeric,p_condition text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.bookings%rowtype;oldj jsonb;newj jsonb;v_return numeric;
begin
 if not public.is_active_staff() then raise exception 'Staff access required';end if;
 if char_length(trim(coalesce(p_reason,'')))<4 then raise exception 'Correction reason is required';end if;
 select * into b from public.bookings where id=p_booking_id for update;if not found then raise exception 'Booking not found';end if;
 if b.status not in ('checked_out','overdue','returned','closed') then raise exception 'Checkout correction is only available after checkout';end if;
 if coalesce(p_condition,'') not in ('good','fair','damaged') then raise exception 'Invalid checkout condition';end if;
 if p_kind='camera' then
   if coalesce(p_hours,-1)<0 then raise exception 'Valid camera hours are required';end if;
   select to_jsonb(bc),bc.return_hours into oldj,v_return from public.booking_cameras bc where bc.booking_id=p_booking_id and bc.camera_id=p_asset_id for update;if oldj is null then raise exception 'Camera is not assigned to this booking';end if;
   if v_return is not null and p_hours>v_return then raise exception 'Checkout hours cannot exceed recorded return hours';end if;
   update public.booking_cameras set checkout_hours=p_hours,condition_out=p_condition where booking_id=p_booking_id and camera_id=p_asset_id returning to_jsonb(booking_cameras.*) into newj;
   if b.status in ('checked_out','overdue') then update public.cameras set current_hours=p_hours,updated_at=now() where id=p_asset_id;end if;
 elsif p_kind='accessory' then
   select to_jsonb(ba) into oldj from public.booking_accessories ba where ba.booking_id=p_booking_id and ba.accessory_id=p_asset_id for update;if oldj is null then raise exception 'Accessory is not assigned to this booking';end if;
   update public.booking_accessories set condition_out=p_condition where booking_id=p_booking_id and accessory_id=p_asset_id returning to_jsonb(booking_accessories.*) into newj;
 else raise exception 'Invalid asset kind';end if;
 insert into public.audit_log(actor_id,action,entity_type,entity_id,old_data,new_data) values(auth.uid(),'checkout_record_corrected','booking',p_booking_id,oldj,newj||jsonb_build_object('kind',p_kind,'asset_id',p_asset_id,'reason',trim(p_reason)));
 return jsonb_build_object('booking_id',p_booking_id,'kind',p_kind,'asset_id',p_asset_id,'corrected',true);
end $$;
revoke execute on function public.correct_checkout_asset(uuid,text,uuid,numeric,text,text) from anon,public;grant execute on function public.correct_checkout_asset(uuid,text,uuid,numeric,text,text) to authenticated;

create or replace function public.correct_return_asset(p_booking_id uuid,p_kind text,p_asset_id uuid,p_hours numeric,p_condition text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.bookings%rowtype;oldj jsonb;newj jsonb;v_checkout numeric;v_auto_note text;
begin
 if not public.is_active_staff() then raise exception 'Staff access required';end if;
 if char_length(trim(coalesce(p_reason,'')))<4 then raise exception 'Correction reason is required';end if;
 select * into b from public.bookings where id=p_booking_id for update;if not found then raise exception 'Booking not found';end if;
 if b.status not in ('returned','closed') then raise exception 'Return correction is available only after return';end if;
 if coalesce(p_condition,'') not in ('good','fair','damaged','missing') then raise exception 'Invalid return condition';end if;
 v_auto_note:='Created automatically from booking '||b.booking_code;
 if p_kind='camera' then
   select to_jsonb(bc),bc.checkout_hours into oldj,v_checkout from public.booking_cameras bc where bc.booking_id=p_booking_id and bc.camera_id=p_asset_id for update;if oldj is null then raise exception 'Camera is not assigned to this booking';end if;
   if coalesce(p_hours,-1)<coalesce(v_checkout,0) then raise exception 'Return hours cannot be lower than checkout hours';end if;
   update public.booking_cameras set return_hours=p_hours,condition_in=p_condition where booking_id=p_booking_id and camera_id=p_asset_id returning to_jsonb(booking_cameras.*) into newj;
   update public.cameras set current_hours=p_hours,status=case when p_condition in ('good','fair') then 'available'::public.asset_status else 'maintenance'::public.asset_status end,updated_at=now() where id=p_asset_id;
   if p_condition in ('damaged','missing') then
     if not exists(select 1 from public.maintenance where camera_id=p_asset_id and status in ('scheduled','in_progress')) then insert into public.maintenance(camera_id,status,start_at,reason,notes,created_by) values(p_asset_id,'scheduled',now(),case when p_condition='missing' then 'Asset reported missing on corrected return' else 'Damage reported on corrected return' end,v_auto_note,auth.uid());end if;
   else update public.maintenance set status='cancelled',end_at=now(),notes=concat_ws(E'\n',notes,'Auto-maintenance cancelled by return correction: '||trim(p_reason)) where camera_id=p_asset_id and status='scheduled' and notes=v_auto_note;end if;
 elsif p_kind='accessory' then
   select to_jsonb(ba) into oldj from public.booking_accessories ba where ba.booking_id=p_booking_id and ba.accessory_id=p_asset_id for update;if oldj is null then raise exception 'Accessory is not assigned to this booking';end if;
   update public.booking_accessories set condition_in=p_condition where booking_id=p_booking_id and accessory_id=p_asset_id returning to_jsonb(booking_accessories.*) into newj;
   update public.accessories set status=case when p_condition in ('good','fair') then 'available'::public.asset_status else 'maintenance'::public.asset_status end,updated_at=now() where id=p_asset_id;
   if p_condition in ('damaged','missing') then if not exists(select 1 from public.maintenance where accessory_id=p_asset_id and status in ('scheduled','in_progress')) then insert into public.maintenance(accessory_id,status,start_at,reason,notes,created_by) values(p_asset_id,'scheduled',now(),case when p_condition='missing' then 'Asset reported missing on corrected return' else 'Damage reported on corrected return' end,v_auto_note,auth.uid());end if;
   else update public.maintenance set status='cancelled',end_at=now(),notes=concat_ws(E'\n',notes,'Auto-maintenance cancelled by return correction: '||trim(p_reason)) where accessory_id=p_asset_id and status='scheduled' and notes=v_auto_note;end if;
 else raise exception 'Invalid asset kind';end if;
 insert into public.audit_log(actor_id,action,entity_type,entity_id,old_data,new_data) values(auth.uid(),'return_record_corrected','booking',p_booking_id,oldj,newj||jsonb_build_object('kind',p_kind,'asset_id',p_asset_id,'reason',trim(p_reason)));
 return jsonb_build_object('booking_id',p_booking_id,'kind',p_kind,'asset_id',p_asset_id,'corrected',true);
end $$;
revoke execute on function public.correct_return_asset(uuid,text,uuid,numeric,text,text) from anon,public;grant execute on function public.correct_return_asset(uuid,text,uuid,numeric,text,text) to authenticated;

create or replace function public.audit_workflow_status_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.status is distinct from new.status then insert into public.audit_log(actor_id,action,entity_type,entity_id,old_data,new_data) values(auth.uid(),tg_table_name||'_status_changed',tg_table_name,new.id,jsonb_build_object('status',old.status),jsonb_build_object('status',new.status));end if;return new;
end $$;
drop trigger if exists trg_audit_quotation_status on public.quotations;create trigger trg_audit_quotation_status after update of status on public.quotations for each row execute function public.audit_workflow_status_change();
drop trigger if exists trg_audit_booking_status on public.bookings;create trigger trg_audit_booking_status after update of status on public.bookings for each row execute function public.audit_workflow_status_change();
