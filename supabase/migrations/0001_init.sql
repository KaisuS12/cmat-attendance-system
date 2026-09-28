-- CMAT Council QR Attendance System — initial schema
-- Run this against a fresh Supabase project (SQL Editor, or `supabase db push`).

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- Roles & profiles
-- ─────────────────────────────────────────────────────────────────────────

create type user_role as enum ('admin', 'officer', 'student');

-- One row per auth.users row. student_id is the login identifier for students
-- (§7 of the design doc); officers/admins log in with their auth.users email.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'student',
  full_name text not null,
  student_id text unique,
  program text,
  year_level text,
  section text,
  created_at timestamptz not null default now()
);

create index profiles_role_idx on profiles (role);
create index profiles_student_id_idx on profiles (student_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Semesters (Admin-configured, §3.1)
-- ─────────────────────────────────────────────────────────────────────────

create table semesters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Only one active semester at a time.
create unique index semesters_one_active_idx on semesters (is_active) where is_active;

-- ─────────────────────────────────────────────────────────────────────────
-- Venues & events
-- ─────────────────────────────────────────────────────────────────────────

create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null default 150,
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  venue_id uuid not null references venues (id),
  semester_id uuid references semesters (id),
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Each day of a (possibly multi-day) event has its own independent
-- sign-in / sign-out windows (§4.1).
create table event_days (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  day_date date not null,
  sign_in_start timestamptz not null,
  sign_in_end timestamptz not null,
  sign_out_start timestamptz not null,
  sign_out_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, day_date)
);

create index event_days_event_idx on event_days (event_id);

-- ─────────────────────────────────────────────────────────────────────────
-- QR tokens (server-issued, short-lived, single-use — §6)
-- ─────────────────────────────────────────────────────────────────────────

create type attendance_type as enum ('sign_in', 'sign_out');

-- The QR itself encodes a signed JWT whose `jti` matches this row's id.
-- Signing proves the token wasn't forged; this row is what enforces
-- single-use and lets a scan be validated without trusting the client.
create table qr_tokens (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id),
  event_day_id uuid not null references event_days (id),
  type attendance_type not null,
  issued_latitude double precision not null,
  issued_longitude double precision not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index qr_tokens_student_idx on qr_tokens (student_id);
create index qr_tokens_expires_idx on qr_tokens (expires_at);

-- ─────────────────────────────────────────────────────────────────────────
-- Attendance records
-- ─────────────────────────────────────────────────────────────────────────

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  event_day_id uuid not null references event_days (id),
  student_id uuid not null references profiles (id),
  type attendance_type not null,
  qr_token_id uuid not null references qr_tokens (id),
  scanned_by uuid not null references profiles (id),
  recorded_at timestamptz not null default now(),
  -- one sign-in and one sign-out per student per day
  unique (event_day_id, student_id, type)
);

create index attendance_records_student_idx on attendance_records (student_id);
create index attendance_records_event_day_idx on attendance_records (event_day_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Audit log (§4.2) — accountability for event creation and
-- attendance-affecting setting changes, full visibility for Admin only.
-- ─────────────────────────────────────────────────────────────────────────

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_actor_idx on audit_log (actor_id);
create index audit_log_created_idx on audit_log (created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- All rows in the tables below are only ever written by Next.js API routes
-- running under the Supabase service-role key (see src/lib/supabase/admin.ts).
-- That's deliberate: geofence checks, window validity, and single-use token
-- enforcement all have to happen server-side, where the client can't lie
-- about its location or replay a request. RLS here exists for read access
-- and as defense in depth, not as the primary write gate.
-- ─────────────────────────────────────────────────────────────────────────

alter table profiles enable row level security;
alter table semesters enable row level security;
alter table venues enable row level security;
alter table events enable row level security;
alter table event_days enable row level security;
alter table qr_tokens enable row level security;
alter table attendance_records enable row level security;
alter table audit_log enable row level security;

create function current_user_role() returns user_role
language sql stable security definer as $$
  select role from profiles where id = auth.uid();
$$;

-- profiles: a user can read their own row; officers/admins can read all
-- (an officer needs to look up names during scanning; admin needs full visibility).
create policy profiles_select on profiles for select
  using (id = auth.uid() or current_user_role() in ('admin', 'officer'));

create policy profiles_update_own on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- semesters, venues, events, event_days: readable by any signed-in user
create policy semesters_select on semesters for select using (auth.uid() is not null);
create policy venues_select on venues for select using (auth.uid() is not null);
create policy events_select on events for select using (auth.uid() is not null);
create policy event_days_select on event_days for select using (auth.uid() is not null);

-- attendance_records: a student can see only their own; officers/admins see all
create policy attendance_select on attendance_records for select
  using (student_id = auth.uid() or current_user_role() in ('admin', 'officer'));

-- audit_log: admin only, per §4.2
create policy audit_log_select on audit_log for select
  using (current_user_role() = 'admin');

-- qr_tokens: a student may see their own tokens (e.g. to poll expiry client-side)
create policy qr_tokens_select on qr_tokens for select
  using (student_id = auth.uid());
