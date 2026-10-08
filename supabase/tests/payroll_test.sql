-- Iteration 4 tests: rate, payroll, recommendations.
--   psql -f supabase/tests/supabase_shim.sql -f supabase/migrations/0001_init.sql -f supabase/migrations/0002_stock_checks.sql \
--        -f supabase/migrations/0003_dashboard.sql -f supabase/migrations/0004_payroll_recommend.sql -f supabase/tests/payroll_test.sql
\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into suburbs (sal_code, name, geom, dwellings_abs) values
 ('S1','Near',  st_multi(st_geomfromtext('POLYGON((145 -37.8,145.01 -37.8,145.01 -37.81,145 -37.81,145 -37.8))',4326)), 1000),
 ('S2','Far',   st_multi(st_geomfromtext('POLYGON((145.5 -37.8,145.51 -37.8,145.51 -37.81,145.5 -37.81,145.5 -37.8))',4326)), 5000),
 ('S3','Home',  st_multi(st_geomfromtext('POLYGON((145.02 -37.8,145.03 -37.8,145.03 -37.81,145.02 -37.81,145.02 -37.8))',4326)), 800),
 ('S4','Excl',  st_multi(st_geomfromtext('POLYGON((145.04 -37.8,145.05 -37.8,145.05 -37.81,145.04 -37.81,145.04 -37.8))',4326)), 9000);
update suburbs set excluded = true where name = 'Excl';
insert into profiles (id, full_name, email, role, home_suburb_id) values
 ('00000000-0000-0000-0000-00000000000a','Owner','o@x','owner', null),
 ('00000000-0000-0000-0000-00000000000b','Manager','m@x','manager', null),
 ('00000000-0000-0000-0000-000000000001','Walker One','w1@x','walker', 3),
 ('00000000-0000-0000-0000-000000000002','Walker Two','w2@x','walker', null);

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into assignments (suburb_id, walker_id, company_id)
  select 3, '00000000-0000-0000-0000-000000000001', id from companies where name='Company A';

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select submit_drop((select id from assignments where suburb_id=3), current_date, 1000, 4);
select submit_drop((select id from assignments where suburb_id=3), current_date - 1, 1200, 4);
select submit_drop((select id from assignments where suburb_id=3), current_date - 40, 500, 2);
do $$ begin
  perform * from payroll(current_date - 30, current_date);
  raise exception 'FAIL: walker read payroll';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
do $$ declare n int; begin
  select count(*) into n from app_settings; if n <> 0 then raise exception 'FAIL walker sees settings'; end if;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ declare r record; n int; begin
  select * into r from payroll(current_date - 6, current_date) where walker_id = '00000000-0000-0000-0000-000000000001';
  if r.flyers <> 2200 or r.earnings <> 275.00 or r.walks <> 2 then raise exception 'FAIL payroll %', r; end if;
  select count(*) into n from payroll(current_date - 6, current_date); -- active walker 2 listed with 0
  if n <> 2 then raise exception 'FAIL payroll rows %', n; end if;
  update app_settings set rate_per_1000 = 999;               -- manager can't change the rate
  if (select rate_per_1000 from app_settings) <> 125 then raise exception 'FAIL manager changed rate'; end if;

  -- recommendations: excluded and in-progress suburbs never suggested
  select count(*) into n from recommend_suburbs(null, 10) where name in ('Excl', 'Home');
  if n <> 0 then raise exception 'FAIL recommends excluded/busy'; end if;
  -- without walker: more dwellings first among never-walked
  if (select name from recommend_suburbs(null, 1)) <> 'Far' then raise exception 'FAIL default order'; end if;
  -- with walker living in Home: nearest first
  if (select name from recommend_suburbs('00000000-0000-0000-0000-000000000001', 1)) <> 'Near' then
    raise exception 'FAIL nearest order'; end if;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update app_settings set rate_per_1000 = 130;
do $$ begin
  if (select earnings from payroll(current_date - 6, current_date) where walker_id = '00000000-0000-0000-0000-000000000001') <> 286.00
  then raise exception 'FAIL owner rate change'; end if;
end $$;

reset role;
select 'ITERATION 4 TESTS PASSED';
