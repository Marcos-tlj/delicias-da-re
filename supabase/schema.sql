-- =====================================================================
--  DELÍCIAS DA RÊ — Plataforma interna de pedidos, estoque e lucro (v3)
--  Supabase > SQL Editor > cole tudo > Run.
--  ATENÇÃO: a seção 0 apaga as tabelas do app e recria do zero.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. LIMPEZA (versão 1 e reexecuções)
-- ---------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists before_auth_user_created on auth.users;
drop table if exists public.ingredients cascade;
drop table if exists public.expenses cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.products cascade;
drop table if exists public.option_items cascade;
drop table if exists public.option_lists cascade;
drop table if exists public.customers cascade;
drop table if exists public.profiles cascade;
drop table if exists public.allowed_emails cascade;
drop type if exists public.order_status cascade;
drop function if exists public.place_order(jsonb, text, text, text, text, jsonb, text, timestamptz) cascade;
drop function if exists public.save_order(jsonb, jsonb) cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.check_signup_allowed() cascade;
drop function if exists public.touch_updated_at() cascade;
drop function if exists public.order_items_stock_insert() cascade;
drop function if exists public.order_items_stock_delete() cascade;
drop function if exists public.orders_stock_before_delete() cascade;
drop function if exists public.orders_stock_status_change() cascade;

-- ---------------------------------------------------------------------
-- 1. ACESSO: só e-mails autorizados conseguem criar conta
-- ---------------------------------------------------------------------
create table public.allowed_emails (
  email       text primary key check (email = lower(btrim(email)) and email like '%@%'),
  created_at  timestamptz not null default now()
);

insert into public.allowed_emails (email) values ('lopestmarcos@gmail.com');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Bloqueia o cadastro de qualquer e-mail fora da lista
create or replace function public.check_signup_allowed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.allowed_emails a where a.email = lower(new.email)) then
    raise exception 'EMAIL_NAO_AUTORIZADO';
  end if;
  return new;
end;
$$;

create trigger before_auth_user_created
  before insert on auth.users
  for each row execute function public.check_signup_allowed();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    lower(new.email),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuários que já existiam
insert into public.profiles (id, full_name, email, is_admin)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'), lower(u.email),
       exists (select 1 from public.allowed_emails a where a.email = lower(u.email))
from auth.users u
on conflict (id) do nothing;

-- Tem acesso = profile admin E e-mail ainda autorizado (remover o e-mail corta o acesso na hora)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.allowed_emails a on a.email = lower(p.email)
    where p.id = auth.uid() and p.is_admin
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. CLIENTES
-- ---------------------------------------------------------------------
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  phone         text,
  email         text,
  address       text,
  neighborhood  text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index customers_name_idx on public.customers (lower(name));
create index customers_phone_idx on public.customers (phone);
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. SABORES E OPÇÕES (listas reutilizáveis: massas, recheios, coberturas…)
-- ---------------------------------------------------------------------
create table public.option_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(btrim(name)) between 1 and 60),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.option_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.option_lists (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  unique (list_id, name)
);
create index option_items_list_idx on public.option_items (list_id, sort_order);

-- ---------------------------------------------------------------------
-- 4. PRODUTOS + ESTOQUE
-- ---------------------------------------------------------------------
create table public.products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(btrim(name)) between 1 and 80),
  category       text not null default 'bolos' check (category in ('bolos', 'doces', 'tortas', 'outros')),
  description    text,
  price          numeric(10,2) not null default 0 check (price >= 0),
  unit           text not null default 'un' check (unit in ('un', 'kg')),
  price_is_from  boolean not null default false,
  -- [{"label":"Recheio","list_id":"…","required":true,"multi":false}]
  option_groups  jsonb not null default '[]'::jsonb check (jsonb_typeof(option_groups) = 'array'),
  is_active      boolean not null default true,
  stock_enabled  boolean not null default false,   -- controla "prontos para venda"
  stock_qty      numeric(8,2) not null default 0 check (stock_qty >= 0),
  stock_min      numeric(8,2) not null default 0 check (stock_min >= 0),
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index products_category_idx on public.products (category, sort_order);
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 5. PEDIDOS
-- ---------------------------------------------------------------------
create type public.order_status as enum
  ('novo', 'confirmado', 'em_preparo', 'pronto', 'entregue', 'cancelado');

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  code            bigint generated always as identity,
  customer_id     uuid references public.customers (id) on delete set null,
  customer_name   text not null,
  customer_phone  text,
  status          public.order_status not null default 'novo',
  delivery_type   text not null default 'retirada' check (delivery_type in ('retirada', 'entrega')),
  address         text,
  due_at          timestamptz,                         -- data/hora de entrega ou retirada
  payment_method  text check (payment_method in ('pix', 'cartao', 'dinheiro', 'outro')),
  amount_paid     numeric(10,2) not null default 0 check (amount_paid >= 0),
  subtotal        numeric(10,2) not null default 0 check (subtotal >= 0),
  delivery_fee    numeric(10,2) not null default 0 check (delivery_fee >= 0),
  discount        numeric(10,2) not null default 0 check (discount >= 0),
  total           numeric(10,2) not null default 0 check (total >= 0),
  payment_status  text generated always as (
                    case when amount_paid >= total then 'pago'
                         when amount_paid > 0 then 'parcial'
                         else 'pendente' end
                  ) stored,
  notes           text,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index orders_due_idx      on public.orders (due_at);
create index orders_status_idx   on public.orders (status);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_items (
  id            bigint generated always as identity primary key,
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  product_name  text not null,
  unit          text not null default 'un',
  unit_price    numeric(10,2) not null check (unit_price >= 0),
  quantity      numeric(8,2) not null check (quantity > 0),
  options       jsonb not null default '{}'::jsonb,
  note          text,
  line_total    numeric(10,2) not null,
  from_stock    boolean not null default false,   -- baixou do estoque?
  sort_order    int not null default 0
);
create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------
-- 6. ESTOQUE AUTOMÁTICO
--    Item de pedido (não cancelado) de produto com estoque => dá baixa.
--    Cancelar / excluir / editar o pedido => devolve ao estoque.
-- ---------------------------------------------------------------------
create or replace function public.order_items_stock_insert()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_status public.order_status;
  v_prod   record;
begin
  select status into v_status from public.orders where id = new.order_id;
  if v_status is distinct from 'cancelado' and new.product_id is not null then
    select name, stock_enabled, stock_qty into v_prod
      from public.products where id = new.product_id for update;
    if found and v_prod.stock_enabled then
      if v_prod.stock_qty < new.quantity then
        raise exception 'Estoque insuficiente de "%": restam %.', v_prod.name, v_prod.stock_qty;
      end if;
      update public.products set stock_qty = stock_qty - new.quantity where id = new.product_id;
      new.from_stock := true;
    end if;
  end if;
  return new;
end;
$$;

create trigger order_items_stock_ins before insert on public.order_items
  for each row execute function public.order_items_stock_insert();

create or replace function public.order_items_stock_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Se o pedido inteiro está sendo excluído, o trigger do pedido já devolveu.
  if old.from_stock and old.product_id is not null
     and exists (select 1 from public.orders where id = old.order_id) then
    update public.products set stock_qty = stock_qty + old.quantity where id = old.product_id;
  end if;
  return old;
end;
$$;

create trigger order_items_stock_del after delete on public.order_items
  for each row execute function public.order_items_stock_delete();

create or replace function public.orders_stock_before_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.products p
     set stock_qty = p.stock_qty + x.q
    from (select product_id, sum(quantity) q from public.order_items
           where order_id = old.id and from_stock and product_id is not null
           group by product_id) x
   where p.id = x.product_id;
  return old;
end;
$$;

create trigger orders_stock_del before delete on public.orders
  for each row execute function public.orders_stock_before_delete();

create or replace function public.orders_stock_status_change()
returns trigger language plpgsql set search_path = '' as $$
declare
  r record;
begin
  if old.status <> 'cancelado' and new.status = 'cancelado' then
    update public.products p
       set stock_qty = p.stock_qty + x.q
      from (select product_id, sum(quantity) q from public.order_items
             where order_id = new.id and from_stock and product_id is not null
             group by product_id) x
     where p.id = x.product_id;
    update public.order_items set from_stock = false where order_id = new.id and from_stock;

  elsif old.status = 'cancelado' and new.status <> 'cancelado' then
    for r in
      select i.id, i.quantity, p.id as pid, p.name, p.stock_qty
        from public.order_items i
        join public.products p on p.id = i.product_id
       where i.order_id = new.id and p.stock_enabled
       for update of p
    loop
      if r.stock_qty < r.quantity then
        raise exception 'Estoque insuficiente de "%": restam %.', r.name, r.stock_qty;
      end if;
      update public.products set stock_qty = stock_qty - r.quantity where id = r.pid;
      update public.order_items set from_stock = true where id = r.id;
    end loop;
  end if;
  return new;
end;
$$;

create trigger orders_stock_status after update of status on public.orders
  for each row execute function public.orders_stock_status_change();

-- ---------------------------------------------------------------------
-- 7. SALVAR PEDIDO (criar ou editar) em uma única transação
-- ---------------------------------------------------------------------
create or replace function public.save_order(p_order jsonb, p_items jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_id          uuid := nullif(p_order ->> 'id', '')::uuid;
  v_customer    uuid := nullif(p_order ->> 'customer_id', '')::uuid;
  v_name        text := nullif(btrim(p_order ->> 'customer_name'), '');
  v_phone       text := nullif(btrim(p_order ->> 'customer_phone'), '');
  v_fee         numeric := round(coalesce((p_order ->> 'delivery_fee')::numeric, 0), 2);
  v_discount    numeric := round(coalesce((p_order ->> 'discount')::numeric, 0), 2);
  v_paid        numeric := round(coalesce((p_order ->> 'amount_paid')::numeric, 0), 2);
  v_subtotal    numeric := 0;
  v_item        jsonb;
  v_idx         int := 0;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione pelo menos um item ao pedido.';
  end if;

  -- Cliente: existente ou cadastra na hora
  if v_customer is not null then
    select name, coalesce(v_phone, phone) into v_name, v_phone from public.customers where id = v_customer;
    if not found then raise exception 'Cliente não encontrado.'; end if;
  elsif v_name is not null then
    insert into public.customers (name, phone, address)
    values (v_name, v_phone, nullif(btrim(p_order ->> 'address'), ''))
    returning id into v_customer;
  else
    raise exception 'Informe o cliente.';
  end if;

  select coalesce(sum(round((i ->> 'unit_price')::numeric * (i ->> 'quantity')::numeric, 2)), 0)
    into v_subtotal from jsonb_array_elements(p_items) i;

  if v_id is null then
    insert into public.orders (customer_id, customer_name, customer_phone, status)
    values (v_customer, v_name, v_phone, coalesce(nullif(p_order ->> 'status', ''), 'novo')::public.order_status)
    returning id into v_id;
  else
    delete from public.order_items where order_id = v_id;   -- devolve estoque
  end if;

  update public.orders set
    customer_id    = v_customer,
    customer_name  = v_name,
    customer_phone = v_phone,
    delivery_type  = coalesce(nullif(p_order ->> 'delivery_type', ''), 'retirada'),
    address        = nullif(btrim(p_order ->> 'address'), ''),
    due_at         = nullif(p_order ->> 'due_at', '')::timestamptz,
    payment_method = nullif(p_order ->> 'payment_method', ''),
    amount_paid    = v_paid,
    subtotal       = v_subtotal,
    delivery_fee   = v_fee,
    discount       = v_discount,
    total          = greatest(v_subtotal + v_fee - v_discount, 0),
    notes          = nullif(btrim(p_order ->> 'notes'), '')
  where id = v_id;

  if not found then raise exception 'Pedido não encontrado.'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_idx := v_idx + 1;
    if coalesce((v_item ->> 'quantity')::numeric, 0) <= 0 then
      raise exception 'Quantidade inválida em "%".', v_item ->> 'product_name';
    end if;
    insert into public.order_items
      (order_id, product_id, product_name, unit, unit_price, quantity, options, note, line_total, sort_order)
    values (
      v_id,
      nullif(v_item ->> 'product_id', '')::uuid,
      coalesce(nullif(btrim(v_item ->> 'product_name'), ''), 'Item'),
      coalesce(nullif(v_item ->> 'unit', ''), 'un'),
      round((v_item ->> 'unit_price')::numeric, 2),
      (v_item ->> 'quantity')::numeric,
      coalesce(v_item -> 'options', '{}'::jsonb),
      nullif(btrim(v_item ->> 'note'), ''),
      round((v_item ->> 'unit_price')::numeric * (v_item ->> 'quantity')::numeric, 2),
      v_idx
    );
  end loop;

  return v_id;
end;
$$;

revoke all on function public.save_order(jsonb, jsonb) from public, anon;
grant execute on function public.save_order(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY: tudo só para quem tem acesso
-- ---------------------------------------------------------------------
alter table public.allowed_emails enable row level security;
alter table public.profiles       enable row level security;
alter table public.customers      enable row level security;
alter table public.option_lists   enable row level security;
alter table public.option_items   enable row level security;
alter table public.products       enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;

create policy "equipe: tudo" on public.allowed_emails for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "equipe: tudo" on public.customers      for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "equipe: tudo" on public.option_lists   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "equipe: tudo" on public.option_items   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "equipe: tudo" on public.products       for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "equipe: tudo" on public.orders         for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "equipe: tudo" on public.order_items    for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "profiles: próprio ou equipe" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles: editar próprio" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Nada para visitantes anônimos
revoke all on public.allowed_emails, public.profiles, public.customers, public.option_lists,
              public.option_items, public.products, public.orders, public.order_items from anon;
-- Ninguém se autopromove: no perfil, só o nome é editável
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 9. TEMPO REAL (as duas veem as mudanças uma da outra na hora)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.orders, public.products, public.customers;

-- ---------------------------------------------------------------------
-- 10. DADOS INICIAIS (do cardápio impresso)
-- ---------------------------------------------------------------------
insert into public.option_lists (name, sort_order) values
  ('Massas de bolo', 10), ('Recheios tradicionais', 20), ('Recheios especiais', 30),
  ('Adicionais', 40), ('Massas de caseirinho', 50), ('Coberturas de caseirinho', 60);

insert into public.option_items (list_id, name, sort_order)
select l.id, v.name, v.ord
from public.option_lists l
join (values
  ('Massas de bolo', 'Branca', 1), ('Massas de bolo', 'Chocolate', 2),
  ('Recheios tradicionais', 'Abacaxi', 1), ('Recheios tradicionais', 'Beijinho', 2),
  ('Recheios tradicionais', 'Brigadeiro', 3), ('Recheios tradicionais', 'Brigadeiro de Ninho', 4),
  ('Recheios tradicionais', 'Brigadeiro de Maracujá', 5), ('Recheios tradicionais', 'Doce de Leite', 6),
  ('Recheios especiais', 'Alpino', 1), ('Recheios especiais', 'Mousse de Chocolate Meio Amargo', 2),
  ('Recheios especiais', 'Ninho com Morangos', 3), ('Recheios especiais', 'Doce de Leite com Ameixa', 4),
  ('Recheios especiais', 'Doce de Leite com Nozes', 5), ('Recheios especiais', '4 Leites', 6),
  ('Adicionais', 'Morango', 1), ('Adicionais', 'Abacaxi', 2), ('Adicionais', 'Bombom', 3),
  ('Adicionais', 'Nutella', 4), ('Adicionais', 'Creme de Avelã', 5), ('Adicionais', 'Nozes', 6),
  ('Massas de caseirinho', 'Cenoura', 1), ('Massas de caseirinho', 'Chocolate', 2),
  ('Massas de caseirinho', 'Limão', 3), ('Massas de caseirinho', 'Branca', 4),
  ('Coberturas de caseirinho', 'Brigadeiro', 1), ('Coberturas de caseirinho', 'Ninho', 2),
  ('Coberturas de caseirinho', 'Maracujá', 3), ('Coberturas de caseirinho', 'Limão', 4)
) as v(list, name, ord) on v.list = l.name;

insert into public.products (name, category, description, price, unit, price_is_from, option_groups, stock_enabled, sort_order)
select v.name, v.category, v.descr, v.price, v.unit, v.from_, v.groups, v.stock, v.ord
from (values
  ('Bolo com Recheio Tradicional', 'bolos', 'Bolo de festa por quilo.', 65.00, 'kg', false,
    jsonb_build_array(
      jsonb_build_object('label', 'Massa',     'list_id', (select id from public.option_lists where name = 'Massas de bolo'),        'required', true,  'multi', false),
      jsonb_build_object('label', 'Recheio',   'list_id', (select id from public.option_lists where name = 'Recheios tradicionais'), 'required', true,  'multi', false),
      jsonb_build_object('label', 'Adicionais','list_id', (select id from public.option_lists where name = 'Adicionais'),            'required', false, 'multi', true)
    ), false, 10),
  ('Bolo com Recheio Especial', 'bolos', 'Bolo de festa por quilo, recheios especiais.', 80.00, 'kg', false,
    jsonb_build_array(
      jsonb_build_object('label', 'Massa',     'list_id', (select id from public.option_lists where name = 'Massas de bolo'),     'required', true,  'multi', false),
      jsonb_build_object('label', 'Recheio',   'list_id', (select id from public.option_lists where name = 'Recheios especiais'), 'required', true,  'multi', false),
      jsonb_build_object('label', 'Adicionais','list_id', (select id from public.option_lists where name = 'Adicionais'),         'required', false, 'multi', true)
    ), false, 20),
  ('Caseirinho', 'bolos', 'Bolo caseiro com cobertura.', 12.00, 'un', true,
    jsonb_build_array(
      jsonb_build_object('label', 'Massa',     'list_id', (select id from public.option_lists where name = 'Massas de caseirinho'),     'required', true, 'multi', false),
      jsonb_build_object('label', 'Cobertura', 'list_id', (select id from public.option_lists where name = 'Coberturas de caseirinho'), 'required', true, 'multi', false)
    ), false, 30),
  ('Mini Tortinha de Mousse de Maracujá', 'tortas', 'Tortinha individual.', 9.00, 'un', false, '[]'::jsonb, true, 10),
  ('Mini Tortinha de Mousse de Limão',    'tortas', 'Tortinha individual.', 9.00, 'un', false, '[]'::jsonb, true, 20),
  ('Mini Tortinha de Mousse de Morango',  'tortas', 'Tortinha individual.', 9.00, 'un', false, '[]'::jsonb, true, 30)
) as v(name, category, descr, price, unit, from_, groups, stock, ord);

-- =====================================================================
-- Para liberar outro e-mail (ex.: sua mãe), use a tela Configurações
-- do sistema, ou rode:
--   insert into public.allowed_emails (email) values ('email-da-sua-mae@gmail.com');
-- =====================================================================

-- =====================================================================
-- 11. FINANCEIRO (mesmo conteúdo de migrations/002_financeiro.sql)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PRODUTOS: custo de produção e cálculo de preço por margem
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists cost           numeric(10,2) not null default 0,
  add column if not exists cost_items     jsonb         not null default '[]'::jsonb,
  add column if not exists margin_pct     numeric(7,2)  not null default 100,
  add column if not exists margin_mode    text          not null default 'markup',
  add column if not exists price_auto     boolean       not null default false,
  add column if not exists price_rounding numeric(5,2)  not null default 0.5;

do $$ begin
  alter table public.products add constraint products_cost_chk check (cost >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.products add constraint products_margin_chk check (margin_pct >= 0 and margin_pct <= 1000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.products add constraint products_margin_mode_chk check (margin_mode in ('markup', 'margin'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.products add constraint products_cost_items_chk check (jsonb_typeof(cost_items) = 'array');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. ITENS DE PEDIDO: guarda o custo do produto no momento da venda
--    (mudar o custo depois não altera o lucro das vendas antigas)
-- ---------------------------------------------------------------------
alter table public.order_items
  add column if not exists unit_cost numeric(10,2) not null default 0;

-- ---------------------------------------------------------------------
-- 3. PEDIDOS: canal da venda (pedido normal ou venda rápida no balcão)
-- ---------------------------------------------------------------------
alter table public.orders
  add column if not exists sale_channel text not null default 'pedido';
do $$ begin
  alter table public.orders add constraint orders_channel_chk check (sale_channel in ('pedido', 'balcao'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 4. DESPESAS (gás, embalagens, entregas… o que não está no custo do produto)
-- ---------------------------------------------------------------------
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  spent_on     date not null default (now() at time zone 'America/Sao_Paulo')::date,
  description  text not null check (char_length(btrim(description)) between 1 and 120),
  category     text not null default 'outros'
               check (category in ('ingredientes', 'embalagem', 'gas_energia', 'entrega', 'equipamentos', 'divulgacao', 'outros')),
  amount       numeric(10,2) not null check (amount > 0),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists expenses_spent_on_idx on public.expenses (spent_on desc);

alter table public.expenses enable row level security;
drop policy if exists "equipe: tudo" on public.expenses;
create policy "equipe: tudo" on public.expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.expenses from anon;

do $$ begin
  alter publication supabase_realtime add table public.expenses;
exception when duplicate_object then null; end $$;

create index if not exists orders_created_idx on public.orders (created_at);

-- ---------------------------------------------------------------------
-- 5. SALVAR PEDIDO: agora grava o custo de cada item e aceita venda no balcão
-- ---------------------------------------------------------------------
create or replace function public.save_order(p_order jsonb, p_items jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_id          uuid := nullif(p_order ->> 'id', '')::uuid;
  v_customer    uuid := nullif(p_order ->> 'customer_id', '')::uuid;
  v_name        text := nullif(btrim(p_order ->> 'customer_name'), '');
  v_phone       text := nullif(btrim(p_order ->> 'customer_phone'), '');
  v_walk_in     boolean := coalesce((p_order ->> 'walk_in')::boolean, false);
  v_fee         numeric := round(coalesce((p_order ->> 'delivery_fee')::numeric, 0), 2);
  v_discount    numeric := round(coalesce((p_order ->> 'discount')::numeric, 0), 2);
  v_paid        numeric := round(coalesce((p_order ->> 'amount_paid')::numeric, 0), 2);
  v_subtotal    numeric := 0;
  v_old_costs   jsonb := '{}'::jsonb;
  v_item        jsonb;
  v_pid         uuid;
  v_cost        numeric;
  v_idx         int := 0;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione pelo menos um item ao pedido.';
  end if;

  if v_walk_in then
    -- Venda rápida: não cadastra cliente
    v_customer := null;
    v_name := coalesce(v_name, 'Venda no balcão');
  elsif v_customer is not null then
    select name, coalesce(v_phone, phone) into v_name, v_phone from public.customers where id = v_customer;
    if not found then raise exception 'Cliente não encontrado.'; end if;
  elsif v_name is not null then
    insert into public.customers (name, phone, address)
    values (v_name, v_phone, nullif(btrim(p_order ->> 'address'), ''))
    returning id into v_customer;
  else
    raise exception 'Informe o cliente.';
  end if;

  select coalesce(sum(round((i ->> 'unit_price')::numeric * (i ->> 'quantity')::numeric, 2)), 0)
    into v_subtotal from jsonb_array_elements(p_items) i;

  if v_id is null then
    insert into public.orders (customer_id, customer_name, customer_phone, status, sale_channel)
    values (v_customer, v_name, v_phone,
            coalesce(nullif(p_order ->> 'status', ''), 'novo')::public.order_status,
            case when v_walk_in then 'balcao' else 'pedido' end)
    returning id into v_id;
  else
    -- guarda o custo que os itens tinham, para editar sem mudar o lucro antigo
    select coalesce(jsonb_object_agg(product_id::text, unit_cost), '{}'::jsonb) into v_old_costs
      from (select distinct on (product_id) product_id, unit_cost
              from public.order_items
             where order_id = v_id and product_id is not null and unit_cost > 0) x;
    delete from public.order_items where order_id = v_id;   -- devolve estoque
  end if;

  update public.orders set
    customer_id    = v_customer,
    customer_name  = v_name,
    customer_phone = v_phone,
    delivery_type  = coalesce(nullif(p_order ->> 'delivery_type', ''), 'retirada'),
    address        = nullif(btrim(p_order ->> 'address'), ''),
    due_at         = coalesce(nullif(p_order ->> 'due_at', '')::timestamptz, case when v_walk_in then now() end),
    payment_method = nullif(p_order ->> 'payment_method', ''),
    amount_paid    = v_paid,
    subtotal       = v_subtotal,
    delivery_fee   = v_fee,
    discount       = v_discount,
    total          = greatest(v_subtotal + v_fee - v_discount, 0),
    notes          = nullif(btrim(p_order ->> 'notes'), '')
  where id = v_id;

  if not found then raise exception 'Pedido não encontrado.'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_idx := v_idx + 1;
    if coalesce((v_item ->> 'quantity')::numeric, 0) <= 0 then
      raise exception 'Quantidade inválida em "%".', v_item ->> 'product_name';
    end if;
    v_pid := nullif(v_item ->> 'product_id', '')::uuid;
    v_cost := nullif(v_old_costs ->> coalesce(v_pid::text, ''), '')::numeric;
    if v_cost is null and v_pid is not null then
      select cost into v_cost from public.products where id = v_pid;
    end if;
    insert into public.order_items
      (order_id, product_id, product_name, unit, unit_price, quantity, options, note, line_total, unit_cost, sort_order)
    values (
      v_id,
      v_pid,
      coalesce(nullif(btrim(v_item ->> 'product_name'), ''), 'Item'),
      coalesce(nullif(v_item ->> 'unit', ''), 'un'),
      round((v_item ->> 'unit_price')::numeric, 2),
      (v_item ->> 'quantity')::numeric,
      coalesce(v_item -> 'options', '{}'::jsonb),
      nullif(btrim(v_item ->> 'note'), ''),
      round((v_item ->> 'unit_price')::numeric * (v_item ->> 'quantity')::numeric, 2),
      coalesce(v_cost, 0),
      v_idx
    );
  end loop;

  -- venda no balcão já nasce paga
  if v_walk_in then
    update public.orders set amount_paid = total where id = v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.save_order(jsonb, jsonb) from public, anon;
grant execute on function public.save_order(jsonb, jsonb) to authenticated;

-- =====================================================================
-- 12. PERMISSÕES DA API (quem decide o acesso de verdade é o RLS acima)
--     Explícito para funcionar mesmo se o projeto não expõe tabelas
--     novas automaticamente.
-- =====================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.allowed_emails, public.customers, public.option_lists, public.option_items,
  public.products, public.orders, public.order_items, public.expenses
  to authenticated;
grant select on public.profiles to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_admin() to authenticated;
-- Funções internas: gatilhos do cadastro só o banco usa; o resto só para quem está logado
revoke execute on function public.check_signup_allowed() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.save_order(jsonb, jsonb) from public, anon;
grant execute on function public.save_order(jsonb, jsonb) to authenticated;

-- =====================================================================
-- 13. INGREDIENTES E RECEITAS (mesmo conteúdo de migrations/004_ingredientes.sql)
-- =====================================================================
-- ---------------------------------------------------------------------
-- 1. INGREDIENTES: o que foi comprado, quanto vem na embalagem e quanto custou
--    Ex.: Leite condensado · 395 g · R$ 7,49
-- ---------------------------------------------------------------------
create table if not exists public.ingredients (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(btrim(name)) between 1 and 80),
  unit           text not null default 'g' check (unit in ('g', 'kg', 'ml', 'l', 'un')),
  package_qty    numeric(12,3) not null check (package_qty > 0),
  package_price  numeric(10,2) not null check (package_price >= 0),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists ingredients_name_idx on public.ingredients (lower(name));

drop trigger if exists ingredients_touch on public.ingredients;
create trigger ingredients_touch before update on public.ingredients
  for each row execute function public.touch_updated_at();

alter table public.ingredients enable row level security;
drop policy if exists "equipe: tudo" on public.ingredients;
create policy "equipe: tudo" on public.ingredients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.ingredients from anon;
grant select, insert, update, delete on public.ingredients to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.ingredients;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. PRODUTOS: receita (ingredientes usados) e rendimento
--    recipe = [{"ingredient_id":"…","qty":200,"unit":"g"}]
--    recipe_yield = quantas unidades (ou kg) a receita rende
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists recipe       jsonb         not null default '[]'::jsonb,
  add column if not exists recipe_yield numeric(10,3) not null default 1;

do $$ begin
  alter table public.products add constraint products_recipe_chk check (jsonb_typeof(recipe) = 'array');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.products add constraint products_recipe_yield_chk check (recipe_yield > 0);
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 14. CAMADAS DE RECHEIO, EMBALAGENS E SEGURANÇA (mesmo conteúdo de migrations/005_camadas_embalagens_seguranca.sql)
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
