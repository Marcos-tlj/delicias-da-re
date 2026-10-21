-- =====================================================================
--  DELÍCIAS DA RÊ — Migração 002: custos, margem, despesas e vendas
--  Supabase > SQL Editor > cole tudo > Run.
--  NÃO apaga nada. Pode rodar mais de uma vez sem problema.
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
