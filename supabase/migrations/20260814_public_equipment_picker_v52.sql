-- Already applied to the Sri Cine Hub Supabase project. Kept here for source control/reproducibility.
create or replace function public.public_equipment_availability(
  p_start timestamptz,
  p_end timestamptz
)
returns table(
  asset_type text,
  asset_id uuid,
  name text,
  category text,
  brand text,
  model text,
  available boolean
)
language sql
stable
security definer
set search_path=public
as $$
  select 'camera'::text,c.id,c.name,'Camera'::text,c.manufacturer,c.model,
         public.camera_is_available(c.id,p_start,p_end,null)
  from public.cameras c
  where c.public_visible=true and c.status<>'retired'
  union all
  select 'accessory'::text,a.id,a.name,a.category,null::text,null::text,
         public.accessory_is_available(a.id,p_start,p_end,null)
  from public.accessories a
  where a.public_visible=true and a.status<>'retired'
  order by 4,3;
$$;
revoke all on function public.public_equipment_availability(timestamptz,timestamptz) from public;
grant execute on function public.public_equipment_availability(timestamptz,timestamptz) to anon, authenticated;
