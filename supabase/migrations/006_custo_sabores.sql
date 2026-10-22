-- =====================================================================
--  DELÍCIAS DA RÊ — Migração 006: custo por sabor e custo fixo por bolo
--  Supabase > SQL Editor > cole tudo > Run.
--  NÃO apaga nada. Pode rodar mais de uma vez sem problema.
--  Precisa da 005 antes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SABORES com custo: receita do sabor (ingredientes) e para quantos kg
--    (ou unidades) do produto ela dá. cost = custo por kg/un do produto.
--    Ex.: receita de recheio de brigadeiro R$ 18 que recheia um bolo de 2 kg
--    inteiro → R$ 9 por kg. Com camadas diferentes, usa a média.
-- ---------------------------------------------------------------------
alter table public.option_items
  add column if not exists recipe       jsonb          not null default '[]'::jsonb,
  add column if not exists recipe_yield numeric(10,3)  not null default 1,
  add column if not exists cost         numeric(12,4)  not null default 0;
do $$ begin
  alter table public.option_items add constraint option_items_recipe_chk check (jsonb_typeof(recipe) = 'array');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.option_items add constraint option_items_yield_chk check (recipe_yield > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.option_items add constraint option_items_cost_chk check (cost >= 0);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. PRODUTOS por kg: custo fixo por item vendido (caixa, cartão do bolo…)
--    Não multiplica pelo peso: um bolo de 1 kg e um de 3 kg usam 1 caixa.
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists cost_fixed numeric(10,2) not null default 0;
do $$ begin
  alter table public.products add constraint products_cost_fixed_chk check (cost_fixed >= 0);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 3. SALVAR PEDIDO: usa o custo calculado de cada item (sabores + peso)
--    quando o app envia "unit_cost"; senão, custo do produto + custo fixo ÷ quantidade.
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
  v_qty         numeric;
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
    v_qty := coalesce((v_item ->> 'quantity')::numeric, 0);
    if v_qty <= 0 then
      raise exception 'Quantidade inválida em "%".', v_item ->> 'product_name';
    end if;
    v_pid := nullif(v_item ->> 'product_id', '')::uuid;
    -- 1º custo calculado pelo app (sabores, camadas, peso); 2º custo antigo do pedido; 3º custo do produto
    v_cost := nullif(v_item ->> 'unit_cost', '')::numeric;
    if v_cost is null then
      v_cost := nullif(v_old_costs ->> coalesce(v_pid::text, ''), '')::numeric;
    end if;
    if v_cost is null and v_pid is not null then
      select cost + cost_fixed / v_qty into v_cost from public.products where id = v_pid;
    end if;
    insert into public.order_items
      (order_id, product_id, product_name, unit, unit_price, quantity, options, note, line_total, unit_cost, sort_order)
    values (
      v_id,
      v_pid,
      coalesce(nullif(btrim(v_item ->> 'product_name'), ''), 'Item'),
      coalesce(nullif(v_item ->> 'unit', ''), 'un'),
      round((v_item ->> 'unit_price')::numeric, 2),
      v_qty,
      coalesce(v_item -> 'options', '{}'::jsonb),
      nullif(btrim(v_item ->> 'note'), ''),
      round((v_item ->> 'unit_price')::numeric * v_qty, 2),
      round(greatest(coalesce(v_cost, 0), 0), 2),
      v_idx
    );
  end loop;

  if v_walk_in then
    update public.orders set amount_paid = total where id = v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.save_order(jsonb, jsonb) from public, anon;
grant execute on function public.save_order(jsonb, jsonb) to authenticated;
