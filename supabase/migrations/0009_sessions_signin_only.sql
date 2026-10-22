-- CMAT Council QR Attendance System — sessions and sign-in-only attendance
-- Run after 0008_day_title_venue.sql.
--
-- 1. Sessions: a whole-day event takes attendance twice (morning and
--    afternoon), so one date can have several attendance slots, each with a
--    session name. Each slot keeps its own scanner, counts and clearance
--    column.
-- 2. Sign-in only: when a slot has no sign-out (planned, or announced late),
--    signing in alone counts as present. The sign-out window columns stay
--    filled (set to the end of sign-in) so "is this day over?" checks keep
--    working.

alter table event_days add column if not exists session text not null default '';
alter table event_days add column if not exists sign_out_required boolean not null default true;

alter table event_days drop constraint if exists event_days_event_id_day_date_key;
alter table event_days drop constraint if exists event_days_event_id_day_date_session_key;
alter table event_days add constraint event_days_event_id_day_date_session_key unique (event_id, day_date, session);

-- Same as 0008's create_event, plus each slot's session and signOutRequired.
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

  insert into event_days (event_id, day_date, sign_in_start, sign_in_end, sign_out_start, sign_out_end, title, venue_id, session, sign_out_required)
  select
    v_event_id,
    (d ->> 'dayDate')::date,
    (d ->> 'signInStart')::timestamptz,
    (d ->> 'signInEnd')::timestamptz,
    (d ->> 'signOutStart')::timestamptz,
    (d ->> 'signOutEnd')::timestamptz,
    nullif(trim(d ->> 'title'), ''),
    nullif(d ->> 'venueId', '')::uuid,
    coalesce(trim(d ->> 'session'), ''),
    coalesce((d ->> 'signOutRequired')::boolean, true)
  from jsonb_array_elements(p_days) as d;

  return v_event_id;
end;
$$;

revoke execute on function create_event(text, text, uuid, jsonb, jsonb, uuid, text[], text[]) from public, anon, authenticated;
grant execute on function create_event(text, text, uuid, jsonb, jsonb, uuid, text[], text[]) to service_role;
