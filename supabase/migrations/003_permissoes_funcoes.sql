-- Migração 003: fecha funções internas para quem não está logado (aviso do Security Advisor).
-- Não apaga nada. Pode rodar mais de uma vez.
revoke execute on function public.check_signup_allowed() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.save_order(jsonb, jsonb) from public, anon;
grant execute on function public.save_order(jsonb, jsonb) to authenticated;
