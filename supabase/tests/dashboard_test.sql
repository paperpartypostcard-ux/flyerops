-- Iteration 3 tests: dashboard_summary numbers and access.
--   psql -f supabase/tests/supabase_shim.sql -f supabase/migrations/0001_init.sql \
--        -f supabase/migrations/0002_stock_checks.sql -f supabase/migrations/0003_dashboard.sql \
--        -f supabase/tests/dashboard_test.sql
\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000b'), ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');
insert into suburbs (sal_code, name, geom, dwellings_abs) values
 ('S1','Alpha', st_multi(st_geomfromtext('POLYGON((145 -37.8,145.01 -37.8,145.01 -37.81,145 -37.81,145 -37.8))',4326)), 1000),
 ('S2','Beta',  st_multi(st_geomfromtext('POLYGON((145.02 -37.8,145.03 -37.8,145.03 -37.81,145.02 -37.81,145.02 -37.8))',4326)), 2000),
 ('S3','Gamma', st_multi(st_geomfromtext('POLYGON((145.04 -37.8,145.05 -37.8,145.05 -37.81,145.04 -37.81,145.04 -37.8))',4326)), 500);
insert into profiles (id, full_name, email, role) values
 ('00000000-0000-0000-0000-00000000000b','Manager','m@x','manager'),
 ('00000000-0000-0000-0000-000000000001','Walker One','w1@x','walker'),
 ('00000000-0000-0000-0000-000000000002','Walker Two','w2@x','walker');
insert into companies (name, color) values ('Company B', '#16a34a');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into stock_moves (company_id, type, qty) select id,'receive',10000 from companies where name='Company A';
insert into assignments (suburb_id, walker_id, company_id)
  select 1, '00000000-0000-0000-0000-000000000001', id from companies where name='Company A';
insert into assignments (suburb_id, walker_id, company_id)
  select 2, '00000000-0000-0000-0000-000000000002', id from companies where name='Company B';

-- walks: W1 today 1000/4h + 10 days ago 600/2h; W2 today 500/2h; one old walk 40 days ago (outside 30d)
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select submit_drop((select id from assignments where suburb_id=1), current_date, 1000, 4);
select submit_drop((select id from assignments where suburb_id=1), current_date - 10, 600, 2);
select submit_drop((select id from assignments where suburb_id=1), current_date - 40, 999, 3);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select submit_drop((select id from assignments where suburb_id=2), current_date, 500, 2);

do $$ begin  -- walkers can't read the dashboard
  perform dashboard_summary(30);
  raise exception 'FAIL: walker read dashboard';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ declare r jsonb; begin
  r := dashboard_summary(30);
  if (r->'kpi'->>'flyers')::int <> 2100 then raise exception 'FAIL flyers %', r->'kpi'->>'flyers'; end if;
  if (r->'kpi'->>'hours')::numeric <> 8 then raise exception 'FAIL hours %', r->'kpi'->>'hours'; end if;
  if (r->'kpi'->>'walks')::int <> 3 then raise exception 'FAIL walks %', r->'kpi'->>'walks'; end if;
  if (r->'kpi'->>'active_walkers')::int <> 2 then raise exception 'FAIL active walkers'; end if;
  if (r->'kpi'->>'flyers_prev')::int <> 999 then raise exception 'FAIL prev %', r->'kpi'->>'flyers_prev'; end if;
  if (r->'kpi'->>'open')::int <> 2 then raise exception 'FAIL open %', r->'kpi'->>'open'; end if;
  if (r->'kpi'->>'stock_total')::int <> 10000 then raise exception 'FAIL stock'; end if;
  if jsonb_array_length(r->'daily') <> 30 then raise exception 'FAIL daily len %', jsonb_array_length(r->'daily'); end if;
  if (r->'daily'->29->>'flyers')::int <> 1500 then raise exception 'FAIL today %', r->'daily'->29; end if;
  if r->'walkers'->0->>'name' <> 'Walker One' or (r->'walkers'->0->>'per_hour')::int <> 267 then
    raise exception 'FAIL walker row %', r->'walkers'->0; end if;
  if r->'companies'->0->>'name' <> 'Company A' or (r->'companies'->0->>'flyers')::int <> 1600 then
    raise exception 'FAIL company row %', r->'companies'->0; end if;
  if (r->'map'->'available'->>'suburbs')::int <> 1 then raise exception 'FAIL map %', r->'map'; end if;
  r := dashboard_summary(7);
  if (r->'kpi'->>'flyers')::int <> 1500 then raise exception 'FAIL 7d flyers %', r->'kpi'->>'flyers'; end if;
end $$;

reset role;
select 'ITERATION 3 TESTS PASSED';
