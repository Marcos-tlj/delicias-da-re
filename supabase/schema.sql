-- =====================================================================
--  DELÍCIAS DA RÊ — Schema completo do Supabase
--  Como usar: Supabase > SQL Editor > New query > cole TUDO > Run.
--  Pode rodar de novo se der erro: a seção 0 limpa antes de recriar.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. LIMPEZA (permite rodar o script de novo se algo falhou antes)
--    ATENÇÃO: apaga as tabelas do app. Use só durante a configuração.
-- ---------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop policy if exists "product-images: admin envia"    on storage.objects;
drop policy if exists "product-images: admin atualiza" on storage.objects;
drop policy if exists "product-images: admin exclui"   on storage.objects;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.products cascade;
drop table if exists public.profiles cascade;
drop type if exists public.order_status cascade;
drop function if exists public.place_order(jsonb, text, text, text, text, jsonb, text, timestamptz);
drop function if exists public.is_admin() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.touch_updated_at() cascade;


-- ---------------------------------------------------------------------
-- 1. PROFILES (um por usuário do auth; guarda a flag de admin)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  email       text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Cria o profile automaticamente quando alguém faz o primeiro login
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cria profile para quem já tinha feito login antes deste script
insert into public.profiles (id, full_name, email)
select id, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'), email
from auth.users
on conflict (id) do nothing;

-- Helper usado pelas políticas. SECURITY DEFINER evita recursão de RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- 2. PRODUCTS
-- ---------------------------------------------------------------------
create table public.products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 2 and 80),
  description    text check (char_length(description) <= 400),
  category       text not null check (category in ('bolos', 'doces', 'tortas')),
  price          numeric(10,2) not null check (price >= 0),
  unit           text not null default 'un' check (unit in ('un', 'kg')),
  min_quantity   numeric(6,2) not null default 1 check (min_quantity > 0),
  quantity_step  numeric(6,2) not null default 1 check (quantity_step > 0),
  price_is_from  boolean not null default false,   -- exibe "a partir de"
  -- Grupos de opções. Ex.:
  -- [{"name":"Massa","type":"single","required":true,"choices":["Branca","Chocolate"]}]
  options        jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  image_url      text,
  is_available   boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index products_category_idx on public.products (category, sort_order);

-- ---------------------------------------------------------------------
-- 3. ORDERS + ORDER_ITEMS
-- ---------------------------------------------------------------------
create type public.order_status as enum
  ('pendente', 'aceito', 'em_preparo', 'saiu_entrega', 'finalizado', 'cancelado');

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  code            bigint generated always as identity,          -- nº curto p/ exibir (#12)
  user_id         uuid not null references auth.users (id) on delete cascade,
  status          public.order_status not null default 'pendente',
  delivery_type   text not null check (delivery_type in ('retirada', 'delivery')),
  address         jsonb,
  payment_method  text not null check (payment_method in ('pix', 'cartao_entrega')),
  customer_name   text not null,
  customer_phone  text not null,
  notes           text,
  scheduled_for   timestamptz,                                   -- "para quando?"
  subtotal        numeric(10,2) not null check (subtotal >= 0),
  delivery_fee    numeric(10,2) not null default 0 check (delivery_fee >= 0),
  total           numeric(10,2) not null check (total >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint address_required_for_delivery
    check (delivery_type = 'retirada' or address is not null)
);

create index orders_user_idx    on public.orders (user_id, created_at desc);
create index orders_created_idx on public.orders (created_at desc);

create table public.order_items (
  id            bigint generated always as identity primary key,
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  product_name  text not null,          -- "foto" do produto no momento da compra
  unit          text not null,
  unit_price    numeric(10,2) not null,
  quantity      numeric(8,2) not null check (quantity > 0),
  options       jsonb not null default '{}'::jsonb,
  note          text,
  line_total    numeric(10,2) not null
);

create index order_items_order_idx on public.order_items (order_id);

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- PROFILES: cada um vê/edita o seu; admin vê todos
create policy "profiles: ler o próprio ou admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles: editar o próprio"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Ninguém consegue se promover a admin pela API: só pode editar nome e telefone.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- PRODUCTS: qualquer pessoa vê os disponíveis; admin vê e gerencia tudo
create policy "products: ler disponíveis"
  on public.products for select to anon, authenticated
  using (is_available or public.is_admin());

create policy "products: admin insere"
  on public.products for insert to authenticated
  with check (public.is_admin());

create policy "products: admin edita"
  on public.products for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "products: admin exclui"
  on public.products for delete to authenticated
  using (public.is_admin());

-- ORDERS: cliente só lê os PRÓPRIOS pedidos; admin lê todos.
create policy "orders: dono ou admin lê"
  on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Só admin altera (status). Cliente não tem política de UPDATE => bloqueado.
create policy "orders: só admin altera"
  on public.orders for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Não existe política de INSERT/DELETE: pedidos só nascem pela função
-- place_order() (que recalcula os preços no servidor).
revoke all on public.orders      from anon;
revoke all on public.order_items from anon;
revoke insert, update, delete on public.orders      from authenticated;
revoke insert, update, delete on public.order_items from authenticated;
grant update (status) on public.orders to authenticated;   -- RLS restringe a admins

-- ORDER_ITEMS: visível para o dono do pedido ou admin
create policy "order_items: dono ou admin lê"
  on public.order_items for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 5. FUNÇÃO SEGURA PARA CRIAR PEDIDO
--    O cliente manda apenas: id do produto, quantidade e opções.
--    Preço, disponibilidade e total são calculados AQUI, no banco.
-- ---------------------------------------------------------------------
create or replace function public.place_order(
  p_items           jsonb,
  p_delivery_type   text,
  p_payment_method  text,
  p_customer_name   text,
  p_customer_phone  text,
  p_address         jsonb default null,
  p_notes           text default null,
  p_scheduled_for   timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_order_id  uuid;
  v_item      jsonb;
  v_product   public.products%rowtype;
  v_qty       numeric;
  v_sel       jsonb;
  v_clean     jsonb;
  v_group     jsonb;
  v_gname     text;
  v_rows      jsonb := '[]'::jsonb;
  v_subtotal  numeric := 0;
  v_line      numeric;
begin
  if v_uid is null then
    raise exception 'Faça login para enviar o pedido.';
  end if;

  -- anti-spam simples
  if (select count(*) from public.orders
      where user_id = v_uid and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'Muitos pedidos em sequência. Aguarde alguns minutos.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Sua sacola está vazia.';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'Pedido com itens demais.';
  end if;

  if p_delivery_type not in ('retirada', 'delivery') then
    raise exception 'Tipo de entrega inválido.';
  end if;
  if p_payment_method not in ('pix', 'cartao_entrega') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if coalesce(btrim(p_customer_name), '') = '' then
    raise exception 'Informe seu nome.';
  end if;
  if length(regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g')) < 10 then
    raise exception 'Informe um telefone/WhatsApp válido com DDD.';
  end if;
  if p_delivery_type = 'delivery' and (
       p_address is null
       or coalesce(btrim(p_address ->> 'street'), '') = ''
       or coalesce(btrim(p_address ->> 'number'), '') = ''
       or coalesce(btrim(p_address ->> 'neighborhood'), '') = ''
     ) then
    raise exception 'Preencha rua, número e bairro para entrega.';
  end if;
  if p_scheduled_for is not null and p_scheduled_for < now() - interval '5 minutes' then
    raise exception 'A data desejada já passou.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid;

    if not found or not v_product.is_available then
      raise exception 'Um produto da sacola não está mais disponível.';
    end if;

    v_qty := (v_item ->> 'quantity')::numeric;
    if v_qty is null or v_qty < v_product.min_quantity or v_qty > 100
       or (v_qty / v_product.quantity_step) <> trunc(v_qty / v_product.quantity_step) then
      raise exception 'Quantidade inválida para %.', v_product.name;
    end if;

    -- valida opções contra as cadastradas no produto
    v_sel   := coalesce(v_item -> 'options', '{}'::jsonb);
    v_clean := '{}'::jsonb;
    if jsonb_typeof(v_sel) <> 'object' then
      raise exception 'Opções inválidas para %.', v_product.name;
    end if;

    for v_group in select * from jsonb_array_elements(v_product.options)
    loop
      v_gname := v_group ->> 'name';

      if coalesce((v_group ->> 'required')::boolean, false)
         and (v_sel -> v_gname is null
              or v_sel ->> v_gname = ''
              or v_sel -> v_gname = '[]'::jsonb) then
        raise exception 'Escolha "%" para %.', v_gname, v_product.name;
      end if;

      if v_sel ? v_gname then
        if v_group ->> 'type' = 'multi' then
          if jsonb_typeof(v_sel -> v_gname) <> 'array' or exists (
               select 1 from jsonb_array_elements_text(v_sel -> v_gname) e
               where not ((v_group -> 'choices') ? e)
             ) then
            raise exception 'Opção inválida em "%".', v_gname;
          end if;
        else
          if jsonb_typeof(v_sel -> v_gname) <> 'string'
             or not ((v_group -> 'choices') ? (v_sel ->> v_gname)) then
            raise exception 'Opção inválida em "%".', v_gname;
          end if;
        end if;
        v_clean := v_clean || jsonb_build_object(v_gname, v_sel -> v_gname);
      end if;
    end loop;

    v_line     := round(v_product.price * v_qty, 2);
    v_subtotal := v_subtotal + v_line;

    v_rows := v_rows || jsonb_build_object(
      'product_id',   v_product.id,
      'product_name', v_product.name,
      'unit',         v_product.unit,
      'unit_price',   v_product.price,
      'quantity',     v_qty,
      'options',      v_clean,
      'note',         left(nullif(btrim(v_item ->> 'note'), ''), 200),
      'line_total',   v_line
    );
  end loop;

  insert into public.orders (
    user_id, delivery_type, address, payment_method,
    customer_name, customer_phone, notes, scheduled_for,
    subtotal, delivery_fee, total
  ) values (
    v_uid,
    p_delivery_type,
    case when p_delivery_type = 'delivery' then p_address end,
    p_payment_method,
    left(btrim(p_customer_name), 80),
    left(btrim(p_customer_phone), 20),
    left(nullif(btrim(p_notes), ''), 500),
    p_scheduled_for,
    v_subtotal, 0, v_subtotal
  )
  returning id into v_order_id;

  insert into public.order_items
    (order_id, product_id, product_name, unit, unit_price, quantity, options, note, line_total)
  select v_order_id, r.product_id, r.product_name, r.unit, r.unit_price,
         r.quantity, r.options, r.note, r.line_total
  from jsonb_to_recordset(v_rows) as r(
    product_id uuid, product_name text, unit text, unit_price numeric,
    quantity numeric, options jsonb, note text, line_total numeric
  );

  return v_order_id;
end;
$$;

revoke all on function public.place_order(jsonb, text, text, text, text, jsonb, text, timestamptz) from public, anon;
grant execute on function public.place_order(jsonb, text, text, text, text, jsonb, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- 6. REALTIME (o Realtime respeita o RLS: cliente só recebe o próprio pedido)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.orders;

-- ---------------------------------------------------------------------
-- 7. STORAGE: fotos dos produtos (leitura pública, upload só admin)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product-images: admin envia"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product-images: admin atualiza"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

create policy "product-images: admin exclui"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------
-- 8. CARDÁPIO INICIAL (do cardápio impresso)
-- ---------------------------------------------------------------------
insert into public.products
  (name, description, category, price, unit, min_quantity, quantity_step, price_is_from, options, sort_order)
values
(
  'Bolo com Recheio Tradicional',
  'Bolo de festa por quilo. Escolha a massa e o recheio. Adicionais com valor a combinar.',
  'bolos', 65.00, 'kg', 1, 0.5, false,
  '[
    {"name":"Massa","type":"single","required":true,"choices":["Branca","Chocolate"]},
    {"name":"Recheio","type":"single","required":true,"choices":["Abacaxi","Beijinho","Brigadeiro","Brigadeiro de Ninho","Brigadeiro de Maracujá","Doce de Leite"]},
    {"name":"Adicionais (valor a combinar)","type":"multi","required":false,"choices":["Morango","Abacaxi","Bombom","Nutella","Creme de Avelã","Nozes"]}
  ]'::jsonb,
  10
),
(
  'Bolo com Recheio Especial',
  'Bolo de festa por quilo com recheios especiais. Adicionais com valor a combinar.',
  'bolos', 80.00, 'kg', 1, 0.5, false,
  '[
    {"name":"Massa","type":"single","required":true,"choices":["Branca","Chocolate"]},
    {"name":"Recheio","type":"single","required":true,"choices":["Alpino","Mousse de Chocolate Meio Amargo","Ninho com Morangos","Doce de Leite com Ameixa","Doce de Leite com Nozes","4 Leites"]},
    {"name":"Adicionais (valor a combinar)","type":"multi","required":false,"choices":["Morango","Abacaxi","Bombom","Nutella","Creme de Avelã","Nozes"]}
  ]'::jsonb,
  20
),
(
  'Caseirinho',
  'Bolo caseiro com cobertura. Valor a partir de R$ 12,00 (confirmamos pelo WhatsApp).',
  'bolos', 12.00, 'un', 1, 1, true,
  '[
    {"name":"Massa","type":"single","required":true,"choices":["Cenoura","Chocolate","Limão","Branca"]},
    {"name":"Cobertura","type":"single","required":true,"choices":["Brigadeiro","Ninho","Maracujá","Limão"]}
  ]'::jsonb,
  30
),
('Mini Tortinha de Mousse de Maracujá', 'Tortinha individual.', 'tortas', 9.00, 'un', 1, 1, false, '[]'::jsonb, 10),
('Mini Tortinha de Mousse de Limão',    'Tortinha individual.', 'tortas', 9.00, 'un', 1, 1, false, '[]'::jsonb, 20),
('Mini Tortinha de Mousse de Morango',  'Tortinha individual.', 'tortas', 9.00, 'un', 1, 1, false, '[]'::jsonb, 30);

-- =====================================================================
-- 9. DEPOIS DO PRIMEIRO LOGIN de cada administradora, rode (trocando os e-mails):
--
--   update public.profiles set is_admin = true
--   where email in ('seu-email@gmail.com', 'email-da-sua-mae@gmail.com');
-- =====================================================================
