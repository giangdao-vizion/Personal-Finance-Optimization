-- Backfill expenses + config tables from legacy blob family_budget_states.
-- Run AFTER 20260929_expenses_and_config_tables.sql
--
-- Replace TARGET_USER_ID with the auth.users uuid of the account that owns the data.
-- Preview parity counts before/after (see bottom).
--
-- Safe to re-run: upserts by primary key.

-- Example:
--   \set target_user 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

do $$
declare
  target uuid := 'TARGET_USER_ID'::uuid; -- << REPLACE
  blob jsonb;
  day_key text;
  day_shard jsonb;
  exp jsonb;
  mk text;
  month_row jsonb;
  cat jsonb;
  jar jsonb;
  tmpl jsonb;
  settings jsonb;
  i int;
  live_blob int := 0;
  live_rows int := 0;
begin
  if target = 'TARGET_USER_ID'::uuid then
    raise exception 'Replace TARGET_USER_ID with a real auth.users uuid before running';
  end if;

  select payload::jsonb into blob
  from public.family_budget_states
  where id = 'shared-default';

  if blob is null then
    raise exception 'No shared-default payload found';
  end if;

  -- ----- expenses from days -----
  for day_key, day_shard in
    select key, value from jsonb_each(coalesce(blob->'days', '{}'::jsonb))
  loop
    if day_shard ? 'expenses' then
      for i in 0 .. coalesce(jsonb_array_length(day_shard->'expenses'), 0) - 1 loop
        exp := day_shard->'expenses'->i;
        if exp is null or exp->>'id' is null then
          continue;
        end if;
        insert into public.expenses as e (
          id, user_id, device_id, created_at, updated_at, deleted_at,
          day_key, month_key, category, name, amount, date_ts,
          template_id, month_edited, is_credit_card, extra
        ) values (
          exp->>'id',
          target,
          'backfill',
          to_timestamp(coalesce((exp->>'createdAt')::double precision, (exp->>'updatedAt')::double precision, extract(epoch from now()) * 1000) / 1000.0),
          to_timestamp(coalesce((exp->>'updatedAt')::double precision, (exp->>'createdAt')::double precision, extract(epoch from now()) * 1000) / 1000.0),
          case
            when exp ? 'deletedAt' and nullif(exp->>'deletedAt', '') is not null
              then to_timestamp((exp->>'deletedAt')::double precision / 1000.0)
            else null
          end,
          day_key,
          left(day_key, 7),
          exp->>'category',
          coalesce(exp->>'name', ''),
          coalesce((exp->>'amount')::bigint, 0),
          case when exp ? 'dateTs' then (exp->>'dateTs')::bigint else null end,
          exp->>'templateId',
          case when exp ? 'monthEdited' then (exp->>'monthEdited')::boolean else null end,
          case when exp ? 'isCreditCard' then (exp->>'isCreditCard')::boolean else null end,
          '{}'::jsonb
        )
        on conflict (id) do update set
          user_id = excluded.user_id,
          device_id = excluded.device_id,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          day_key = excluded.day_key,
          month_key = excluded.month_key,
          category = excluded.category,
          name = excluded.name,
          amount = excluded.amount,
          date_ts = excluded.date_ts,
          template_id = excluded.template_id,
          month_edited = excluded.month_edited,
          is_credit_card = excluded.is_credit_card;
      end loop;
    end if;
  end loop;

  -- ----- month_meta -----
  for mk, month_row in
    select key, value from jsonb_each(coalesce(blob->'months', '{}'::jsonb))
  loop
    insert into public.month_meta as m (
      user_id, month_key, income, income_user_set, deleted_at, updated_at, device_id
    ) values (
      target,
      mk,
      coalesce((month_row->>'income')::bigint, 0),
      coalesce((month_row->>'incomeUserSet')::boolean, false),
      case
        when month_row ? 'deletedAt' and nullif(month_row->>'deletedAt', '') is not null
          then to_timestamp((month_row->>'deletedAt')::double precision / 1000.0)
        else null
      end,
      to_timestamp(coalesce((month_row->>'dataUpdatedAt')::double precision, extract(epoch from now()) * 1000) / 1000.0),
      'backfill'
    )
    on conflict (user_id, month_key) do update set
      income = excluded.income,
      income_user_set = excluded.income_user_set,
      deleted_at = excluded.deleted_at,
      updated_at = excluded.updated_at,
      device_id = excluded.device_id;
  end loop;

  -- ----- categories -----
  if jsonb_typeof(blob->'categories') = 'array' then
    for i in 0 .. coalesce(jsonb_array_length(blob->'categories'), 0) - 1 loop
      cat := blob->'categories'->i;
      if cat is null or cat->>'id' is null then continue; end if;
      insert into public.categories (
        id, user_id, label, icon_id, jar_id, sort_order, deleted_at, updated_at, device_id, extra
      ) values (
        cat->>'id', target, coalesce(cat->>'label', ''), cat->>'iconId', cat->>'jarId',
        i,
        case when cat ? 'deletedAt' and nullif(cat->>'deletedAt','') is not null
          then to_timestamp((cat->>'deletedAt')::double precision / 1000.0) else null end,
        to_timestamp(coalesce((cat->>'updatedAt')::double precision, extract(epoch from now()) * 1000) / 1000.0),
        'backfill', '{}'::jsonb
      )
      on conflict (user_id, id) do update set
        label = excluded.label,
        icon_id = excluded.icon_id,
        jar_id = excluded.jar_id,
        sort_order = excluded.sort_order,
        deleted_at = excluded.deleted_at,
        updated_at = excluded.updated_at;
    end loop;
  end if;

  -- ----- spending_jars -----
  if jsonb_typeof(blob->'spendingJars') = 'array' then
    for i in 0 .. coalesce(jsonb_array_length(blob->'spendingJars'), 0) - 1 loop
      jar := blob->'spendingJars'->i;
      if jar is null or jar->>'id' is null then continue; end if;
      insert into public.spending_jars (
        id, user_id, label, percent, sort_order, deleted_at, updated_at, device_id, extra
      ) values (
        jar->>'id', target, coalesce(jar->>'label', ''),
        nullif(jar->>'percent', '')::numeric, i,
        case when jar ? 'deletedAt' and nullif(jar->>'deletedAt','') is not null
          then to_timestamp((jar->>'deletedAt')::double precision / 1000.0) else null end,
        to_timestamp(coalesce((jar->>'updatedAt')::double precision, extract(epoch from now()) * 1000) / 1000.0),
        'backfill', '{}'::jsonb
      )
      on conflict (user_id, id) do update set
        label = excluded.label,
        percent = excluded.percent,
        sort_order = excluded.sort_order,
        deleted_at = excluded.deleted_at,
        updated_at = excluded.updated_at;
    end loop;
  end if;

  -- ----- fixed_templates -----
  if jsonb_typeof(blob->'fixedTemplates') = 'array' then
    for i in 0 .. coalesce(jsonb_array_length(blob->'fixedTemplates'), 0) - 1 loop
      tmpl := blob->'fixedTemplates'->i;
      if tmpl is null or tmpl->>'id' is null then continue; end if;
      insert into public.fixed_templates (
        id, user_id, category, name, amount, deleted_at, updated_at, device_id, extra
      ) values (
        tmpl->>'id', target, tmpl->>'category', coalesce(tmpl->>'name', ''),
        coalesce((tmpl->>'amount')::bigint, 0),
        case when tmpl ? 'deletedAt' and nullif(tmpl->>'deletedAt','') is not null
          then to_timestamp((tmpl->>'deletedAt')::double precision / 1000.0) else null end,
        to_timestamp(coalesce((tmpl->>'updatedAt')::double precision, extract(epoch from now()) * 1000) / 1000.0),
        'backfill', '{}'::jsonb
      )
      on conflict (user_id, id) do update set
        category = excluded.category,
        name = excluded.name,
        amount = excluded.amount,
        deleted_at = excluded.deleted_at,
        updated_at = excluded.updated_at;
    end loop;
  end if;

  -- ----- user_settings -----
  settings := coalesce(blob->'settings', '{}'::jsonb);
  insert into public.user_settings (user_id, default_limit, credit_card, updated_at, device_id, extra)
  values (
    target,
    coalesce((settings->>'defaultLimit')::bigint, 0),
    coalesce(settings->'creditCard', '{}'::jsonb),
    now(),
    'backfill',
    '{}'::jsonb
  )
  on conflict (user_id) do update set
    default_limit = excluded.default_limit,
    credit_card = excluded.credit_card,
    updated_at = excluded.updated_at;

  -- ----- parity log -----
  select count(*)::int into live_blob
  from jsonb_array_elements(
    (
      select coalesce(jsonb_agg(e), '[]'::jsonb)
      from (
        select jsonb_array_elements(value->'expenses') as e
        from jsonb_each(coalesce(blob->'days', '{}'::jsonb))
      ) s
      where (e->>'deletedAt') is null or (e->>'deletedAt') = ''
    )
  );

  select count(*)::int into live_rows
  from public.expenses
  where user_id = target and deleted_at is null;

  raise notice 'Parity live expenses: blob≈% rows=% (compare manually per month if needed)', live_blob, live_rows;
end $$;

-- Per-month parity helper (run after backfill; set user id):
-- select month_key, count(*) filter (where deleted_at is null) as live
-- from public.expenses
-- where user_id = 'TARGET_USER_ID'::uuid
-- group by 1 order by 1;
