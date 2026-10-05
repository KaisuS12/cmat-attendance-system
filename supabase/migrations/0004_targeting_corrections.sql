-- CMAT Council QR Attendance System — event targeting & record corrections
-- Run after 0003_grants.sql.

-- ─────────────────────────────────────────────────────────────────────────
-- Program / year-specific events. NULL or an empty array means "everyone".
-- Values are matched case- and whitespace-insensitively against
-- profiles.program / profiles.year_level (see src/lib/eligibility.ts).
-- ─────────────────────────────────────────────────────────────────────────

alter table events add column if not exists target_programs text[];
alter table events add column if not exists target_year_levels text[];

-- ─────────────────────────────────────────────────────────────────────────
-- Voiding attendance records. A wrong record (wrong student scanned, a
-- mistaken manual entry) is voided, never deleted, so the audit trail stays
-- intact. Voided rows are ignored everywhere attendance is counted.
-- ─────────────────────────────────────────────────────────────────────────

alter table attendance_records add column if not exists voided_at timestamptz;
alter table attendance_records add column if not exists voided_by uuid references profiles (id);
alter table attendance_records add column if not exists void_reason text;

alter table attendance_records drop constraint if exists attendance_records_void_check;
alter table attendance_records add constraint attendance_records_void_check check (
  voided_at is null
  or (voided_by is not null and void_reason is not null and length(trim(void_reason)) > 0)
);

-- One live sign-in and one live sign-out per student per day; a voided
-- record no longer blocks recording the correct one.
alter table attendance_records drop constraint if exists attendance_records_event_day_id_student_id_type_key;
create unique index if not exists attendance_records_one_live_per_type
  on attendance_records (event_day_id, student_id, type)
  where voided_at is null;

-- ─────────────────────────────────────────────────────────────────────────
-- create_event: now also takes the event's target programs / year levels.
-- ─────────────────────────────────────────────────────────────────────────

drop function if exists create_event(text, text, uuid, jsonb, jsonb, uuid);

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

  insert into event_days (event_id, day_date, sign_in_start, sign_in_end, sign_out_start, sign_out_end)
  select
    v_event_id,
    (d ->> 'dayDate')::date,
    (d ->> 'signInStart')::timestamptz,
    (d ->> 'signInEnd')::timestamptz,
    (d ->> 'signOutStart')::timestamptz,
    (d ->> 'signOutEnd')::timestamptz
  from jsonb_array_elements(p_days) as d;

  return v_event_id;
end;
$$;

revoke execute on function create_event(text, text, uuid, jsonb, jsonb, uuid, text[], text[]) from public, anon, authenticated;
grant execute on function create_event(text, text, uuid, jsonb, jsonb, uuid, text[], text[]) to service_role;
