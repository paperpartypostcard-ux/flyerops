-- FlyerOps — deactivated walkers can't report walks (app also blocks their sign-in).
create or replace function submit_drop(
  p_assignment uuid, p_walked_on date, p_flyers integer, p_hours numeric,
  p_track jsonb default null, p_notes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare a assignments; v_id uuid; v_geom geometry;
begin
  select * into a from assignments where id = p_assignment;
  if a.id is null then raise exception 'assignment not found'; end if;
  if not (is_staff() or a.walker_id = auth.uid()) then raise exception 'not allowed'; end if;
  if not exists (select 1 from profiles where id = a.walker_id and status = 'active') then
    raise exception 'walker account is inactive';
  end if;
  if a.status not in ('planned','in_progress') then raise exception 'assignment is closed'; end if;
  if p_track is not null then
    v_geom := st_multi(st_force2d(st_setsrid(st_geomfromgeojson(p_track::text), 4326)));
  end if;
  insert into drops (assignment_id, walker_id, suburb_id, company_id, walked_on, flyers, hours, track, notes)
  values (a.id, a.walker_id, a.suburb_id, a.company_id, p_walked_on, p_flyers, p_hours, v_geom, p_notes)
  returning id into v_id;
  return v_id;
end $$;

