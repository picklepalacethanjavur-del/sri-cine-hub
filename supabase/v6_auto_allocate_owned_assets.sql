-- V6: quotations reference canonical owned models; exact physical assets are allocated at booking conversion.
create or replace function public.convert_quotation_to_booking_atomic(p_quotation_id uuid)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare
  q public.quotations%rowtype; r public.quote_requests%rowtype; v_booking_id uuid:=gen_random_uuid();
  v_booking_code text:='BK-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_role public.user_role; rec record; asset record; needed integer; allocated integer;
  v_camera_charge numeric:=0; v_accessory_charge numeric:=0; v_other_charge numeric:=0;
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

  -- Explicit legacy physical links still work.
  insert into tmp_q_cameras(camera_id,daily_rate)
  select item_id,max(unit_rate_inr) from public.quotation_items
  where quotation_id=q.id and source_type='own' and item_type='camera' and item_id is not null group by item_id;
  insert into tmp_q_accessories(accessory_id,quantity,daily_rate)
  select item_id,greatest(1,round(sum(quantity))::int),max(unit_rate_inr) from public.quotation_items
  where quotation_id=q.id and source_type='own' and item_type='accessory' and item_id is not null group by item_id;

  -- V6 canonical camera lines: allocate exact physical bodies only when the quote is accepted.
  for rec in select id,catalog_item_id,quantity,unit_rate_inr,description from public.quotation_items
             where quotation_id=q.id and source_type='own' and item_type='camera' and item_id is null and catalog_item_id is not null and quantity>0
  loop
    needed:=ceil(rec.quantity)::int; allocated:=0;
    for asset in select c.id from public.cameras c
                 where c.catalog_item_id=rec.catalog_item_id and c.status='available'
                   and not exists(select 1 from tmp_q_cameras t where t.camera_id=c.id)
                   and public.camera_is_available(c.id,r.start_at,r.end_at,null)
                 order by c.camera_code for update of c
    loop
      exit when allocated>=needed;
      insert into tmp_q_cameras(camera_id,daily_rate) values(asset.id,rec.unit_rate_inr) on conflict do nothing;
      allocated:=allocated+1;
    end loop;
    if allocated<needed then raise exception 'Not enough owned camera units available for % (need %, found %)',coalesce(rec.description,'camera'),needed,allocated; end if;
  end loop;

  -- V6 canonical accessory lines: allocate exact physical units at booking conversion.
  for rec in select id,catalog_item_id,quantity,unit_rate_inr,description from public.quotation_items
             where quotation_id=q.id and source_type='own' and item_type='accessory' and item_id is null and catalog_item_id is not null and quantity>0
  loop
    needed:=ceil(rec.quantity)::int; allocated:=0;
    for asset in select a.id from public.accessories a
                 where a.catalog_item_id=rec.catalog_item_id and a.status='available'
                   and not exists(select 1 from tmp_q_accessories t where t.accessory_id=a.id)
                   and public.accessory_is_available(a.id,r.start_at,r.end_at,null)
                 order by a.accessory_code for update of a
    loop
      exit when allocated>=needed;
      insert into tmp_q_accessories(accessory_id,quantity,daily_rate) values(asset.id,1,rec.unit_rate_inr) on conflict do nothing;
      allocated:=allocated+1;
    end loop;
    if allocated<needed then raise exception 'Not enough owned accessory units available for % (need %, found %)',coalesce(rec.description,'accessory'),needed,allocated; end if;
  end loop;

  -- Kits still expand to their physical contents.
  insert into tmp_q_cameras(camera_id,daily_rate)
  select distinct eki.camera_id,0 from public.quotation_items qi join public.equipment_kit_items eki on eki.kit_id=qi.item_id
  where qi.quotation_id=q.id and qi.source_type='own' and qi.item_type='kit' and eki.camera_id is not null on conflict(camera_id) do nothing;
  insert into tmp_q_accessories(accessory_id,quantity,daily_rate)
  select eki.accessory_id,sum(greatest(1,eki.quantity))::int,0 from public.quotation_items qi join public.equipment_kit_items eki on eki.kit_id=qi.item_id
  where qi.quotation_id=q.id and qi.source_type='own' and qi.item_type='kit' and eki.accessory_id is not null group by eki.accessory_id
  on conflict(accessory_id) do update set quantity=greatest(tmp_q_accessories.quantity,excluded.quantity);

  -- Recheck every exact asset before final insert.
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
