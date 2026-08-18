-- V6.4: staff can read payment/history tables; writes go through controlled SECURITY DEFINER RPCs.
drop policy if exists staff_payments on public.payments;
drop policy if exists v63_staff_payments on public.payments;
create policy v64_staff_payments_read on public.payments for select to authenticated using(public.is_active_staff());

drop policy if exists admin_audit on public.audit_log;
drop policy if exists v63_staff_audit_log on public.audit_log;
create policy v64_staff_audit_read on public.audit_log for select to authenticated using(public.is_active_staff());
