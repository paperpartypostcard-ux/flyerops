-- FlyerOps — iteration 4 (per agreed spec, 8 Oct 2026):
--   * single pay rate ($125 per 1000 flyers, no history) + payroll per walker for a period
--   * next-suburb recommendations by recency and reach, optionally nearest to a walker's home

-- ───────────── Settings (single row) ─────────────
create table app_settings (
  id             boolean primary key default true check (id),
  rate_per_1000  numeric(8,2) not null default 125 check (rate_per_1000 >= 0),
  currency       text not null default 'AUD',
  updated_at     timestamptz not null default now()
);
insert into app_settings default values;
alter table app_settings enable row level security;
create policy staff_read on app_settings for select using (is_staff());
create policy owner_write on app_settings for update
  using (current_role_name() = 'owner') with check (current_role_name() = 'owner');
revoke all on app_settings from anon;

-- ───────────── Payroll ─────────────
-- Earnings = delivered flyers × rate / 1000. Staff only (walkers don't see money in the MVP).
create or replace function payroll(p_from date, p_to date)
returns table (walker_id uuid, full_name text, email text, status person_status,
               flyers int, hours numeric, walks int, suburbs int, earnings numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_rate numeric;
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  select rate_per_1000 into v_rate from app_settings;
  return query
    select p.id, p.full_name, p.email, p.status,
           coalesce(sum(d.flyers), 0)::int,
           coalesce(sum(d.hours), 0)::numeric(8,2),
           count(d.id)::int,
           count(distinct d.suburb_id)::int,
           round(coalesce(sum(d.flyers), 0) * v_rate / 1000, 2)
    from profiles p
    left join drops d on d.walker_id = p.id and d.walked_on between p_from and p_to
    where p.role = 'walker'
    group by p.id
    having count(d.id) > 0 or p.status = 'active'
    order by 9 desc, 2;
end $$;
revoke execute on function payroll(date, date) from anon;

-- ───────────── Recommendations ─────────────
-- Suburbs that can be assigned now, never walked first, then the longest ago, then more dwellings.
-- With p_walker: nearest to the walker's home suburb first (spec: plan from home and neighbouring suburbs).
create or replace function recommend_suburbs(p_walker uuid default null, p_limit integer default 15)
returns table (id integer, name text, dwellings integer, last_drop date, distance_km numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_home geometry;
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  if p_walker is not null then
    select st_centroid(s.geom) into v_home
    from profiles p join suburbs s on s.id = p.home_suburb_id where p.id = p_walker;
  end if;
  return query
    select o.id, o.name, o.dwellings, o.last_drop,
           case when v_home is null then null
                else round((st_distance(st_centroid(s.geom)::geography, v_home::geography) / 1000)::numeric, 1) end
    from suburb_overview o join suburbs s on s.id = o.id
    where o.status = 'available'
    order by
      case when v_home is null then 0 else st_distance(st_centroid(s.geom)::geography, v_home::geography) end,
      o.last_drop nulls first,
      o.dwellings desc nulls last
    limit greatest(least(p_limit, 100), 1);
end $$;
revoke execute on function recommend_suburbs(uuid, integer) from anon;
