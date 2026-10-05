-- CMAT Council QR Attendance System — hardening & production features
-- Run after 0001_init.sql (SQL Editor, or `supabase db push`).

-- ─────────────────────────────────────────────────────────────────────────
-- Security fixes
-- ─────────────────────────────────────────────────────────────────────────

-- This policy let any signed-in user update *every* column of their own
-- profile row — including `role` — straight from the browser with the public
-- anon key, i.e. a student could make themselves an admin. Nothing in the app
-- relies on it (all profile writes go through service-role API routes), so
-- with it gone RLS denies all client-side profile updates.
drop policy if exists profiles_update_own on profiles;

-- Pin search_path on the security definer function so it can't be hijacked
-- by objects in another schema.
create or replace function current_user_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Profiles: account lifecycle
-- ─────────────────────────────────────────────────────────────────────────

-- Set on every admin-issued temporary password; the proxy forces a password
-- change before anything else is reachable.
alter table profiles add column if not exists must_change_password boolean not null default false;

-- Deactivated accounts are also banned in Supabase Auth; this flag is what the
-- app checks per request, since an already-issued session outlives the ban.
alter table profiles add column if not exists is_active boolean not null default true;

-- Officers/admins log in by email; keep it on the profile so officer lists
-- don't need a round trip to the Auth admin API.
alter table profiles add column if not exists email text;

update profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.role <> 'student' and p.email is null;

create index if not exists profiles_full_name_idx on profiles (lower(full_name));

-- ─────────────────────────────────────────────────────────────────────────
-- Manual attendance entries (officer override for students who can't
-- generate a QR)
-- ─────────────────────────────────────────────────────────────────────────

alter table attendance_records alter column qr_token_id drop not null;
alter table attendance_records add column if not exists method text not null default 'qr';
alter table attendance_records add column if not exists manual_reason text;

alter table attendance_records drop constraint if exists attendance_records_method_check;
alter table attendance_records add constraint attendance_records_method_check check (
  (method = 'qr' and qr_token_id is not null)
  or (method = 'manual' and manual_reason is not null and length(trim(manual_reason)) > 0)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Event day window sanity. NOT VALID so existing rows don't block the
-- migration; every new or updated row is still checked.
-- ─────────────────────────────────────────────────────────────────────────

alter table event_days drop constraint if exists event_days_sign_in_order;
alter table event_days add constraint event_days_sign_in_order
  check (sign_in_start < sign_in_end) not valid;

alter table event_days drop constraint if exists event_days_sign_out_order;
alter table event_days add constraint event_days_sign_out_order
  check (sign_out_start < sign_out_end) not valid;

-- Unscanned QR tokens shouldn't block deleting an event that has no
-- attendance yet.
alter table qr_tokens drop constraint if exists qr_tokens_event_day_id_fkey;
alter table qr_tokens add constraint qr_tokens_event_day_id_fkey
  foreign key (event_day_id) references event_days (id) on delete cascade;

-- ─────────────────────────────────────────────────────────────────────────
-- Atomic multi-step writes (called only by service-role API routes)
-- ─────────────────────────────────────────────────────────────────────────

-- Venue (optional) + event + all its days in one transaction, so a failure
-- part-way can't leave an event with no days or an orphaned venue.
create or replace function create_event(
  p_title text,
  p_description text,
  p_semester_id uuid,
  p_venue jsonb,
  p_days jsonb,
  p_actor uuid
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

  insert into events (title, description, venue_id, semester_id, created_by)
  values (p_title, p_description, v_venue_id, p_semester_id, p_actor)
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

-- Deactivate-others + activate-this as one statement pair in one transaction,
-- so there's never a moment (or a failure) with zero or two active semesters.
create or replace function set_active_semester(p_id uuid) returns void
language plpgsql set search_path = public as $$
begin
  update semesters set is_active = false where is_active and id <> p_id;
  update semesters set is_active = true where id = p_id;
  if not found then
    raise exception 'Semester % not found', p_id;
  end if;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, which would expose these via
-- the anon key. Only the service role (API routes) may call them.
revoke execute on function create_event(text, text, uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke execute on function set_active_semester(uuid) from public, anon, authenticated;
grant execute on function create_event(text, text, uuid, jsonb, jsonb, uuid) to service_role;
grant execute on function set_active_semester(uuid) to service_role;
