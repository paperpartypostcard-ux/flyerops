-- FlyerOps — iteration 3: dashboard summary for staff.
-- One call returns everything the /dashboard screen needs for the last p_days days.

create or replace function dashboard_summary(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_from date := current_date - (greatest(least(p_days, 366), 1) - 1);
  v_prev date := v_from - (greatest(least(p_days, 366), 1));
  r jsonb;
begin
  if not is_staff() then raise exception 'not allowed'; end if;

  with d as (
    select dr.*, c.name as company_name, c.color as company_color, p.full_name as walker_name
    from drops dr
    join companies c on c.id = dr.company_id
    join profiles p on p.id = dr.walker_id
    where dr.walked_on >= v_from
  ), prev as (
    select coalesce(sum(flyers), 0) as flyers from drops where walked_on >= v_prev and walked_on < v_from
  ), ov as (
    select status, count(*) as n, coalesce(sum(dwellings), 0) as dw from suburb_overview group by status
  )
  select jsonb_build_object(
    'from', v_from, 'to', current_date, 'days', current_date - v_from + 1,
    'kpi', jsonb_build_object(
      'flyers',        (select coalesce(sum(flyers), 0) from d),
      'flyers_prev',   (select flyers from prev),
      'hours',         (select coalesce(sum(hours), 0) from d),
      'walks',         (select count(*) from d),
      'active_walkers',(select count(distinct walker_id) from d),
      'suburbs_walked',(select count(distinct suburb_id) from d),
      'completed',     (select count(*) from assignments where status = 'completed' and completed_on >= v_from),
      'open',          (select count(*) from assignments where status in ('planned', 'in_progress')),
      'stock_total',   (select coalesce(sum(balance), 0) from stock_warehouse),
      'on_hand_total', (select coalesce(sum(on_hand), 0) from stock_on_hand),
      'checks',        (select count(*) from verification_checks where checked_on >= v_from),
      'checks_failed', (select count(*) from verification_checks where checked_on >= v_from and result = 'fail')
    ),
    'map', (select coalesce(jsonb_object_agg(status, jsonb_build_object('suburbs', n, 'dwellings', dw)), '{}'::jsonb) from ov),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', g.day, 'flyers', coalesce(x.flyers, 0)) order by g.day), '[]'::jsonb)
      from generate_series(v_from, current_date, interval '1 day') as g(day)
      left join (select walked_on, sum(flyers) as flyers from d group by walked_on) x on x.walked_on = g.day::date
    ),
    'companies', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.flyers desc), '[]'::jsonb) from (
        select c.name, c.color,
               coalesce(sum(d.flyers), 0)::int as flyers,
               count(distinct d.suburb_id)::int as suburbs,
               coalesce((select balance from stock_warehouse w where w.company_id = c.id), 0)::int as stock
        from companies c left join d on d.company_id = c.id
        group by c.id
      ) t
    ),
    'walkers', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.flyers desc), '[]'::jsonb) from (
        select walker_name as name, sum(flyers)::int as flyers, sum(hours)::numeric(8,2) as hours,
               case when sum(hours) > 0 then round(sum(flyers) / sum(hours)) end as per_hour,
               count(*)::int as walks, max(walked_on) as last_walk
        from d group by walker_id, walker_name
      ) t
    )
  ) into r;
  return r;
end $$;

revoke execute on function dashboard_summary(integer) from anon;
