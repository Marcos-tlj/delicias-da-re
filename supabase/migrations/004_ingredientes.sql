-- =====================================================================
--  DELÍCIAS DA RÊ — Migração 004: ingredientes e receita dos produtos
--  Supabase > SQL Editor > cole tudo > Run.
--  NÃO apaga nada. Pode rodar mais de uma vez sem problema.
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
