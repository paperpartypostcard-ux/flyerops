-- Local test of schema + RLS. Mimics Supabase auth. Run on an EMPTY database:
--   psql -f supabase/tests/supabase_shim.sql -f supabase/migrations/0001_init.sql -f supabase/tests/rls_test.sql
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- fixtures (as superuser)
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), -- owner
  ('00000000-0000-0000-0000-00000000000b'), -- manager
  ('00000000-0000-0000-0000-000000000001'), -- walker 1
  ('00000000-0000-0000-0000-000000000002'); -- walker 2
insert into suburbs (sal_code, name, geom, dwellings_abs, cycle_months) values
 ('S1','Alpha', st_multi(st_geomfromtext('POLYGON((145 -37.8,145.01 -37.8,145.01 -37.81,145 -37.81,145 -37.8))',4326)), 1000, 3),
 ('S2','Beta',  st_multi(st_geomfromtext('POLYGON((145.02 -37.8,145.03 -37.8,145.03 -37.81,145.02 -37.81,145.02 -37.8))',4326)), 2000, 4);
insert into profiles (id, full_name, email, role) values
 ('00000000-0000-0000-0000-00000000000a','Owner','o@x','owner'),
 ('00000000-0000-0000-0000-00000000000b','Manager','m@x','manager'),
 ('00000000-0000-0000-0000-000000000001','Walker One','w1@x','walker'),
 ('00000000-0000-0000-0000-000000000002','Walker Two','w2@x','walker');
insert into companies (name) values ('Company B');

-- ── as manager
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into assignments (suburb_id, walker_id, company_id)
  select 1, '00000000-0000-0000-0000-000000000001', id from companies where name='Company A';
insert into assignments (suburb_id, walker_id, company_id)
  select 2, '00000000-0000-0000-0000-000000000002', id from companies where name='Company A';
insert into stock_moves (company_id, type, qty) select id,'receive',12000 from companies where name='Company A';
insert into stock_moves (company_id, walker_id, type, qty)
  select id,'00000000-0000-0000-0000-000000000001','issue',2400 from companies where name='Company A';
do $$ begin
  insert into profiles (id, full_name, email, role) values ('00000000-0000-0000-0000-000000000002','x','x','manager');
  raise exception 'FAIL: manager created staff';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;
select 'manager sees suburbs: ' || count(*) from suburb_overview;

-- ── as walker 1
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select submit_drop((select id from assignments where suburb_id=1), current_date, 1100, 3.5,
  '{"type":"LineString","coordinates":[[145.001,-37.801],[145.005,-37.805]]}'::jsonb);
do $$ declare n int; begin
  select count(*) into n from suburb_overview; if n <> 1 then raise exception 'FAIL walker sees % suburbs', n; end if;
  select count(*) into n from profiles;        if n <> 1 then raise exception 'FAIL walker sees % profiles', n; end if;
  select count(*) into n from assignments;     if n <> 1 then raise exception 'FAIL walker sees % assignments', n; end if;
  select count(*) into n from drops;           if n <> 1 then raise exception 'FAIL walker sees % drops', n; end if;
  select count(*) into n from verification_checks; if n <> 0 then raise exception 'FAIL checks visible'; end if;
  select count(*) into n from walker_stats;    if n <> 1 then raise exception 'FAIL walker_stats %', n; end if;
end $$;
select 'walker1 on hand: ' || flyers_on_hand from walker_stats;
do $$ begin  -- cannot report on walker 2's assignment
  perform submit_drop((select a.id from assignments a where a.suburb_id=2), current_date, 10, 1);
  raise exception 'FAIL: walker reported on foreign assignment';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
do $$ begin  -- cannot see coverage of foreign suburb
  perform suburb_coverage(2);
  raise exception 'FAIL: foreign coverage';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
do $$ declare n int; begin  -- cannot write directly
  update profiles set role='owner' where id = auth.uid();
  get diagnostics n = row_count; if n > 0 then raise exception 'FAIL: walker self-promoted'; end if;
end $$;
select 'walker1 coverage features: ' || jsonb_array_length(suburb_coverage(1)->'features');

-- ── manager closes assignment; cycle rule must block new one (any company)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
update assignments set status='completed', completed_on=current_date where suburb_id=1;
do $$ begin
  insert into assignments (suburb_id, walker_id, company_id)
    select 1, '00000000-0000-0000-0000-000000000002', id from companies where name='Company B';
  raise exception 'FAIL: cycle rule not enforced';
exception when others then if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'cycle rule OK: %', sqlerrm;
end $$;
select name || ': ' || status || ' next ' || coalesce(next_allowed::text,'-') from suburb_overview order by id;
select 'geojson features: ' || jsonb_array_length(suburbs_geojson()->'features');
reset role;
select 'ALL TESTS PASSED';
