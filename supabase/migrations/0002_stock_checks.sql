-- FlyerOps — iteration 2: flyer stock balances + verification checks journal
-- Safe to run once on top of 0001_init.sql.

-- ───────────── Stock balances ─────────────
-- Warehouse per company: receive (+), issue (−), return (+), adjust (±)
create or replace view stock_warehouse with (security_invoker = true) as
select c.id as company_id, c.name as company_name, c.color as company_color,
       coalesce(sum(m.qty) filter (where m.type = 'receive'), 0)::int as received,
       coalesce(sum(m.qty) filter (where m.type = 'issue'), 0)::int   as issued,
       coalesce(sum(m.qty) filter (where m.type = 'return'), 0)::int  as returned,
       coalesce(sum(m.qty) filter (where m.type = 'adjust'), 0)::int  as adjusted,
       coalesce(sum(case m.type when 'receive' then m.qty when 'issue' then -m.qty
                                when 'return' then m.qty when 'adjust' then m.qty end), 0)::int as balance
from companies c
left join stock_moves m on m.company_id = c.id
group by c.id;

-- On hand per walker & company: issued − returned − dropped
create or replace view stock_on_hand with (security_invoker = true) as
with moves as (
  select walker_id, company_id,
         sum(case type when 'issue' then qty when 'return' then -qty else 0 end) as net
  from stock_moves where walker_id is not null group by walker_id, company_id
), dropped as (
  select walker_id, company_id, sum(flyers) as flyers from drops group by walker_id, company_id
)
select p.id as walker_id, p.full_name as walker_name, c.id as company_id, c.name as company_name,
       coalesce(m.net, 0)::int as issued_net,
       coalesce(d.flyers, 0)::int as dropped,
       (coalesce(m.net, 0) - coalesce(d.flyers, 0))::int as on_hand
from profiles p
cross join companies c
left join moves m   on m.walker_id = p.id and m.company_id = c.id
left join dropped d on d.walker_id = p.id and d.company_id = c.id
where p.role = 'walker' and (m.net is not null or d.flyers is not null);

-- Can't issue more than the warehouse holds; can't take back more than the walker holds.
create or replace function check_stock_move() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_wh int; v_hand int;
begin
  if new.type = 'issue' then
    select balance into v_wh from stock_warehouse where company_id = new.company_id;
    if coalesce(v_wh, 0) < new.qty then
      raise exception 'Not enough flyers in stock: % available', coalesce(v_wh, 0);
    end if;
  elsif new.type = 'return' then
    select on_hand into v_hand from stock_on_hand
      where walker_id = new.walker_id and company_id = new.company_id;
    if coalesce(v_hand, 0) < new.qty then
      raise exception 'Walker holds only % flyers of this company', coalesce(v_hand, 0);
    end if;
  elsif new.type = 'adjust' and new.qty = 0 then
    raise exception 'Adjustment must not be zero';
  end if;
  return new;
end $$;
create trigger stock_moves_check before insert on stock_moves
  for each row execute function check_stock_move();

-- ───────────── Verification checks ─────────────
create index if not exists verification_checks_walker_idx on verification_checks (walker_id, checked_on desc);

-- Pass rate per walker (staff only via RLS on underlying tables)
create or replace view walker_check_stats with (security_invoker = true) as
select p.id as walker_id, p.full_name,
       count(v.id)::int as checks,
       count(v.id) filter (where v.result = 'pass')::int as passed,
       count(v.id) filter (where v.result = 'fail')::int as failed,
       max(v.checked_on) as last_checked
from profiles p
left join verification_checks v on v.walker_id = p.id
where p.role = 'walker'
group by p.id;

revoke all on stock_warehouse, stock_on_hand, walker_check_stats from anon;
