-- =====================================================================
--  DELÍCIAS DA RÊ — Migração 005: recheio em camadas, embalagens e segurança
--  Supabase > SQL Editor > cole tudo > Run.
--  NÃO apaga nada. Pode rodar mais de uma vez sem problema.
--  Precisa da 004_ingredientes.sql antes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. INGREDIENTES: tipo (ingrediente, embalagem ou outro)
--    Embalagem também é "comprada em pacote": 50 caixinhas por R$ 30.
-- ---------------------------------------------------------------------
alter table public.ingredients
  add column if not exists kind text not null default 'ingrediente';
do $$ begin
  alter table public.ingredients add constraint ingredients_kind_chk check (kind in ('ingrediente', 'embalagem', 'outro'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. PRODUTOS: embalagens/itens comprados usados por UNIDADE vendida
--    (não divide pelo rendimento da receita)
--    packaging = [{"ingredient_id":"…","qty":1,"unit":"un"}]
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists packaging jsonb not null default '[]'::jsonb;
do $$ begin
  alter table public.products add constraint products_packaging_chk check (jsonb_typeof(packaging) = 'array');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 3. LISTAS DE SABORES: preço do kg do bolo com recheio desta lista
--    Bolo com 1 camada tradicional + 1 especial = média dos dois preços.
-- ---------------------------------------------------------------------
alter table public.option_lists
  add column if not exists price_per_kg numeric(10,2);
do $$ begin
  alter table public.option_lists add constraint option_lists_price_chk check (price_per_kg is null or price_per_kg >= 0);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 4. BOLO SOB ENCOMENDA (cria uma vez só)
--    Junta "Bolo com Recheio Tradicional" e "Bolo com Recheio Especial"
--    num produto com 2 camadas de recheio. Os dois antigos ficam pausados
--    (não são apagados: pedidos antigos continuam iguais, dá para reativar).
-- ---------------------------------------------------------------------
do $$
declare
  v_trad    uuid;
  v_esp     uuid;
  v_massa   uuid;
  v_adic    uuid;
  v_ptrad   uuid;
  v_pesp    uuid;
  v_price_t numeric;
  v_price_e numeric;
  v_groups  jsonb := '[]'::jsonb;
begin
  if exists (select 1 from public.products where name = 'Bolo sob encomenda') then return; end if;

  select id into v_trad  from public.option_lists where name = 'Recheios tradicionais';
  select id into v_esp   from public.option_lists where name = 'Recheios especiais';
  if v_trad is null or v_esp is null then return; end if;
  select id into v_massa from public.option_lists where name = 'Massas de bolo';
  select id into v_adic  from public.option_lists where name = 'Adicionais';

  select id, price into v_ptrad, v_price_t from public.products where name = 'Bolo com Recheio Tradicional' order by created_at limit 1;
  select id, price into v_pesp,  v_price_e from public.products where name = 'Bolo com Recheio Especial'   order by created_at limit 1;

  update public.option_lists set price_per_kg = coalesce(price_per_kg, v_price_t, 65) where id = v_trad;
  update public.option_lists set price_per_kg = coalesce(price_per_kg, v_price_e, 80) where id = v_esp;

  if v_massa is not null then
    v_groups := v_groups || jsonb_build_array(jsonb_build_object('label', 'Massa', 'list_id', v_massa, 'required', true, 'multi', false));
  end if;
  v_groups := v_groups || jsonb_build_array(jsonb_build_object(
    'label', 'Recheio', 'kind', 'layers', 'layers', 2,
    'list_id', v_trad, 'list_ids', jsonb_build_array(v_trad, v_esp),
    'required', true, 'multi', false));
  if v_adic is not null then
    v_groups := v_groups || jsonb_build_array(jsonb_build_object('label', 'Adicionais', 'list_id', v_adic, 'required', false, 'multi', true));
  end if;

  insert into public.products
    (name, category, description, price, unit, price_is_from, option_groups,
     cost, cost_items, recipe, recipe_yield, margin_pct, margin_mode, price_auto, price_rounding, sort_order)
  select
    'Bolo sob encomenda', 'bolos',
    'Bolo de festa por quilo com 2 camadas de recheio: iguais ou diferentes (tradicional, especial ou uma de cada).',
    least(coalesce(v_price_t, 65), coalesce(v_price_e, 80)), 'kg', true, v_groups,
    coalesce(t.cost, 0), coalesce(t.cost_items, '[]'::jsonb), coalesce(t.recipe, '[]'::jsonb), coalesce(t.recipe_yield, 1),
    coalesce(t.margin_pct, 100), coalesce(t.margin_mode, 'markup'), false, 0.5, 5
  from (select 1) x
  left join public.products t on t.id = v_ptrad;

  update public.products set is_active = false where id in (v_ptrad, v_pesp);
end $$;

-- ---------------------------------------------------------------------
-- 5. SEGURANÇA E DESEMPENHO (avisos do Security/Performance Advisor)
-- ---------------------------------------------------------------------
-- 5a. Políticas: "(select …)" faz a checagem de acesso rodar 1 vez por consulta,
--     não 1 vez por linha (aviso "auth_rls_initplan"). Mesma regra de antes.
do $$
declare t text;
begin
  foreach t in array array['allowed_emails', 'customers', 'option_lists', 'option_items', 'products',
                           'orders', 'order_items', 'expenses', 'ingredients']
  loop
    execute format('drop policy if exists "equipe: tudo" on public.%I', t);
    execute format('create policy "equipe: tudo" on public.%I for all to authenticated
                      using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

drop policy if exists "profiles: próprio ou equipe" on public.profiles;
create policy "profiles: próprio ou equipe" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "profiles: editar próprio" on public.profiles;
create policy "profiles: editar próprio" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 5b. Índices nas chaves estrangeiras que não tinham (aviso "unindexed foreign keys")
create index if not exists order_items_product_idx on public.order_items (product_id);
create index if not exists orders_created_by_idx   on public.orders (created_by);
create index if not exists expenses_created_by_idx on public.expenses (created_by);

-- 5c. Visitante anônimo não recebe acesso automático a tabelas/funções novas
--     (por padrão o Supabase concede; o RLS já bloqueava, isto é uma 2ª trava)
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- 5d. Garante as permissões de quem está logado nas colunas/tabelas novas
grant select, insert, update, delete on public.ingredients to authenticated;
