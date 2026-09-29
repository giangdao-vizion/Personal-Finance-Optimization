-- Phase B: per-expense rows + separate config tables
-- Apply in Supabase SQL editor (or CLI) BEFORE enabling dual-write in the app.
-- Does NOT drop family_budget_states — blob remains until cutover (Phase E).

-- ---------------------------------------------------------------------------
-- expenses: one row per expense
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  day_key text not null,
  month_key text not null,
  category text,
  name text not null default '',
  amount bigint not null default 0,
  date_ts bigint,
  template_id text,
  month_edited boolean,
  is_credit_card boolean,
  extra jsonb not null default '{}'::jsonb
);

create index if not exists expenses_user_month_idx
  on public.expenses (user_id, month_key);
create index if not exists expenses_user_updated_idx
  on public.expenses (user_id, updated_at);
create index if not exists expenses_user_day_idx
  on public.expenses (user_id, day_key);

alter table public.expenses enable row level security;

drop policy if exists expenses_select_own on public.expenses;
create policy expenses_select_own on public.expenses
  for select using (auth.uid() = user_id);

drop policy if exists expenses_insert_own on public.expenses;
create policy expenses_insert_own on public.expenses
  for insert with check (auth.uid() = user_id);

drop policy if exists expenses_update_own on public.expenses;
create policy expenses_update_own on public.expenses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists expenses_delete_own on public.expenses;
create policy expenses_delete_own on public.expenses
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- month_meta
-- ---------------------------------------------------------------------------
create table if not exists public.month_meta (
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null,
  income bigint not null default 0,
  income_user_set boolean not null default false,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  device_id text,
  primary key (user_id, month_key)
);

alter table public.month_meta enable row level security;

drop policy if exists month_meta_select_own on public.month_meta;
create policy month_meta_select_own on public.month_meta
  for select using (auth.uid() = user_id);

drop policy if exists month_meta_insert_own on public.month_meta;
create policy month_meta_insert_own on public.month_meta
  for insert with check (auth.uid() = user_id);

drop policy if exists month_meta_update_own on public.month_meta;
create policy month_meta_update_own on public.month_meta
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists month_meta_delete_own on public.month_meta;
create policy month_meta_delete_own on public.month_meta
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default '',
  icon_id text,
  jar_id text,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  device_id text,
  extra jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

alter table public.categories enable row level security;

drop policy if exists categories_select_own on public.categories;
create policy categories_select_own on public.categories
  for select using (auth.uid() = user_id);

drop policy if exists categories_insert_own on public.categories;
create policy categories_insert_own on public.categories
  for insert with check (auth.uid() = user_id);

drop policy if exists categories_update_own on public.categories;
create policy categories_update_own on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists categories_delete_own on public.categories;
create policy categories_delete_own on public.categories
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- spending_jars
-- ---------------------------------------------------------------------------
create table if not exists public.spending_jars (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default '',
  percent numeric,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  device_id text,
  extra jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

alter table public.spending_jars enable row level security;

drop policy if exists spending_jars_select_own on public.spending_jars;
create policy spending_jars_select_own on public.spending_jars
  for select using (auth.uid() = user_id);

drop policy if exists spending_jars_insert_own on public.spending_jars;
create policy spending_jars_insert_own on public.spending_jars
  for insert with check (auth.uid() = user_id);

drop policy if exists spending_jars_update_own on public.spending_jars;
create policy spending_jars_update_own on public.spending_jars
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists spending_jars_delete_own on public.spending_jars;
create policy spending_jars_delete_own on public.spending_jars
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- fixed_templates
-- ---------------------------------------------------------------------------
create table if not exists public.fixed_templates (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text,
  name text not null default '',
  amount bigint not null default 0,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  device_id text,
  extra jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

alter table public.fixed_templates enable row level security;

drop policy if exists fixed_templates_select_own on public.fixed_templates;
create policy fixed_templates_select_own on public.fixed_templates
  for select using (auth.uid() = user_id);

drop policy if exists fixed_templates_insert_own on public.fixed_templates;
create policy fixed_templates_insert_own on public.fixed_templates
  for insert with check (auth.uid() = user_id);

drop policy if exists fixed_templates_update_own on public.fixed_templates;
create policy fixed_templates_update_own on public.fixed_templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists fixed_templates_delete_own on public.fixed_templates;
create policy fixed_templates_delete_own on public.fixed_templates
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- user_settings (theme stays local-only in the app)
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  default_limit bigint not null default 0,
  credit_card jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  device_id text,
  extra jsonb not null default '{}'::jsonb
);

alter table public.user_settings enable row level security;

drop policy if exists user_settings_select_own on public.user_settings;
create policy user_settings_select_own on public.user_settings
  for select using (auth.uid() = user_id);

drop policy if exists user_settings_insert_own on public.user_settings;
create policy user_settings_insert_own on public.user_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists user_settings_update_own on public.user_settings;
create policy user_settings_update_own on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_settings_delete_own on public.user_settings;
create policy user_settings_delete_own on public.user_settings
  for delete using (auth.uid() = user_id);
