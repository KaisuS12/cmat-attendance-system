-- CMAT Council QR Attendance System — per-day title and venue
-- Run after 0007_fast_scan.sql.
--
-- A multi-day event can be in a different place each day ("Day 1: Opening
-- at the Gym", "Day 2: Field Day at the Oval"). Both are optional: a day
-- without its own venue uses the event's venue, as before.

alter table event_days add column if not exists title text;
alter table event_days add column if not exists venue_id uuid references venues (id);

-- Same as 0004's create_event, plus each day's optional title and venueId.
create or replace function create_event(
  p_title text,
  p_description text,
  p_semester_id uuid,
  p_venue jsonb,
  p_days jsonb,
  p_actor uuid,
  p_target_programs text[] default null,
  p_target_year_levels text[] default null
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_venue_id uuid;
  v_event_id uuid;
begin
  if p_venue ? 'venueId' then
    v_venue_id := (p_venue ->> 'venueId')::uuid;
  else
    insert into venues (name, latitude, longitude, radius_meters)
    values (
      p_venue ->> 'name',
      (p_venue ->> 'latitude')::double precision,
      (p_venue ->> 'longitude')::double precision,
      coalesce((p_venue ->> 'radiusMeters')::integer, 150)
    )
    returning id into v_venue_id;
  end if;

  insert into events (title, description, venue_id, semester_id, created_by, target_programs, target_year_levels)
  values (
    p_title,
    p_description,
    v_venue_id,
    p_semester_id,
    p_actor,
    nullif(p_target_programs, '{}'),
    nullif(p_target_year_levels, '{}')
  )
  returning id into v_event_id;

  insert into event_days (event_id, day_date, sign_in_start, sign_in_end, sign_out_start, sign_out_end, title, venue_id)
  select
    v_event_id,
    (d ->> 'dayDate')::date,
    (d ->> 'signInStart')::timestamptz,
    (d ->> 'signInEnd')::timestamptz,
    (d ->> 'signOutStart')::timestamptz,
    (d ->> 'signOutEnd')::timestamptz,
    nullif(trim(d ->> 'title'), ''),
    nullif(d ->> 'venueId', '')::uuid
  from jsonb_array_elements(p_days) as d;

  return v_event_id;
end;
$$;

revoke execute on function create_event(text, text, uuid, jsonb, jsonb, uuid, text[], text[]) from public, anon, authenticated;
grant execute on function create_event(text, text, uuid, jsonb, jsonb, uuid, text[], text[]) to service_role;
