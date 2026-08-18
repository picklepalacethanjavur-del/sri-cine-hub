-- V6.3: close unused legacy RPCs while preserving current public quote APIs.
revoke execute on function public.public_camera_availability(timestamptz,timestamptz) from anon, authenticated, public;
revoke execute on function public.public_quote_catalog(timestamptz,timestamptz) from anon, authenticated, public;
revoke execute on function public.submit_quote_request(text,text,text,text,timestamptz,timestamptz,uuid[],text) from anon, authenticated, public;
revoke execute on function public.camera_is_available(uuid,timestamptz,timestamptz,uuid) from anon, public;
grant execute on function public.camera_is_available(uuid,timestamptz,timestamptz,uuid) to authenticated;
