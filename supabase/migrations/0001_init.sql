-- FlyerOps — initial schema
-- Roles: owner, manager (full access), walker (own data only).
-- Business rule: a suburb may receive flyers (from ANY company) at most once per its cycle (3 or 4 months, set per suburb).

create extension if not exists postgis;

-- ───────────── Enums ─────────────
create type user_role as enum ('owner', 'manager', 'walker');
create type person_status as enum ('active', 'inactive');
create type assignment_status as enum ('planned', 'in_progress', 'completed', 'cancelled');
create type stock_move_type as enum ('receive', 'issue', 'return', 'adjust');
create type check_method as enum ('video', 'in_person');
create type check_result as enum ('pass', 'fail');

-- ───────────── Companies ─────────────
create table companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  color       text not null default '#2563eb',
  created_at  timestamptz not null default now()
);

-- ───────────── Suburbs (ABS Suburbs and Localities) ─────────────
create table suburbs (
  id                  serial primary key,
  sal_code            text not null unique,
  name                text not null,
  geom                geometry(MultiPolygon, 4326) not null,
  geom_simple         geometry(MultiPolygon, 4326),         -- lighter shape for the map
  dwellings_abs       integer,                              -- private dwellings, ABS Census
  dwellings_override  integer,                              -- manual correction by manager
  cycle_months        smallint not null default 3 check (cycle_months between 1 and 12),
  excluded            boolean not null default false,       -- never distribute here
  notes               text,
  created_at          timestamptz not null default now()
);
create index suburbs_geom_idx on suburbs using gist (geom);

-- ───────────── People (1:1 with auth.users) ─────────────
create table profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text not null,
  email           text not null,
  phone           text,
  role            user_role not null default 'walker',
  status          person_status not null default 'active',
  home_suburb_id  integer references suburbs (id),
  company_id      uuid references companies (id),
  created_at      timestamptz not null default now()
);

-- ───────────── Assignments: suburb → walker → company ─────────────
create table assignments (
  id             uuid primary key default gen_random_uuid(),
  suburb_id      integer not null references suburbs (id),
  walker_id      uuid not null references profiles (id),
  company_id     uuid not null references companies (id),
  status         assignment_status not null default 'planned',
  planned_start  date,
  completed_on   date,
  notes          text,
  created_by     uuid references profiles (id) default auth.uid(),
  created_at     timestamptz not null default now()
);
create index on assignments (suburb_id);
create index on assignments (walker_id);
-- only one open assignment per suburb at a time
create unique index assignments_one_open_per_suburb
  on assignments (suburb_id) where status in ('planned', 'in_progress');

-- ───────────── Drops: one walk report (from Map My Walk) ─────────────
create table drops (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references assignments (id) on delete cascade,
  walker_id      uuid not null references profiles (id),
  suburb_id      integer not null references suburbs (id),
  company_id     uuid not null references companies (id),
  walked_on      date not null default current_date,
  flyers         integer not null check (flyers >= 0),
  hours          numeric(5,2) check (hours >= 0),
  track          geometry(MultiLineString, 4326),          -- from GPX / Map My Walk
  notes          text,
  created_at     timestamptz not null default now()
);
create index on drops (suburb_id, walked_on);
create index drops_track_idx on drops using gist (track);

-- ───────────── Flyer stock (manager only) ─────────────
-- receive: stock arrives (+warehouse); issue: warehouse → walker; return: walker → warehouse; adjust: ±correction
create table stock_moves (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies (id),
  walker_id   uuid references profiles (id),
  type        stock_move_type not null,
  qty         integer not null,
  moved_on    date not null default current_date,
  note        text,
  created_by  uuid references profiles (id) default auth.uid(),
  created_at  timestamptz not null default now(),
  check ((type in ('issue','return') and walker_id is not null and qty > 0)
      or (type = 'receive' and walker_id is null and qty > 0)
      or (type = 'adjust'))
);

-- ───────────── Verification checks (video call / in person) ─────────────
create table verification_checks (
  id          uuid primary key default gen_random_uuid(),
  walker_id   uuid not null references profiles (id),
  suburb_id   integer references suburbs (id),
  checked_on  date not null default current_date,
  method      check_method not null default 'video',
  result      check_result not null,
  notes       text,
  checked_by  uuid references profiles (id) default auth.uid(),
  created_at  timestamptz not null default now()
);

-- ───────────── Helpers ─────────────
create or replace function current_role_name() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and status = 'active'
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_role_name() in ('owner','manager'), false)
$$;

-- Last date the suburb received flyers (any company)
create or replace function suburb_last_drop(p_suburb integer) returns date
language sql stable security definer set search_path = public as $$
  select max(coalesce(a.completed_on, d.walked_on))
  from assignments a left join drops d on d.assignment_id = a.id
  where a.suburb_id = p_suburb and a.status = 'completed'
$$;

-- Rule: suburb locked for ALL companies until last completed drop + cycle_months
create or replace function check_assignment_allowed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_last date; v_cycle smallint; v_excl boolean;
begin
  if tg_op = 'UPDATE' and new.suburb_id = old.suburb_id then return new; end if;
  select cycle_months, excluded into v_cycle, v_excl from suburbs where id = new.suburb_id;
  if v_excl then raise exception 'Suburb is excluded from distribution'; end if;
  v_last := suburb_last_drop(new.suburb_id);
  if v_last is not null and v_last + make_interval(months => v_cycle) > current_date then
    raise exception 'Suburb received flyers on %, next allowed after %',
      v_last, (v_last + make_interval(months => v_cycle))::date;
  end if;
  return new;
end $$;
create trigger assignments_cycle_rule before insert or update on assignments
  for each row execute function check_assignment_allowed();

-- A drop moves its assignment to in_progress
create or replace function drop_touch_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update assignments set status = 'in_progress'
  where id = new.assignment_id and status = 'planned';
  return new;
end $$;
create trigger drops_touch after insert on drops
  for each row execute function drop_touch_assignment();

-- ───────────── Overview views (security_invoker → RLS applies) ─────────────
create or replace view suburb_overview with (security_invoker = true) as
select s.id, s.sal_code, s.name, s.cycle_months, s.excluded, s.notes,
       coalesce(s.dwellings_override, s.dwellings_abs) as dwellings,
       last.last_drop,
       (last.last_drop + make_interval(months => s.cycle_months))::date as next_allowed,
       a.id as assignment_id, a.status as assignment_status, a.walker_id,
       p.full_name as walker_name, a.company_id, c.name as company_name, c.color as company_color,
       case
         when s.excluded then 'excluded'
         when a.status = 'in_progress' then 'in_progress'
         when a.status = 'planned' then 'planned'
         when last.last_drop is not null
              and last.last_drop + make_interval(months => s.cycle_months) > current_date then 'covered'
         else 'available'
       end as status
from suburbs s
left join lateral (select suburb_last_drop(s.id) as last_drop) last on true
left join assignments a on a.suburb_id = s.id and a.status in ('planned','in_progress')
left join profiles p on p.id = a.walker_id
left join companies c on c.id = a.company_id;

create or replace view walker_stats with (security_invoker = true) as
select p.id as walker_id, p.full_name, p.status,
       coalesce(sum(d.flyers), 0)::int as flyers_total,
       coalesce(sum(d.hours), 0)::numeric(8,2) as hours_total,
       case when sum(d.hours) > 0 then round(sum(d.flyers) / sum(d.hours)) end as flyers_per_hour,
       coalesce((select sum(case type when 'issue' then qty when 'return' then -qty else 0 end)
                 from stock_moves m where m.walker_id = p.id), 0)
         - coalesce(sum(d.flyers), 0) as flyers_on_hand
from profiles p
left join drops d on d.walker_id = p.id
where p.role = 'walker'
group by p.id;

-- Map data as GeoJSON (one round-trip). RLS filters rows via the view.
create or replace function suburbs_geojson() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object('type','FeatureCollection','features', coalesce(jsonb_agg(
    jsonb_build_object(
      'type','Feature','id', o.id,
      'geometry', st_asgeojson(coalesce(s.geom_simple, s.geom), 5)::jsonb,
      'properties', to_jsonb(o) - 'notes')), '[]'::jsonb))
  from suburb_overview o join suburbs s on s.id = o.id
$$;

-- Walked tracks inside a suburb within its current cycle — geometry + date only,
-- so a walker taking over sees what's done without seeing who did it.
create or replace function suburb_coverage(p_suburb integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_staff() or exists (select 1 from assignments
          where suburb_id = p_suburb and walker_id = auth.uid()
            and status in ('planned','in_progress'))) then
    raise exception 'not allowed';
  end if;
  return (select jsonb_build_object('type','FeatureCollection','features', coalesce(jsonb_agg(
      jsonb_build_object('type','Feature',
        'geometry', st_asgeojson(d.track, 6)::jsonb,
        'properties', jsonb_build_object('walked_on', d.walked_on))), '[]'::jsonb))
    from drops d join suburbs s on s.id = d.suburb_id
    where d.suburb_id = p_suburb and d.track is not null
      and d.walked_on + make_interval(months => s.cycle_months) > current_date);
end $$;

-- Walker submits a walk report (GPX parsed in the browser → GeoJSON)
create or replace function submit_drop(
  p_assignment uuid, p_walked_on date, p_flyers integer, p_hours numeric,
  p_track jsonb default null, p_notes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare a assignments; v_id uuid; v_geom geometry;
begin
  select * into a from assignments where id = p_assignment;
  if a.id is null then raise exception 'assignment not found'; end if;
  if not (is_staff() or a.walker_id = auth.uid()) then raise exception 'not allowed'; end if;
  if a.status not in ('planned','in_progress') then raise exception 'assignment is closed'; end if;
  if p_track is not null then
    v_geom := st_multi(st_force2d(st_setsrid(st_geomfromgeojson(p_track::text), 4326)));
  end if;
  insert into drops (assignment_id, walker_id, suburb_id, company_id, walked_on, flyers, hours, track, notes)
  values (a.id, a.walker_id, a.suburb_id, a.company_id, p_walked_on, p_flyers, p_hours, v_geom, p_notes)
  returning id into v_id;
  return v_id;
end $$;

-- ───────────── Row Level Security ─────────────
alter table companies            enable row level security;
alter table suburbs              enable row level security;
alter table profiles             enable row level security;
alter table assignments          enable row level security;
alter table drops                enable row level security;
alter table stock_moves          enable row level security;
alter table verification_checks  enable row level security;

-- staff: everything
create policy staff_all on companies           for all using (is_staff()) with check (is_staff());
create policy staff_all on suburbs             for all using (is_staff()) with check (is_staff());
create policy staff_all on profiles            for all using (is_staff()) with check (is_staff());
create policy staff_all on assignments         for all using (is_staff()) with check (is_staff());
create policy staff_all on drops               for all using (is_staff()) with check (is_staff());
create policy staff_all on stock_moves         for all using (is_staff()) with check (is_staff());
create policy staff_all on verification_checks for all using (is_staff()) with check (is_staff());

-- walker: only own things, read-only (writes go through submit_drop)
create policy walker_self on profiles for select using (id = auth.uid());
create policy walker_own on assignments for select using (walker_id = auth.uid());
create policy walker_own on drops for select using (walker_id = auth.uid());
create policy walker_own on stock_moves for select using (walker_id = auth.uid());
create policy walker_suburbs on suburbs for select using (
  exists (select 1 from assignments a where a.suburb_id = suburbs.id and a.walker_id = auth.uid()));
create policy walker_companies on companies for select using (
  exists (select 1 from assignments a where a.company_id = companies.id and a.walker_id = auth.uid()));

-- only owner can change roles (managers can manage walkers only)
create or replace function guard_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_role_name() = 'owner' or auth.uid() is null then return new; end if;
  if (tg_op = 'INSERT' and new.role <> 'walker')
     or (tg_op = 'UPDATE' and (new.role <> old.role or old.role <> 'walker')) then
    raise exception 'only owner can manage staff accounts';
  end if;
  return new;
end $$;
create trigger profiles_role_guard before insert or update on profiles
  for each row execute function guard_role_change();

-- anonymous visitors get nothing
revoke execute on all functions in schema public from anon;
revoke all on all tables in schema public from anon;

-- seed
insert into companies (name, color) values ('Company A', '#2563eb');
