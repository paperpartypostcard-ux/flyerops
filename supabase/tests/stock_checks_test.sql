-- Iteration 2 tests: stock balances, over-issue guards, verification checks.
-- Run on an EMPTY database:
--   psql -f supabase/tests/supabase_shim.sql -f supabase/migrations/0001_init.sql \
--        -f supabase/migrations/0002_stock_checks.sql -f supabase/tests/stock_checks_test.sql
\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000b'), ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');
insert into suburbs (sal_code, name, geom) values
 ('S1','Alpha', st_multi(st_geomfromtext('POLYGON((145 -37.8,145.01 -37.8,145.01 -37.81,145 -37.81,145 -37.8))',4326)));
insert into profiles (id, full_name, email, role) values
 ('00000000-0000-0000-0000-00000000000b','Manager','m@x','manager'),
 ('00000000-0000-0000-0000-000000000001','Walker One','w1@x','walker'),
 ('00000000-0000-0000-0000-000000000002','Walker Two','w2@x','walker');
insert into companies (name) values ('Company B');

-- ── as manager
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into stock_moves (company_id, type, qty) select id,'receive',5000 from companies where name='Company A';
insert into stock_moves (company_id, walker_id, type, qty)
  select id,'00000000-0000-0000-0000-000000000001','issue',3000 from companies where name='Company A';

do $$ begin  -- over-issue blocked
  insert into stock_moves (company_id, walker_id, type, qty)
    select id,'00000000-0000-0000-0000-000000000002','issue',2001 from companies where name='Company A';
  raise exception 'FAIL: over-issue allowed';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;

do $$ begin  -- issuing a company with empty stock blocked
  insert into stock_moves (company_id, walker_id, type, qty)
    select id,'00000000-0000-0000-0000-000000000001','issue',1 from companies where name='Company B';
  raise exception 'FAIL: issue from empty stock';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;

insert into assignments (suburb_id, walker_id, company_id)
  select 1, '00000000-0000-0000-0000-000000000001', id from companies where name='Company A';

-- ── walker drops 1200
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select submit_drop((select id from assignments where suburb_id=1), current_date, 1200, 3);
do $$ declare n int; begin  -- walker can't see warehouse or checks
  select count(*) into n from stock_warehouse where received > 0;
  if n <> 0 then raise exception 'FAIL walker sees warehouse'; end if;
  select count(*) into n from walker_check_stats where checks > 0;
  if n <> 0 then raise exception 'FAIL walker sees check stats'; end if;
end $$;

-- ── back to manager
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ declare v int; begin
  select on_hand into v from stock_on_hand where walker_id='00000000-0000-0000-0000-000000000001';
  if v <> 1800 then raise exception 'FAIL on_hand %, expected 1800', v; end if;
end $$;

do $$ begin  -- can't return more than on hand
  insert into stock_moves (company_id, walker_id, type, qty)
    select id,'00000000-0000-0000-0000-000000000001','return',1801 from companies where name='Company A';
  raise exception 'FAIL: over-return allowed';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;

insert into stock_moves (company_id, walker_id, type, qty)
  select id,'00000000-0000-0000-0000-000000000001','return',800 from companies where name='Company A';
insert into stock_moves (company_id, type, qty, note)
  select id,'adjust',-100,'damaged box' from companies where name='Company A';

do $$ declare v int; h int; begin
  select balance into v from stock_warehouse w join companies c on c.id=w.company_id where c.name='Company A';
  if v <> 2700 then raise exception 'FAIL warehouse %, expected 2700', v; end if;   -- 5000-3000+800-100
  select on_hand into h from stock_on_hand where walker_id='00000000-0000-0000-0000-000000000001';
  if h <> 1000 then raise exception 'FAIL on_hand %, expected 1000', h; end if;
end $$;

insert into verification_checks (walker_id, suburb_id, method, result, notes) values
 ('00000000-0000-0000-0000-000000000001', 1, 'video', 'pass', 'ok'),
 ('00000000-0000-0000-0000-000000000001', 1, 'in_person', 'fail', 'flyers in bin');
do $$ declare r record; begin
  select * into r from walker_check_stats where walker_id='00000000-0000-0000-0000-000000000001';
  if r.checks <> 2 or r.passed <> 1 or r.failed <> 1 then raise exception 'FAIL check stats %', r; end if;
end $$;

reset role;
select 'ITERATION 2 TESTS PASSED';
