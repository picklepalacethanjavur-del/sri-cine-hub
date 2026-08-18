-- V6.3 defense-in-depth: active roles and explicit function ACLs.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path=public
as $$
  select role
  from public.profiles
  where id=auth.uid() and is_active=true
$$;

-- Supabase may have explicit anon EXECUTE grants from project defaults; remove them
-- from all staff-only RPCs. Public quote/availability RPCs remain public intentionally.
revoke execute on function public.is_active_staff() from anon, public;
revoke execute on function public.staff_create_quote_request(text,text,text,text,timestamptz,timestamptz,text) from anon, public;
revoke execute on function public.staff_add_quote_request_attachment(uuid,text,text,text,bigint) from anon, public;
revoke execute on function public.staff_delete_quote_request_attachment(uuid) from anon, public;
revoke execute on function public.create_quotation_atomic(uuid,text,date,numeric,numeric,numeric,text,text,jsonb) from anon, public;
revoke execute on function public.save_quotation_atomic(uuid,text,numeric,numeric,numeric,text,text,jsonb) from anon, public;
revoke execute on function public.convert_quotation_to_booking_atomic(uuid) from anon, public;
revoke execute on function public.set_quotation_status(uuid,text) from anon, public;
revoke execute on function public.create_supplier_rfq(uuid,uuid,uuid,text,timestamptz,timestamptz,text,jsonb) from anon, public;
revoke execute on function public.sync_overdue_bookings() from anon, public;

grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.staff_create_quote_request(text,text,text,text,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.staff_add_quote_request_attachment(uuid,text,text,text,bigint) to authenticated;
grant execute on function public.staff_delete_quote_request_attachment(uuid) to authenticated;
grant execute on function public.create_quotation_atomic(uuid,text,date,numeric,numeric,numeric,text,text,jsonb) to authenticated;
grant execute on function public.save_quotation_atomic(uuid,text,numeric,numeric,numeric,text,text,jsonb) to authenticated;
grant execute on function public.convert_quotation_to_booking_atomic(uuid) to authenticated;
grant execute on function public.set_quotation_status(uuid,text) to authenticated;
grant execute on function public.create_supplier_rfq(uuid,uuid,uuid,text,timestamptz,timestamptz,text,jsonb) to authenticated;
grant execute on function public.sync_overdue_bookings() to authenticated;
