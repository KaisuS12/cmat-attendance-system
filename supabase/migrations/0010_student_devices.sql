-- CMAT Council QR Attendance System — phones per student account
-- Run after 0009_sessions_signin_only.sql.
--
-- Stops "buddy sign-in": a friend at the venue logging in to an absent
-- classmate's account on their own phone. Each student account works on at
-- most 2 phones, and each phone works for only one student account. A phone
-- is identified by a random id kept in a cookie (stored here only as a hash).
-- Officers can reset a student's phones (new or lost phone).
--
-- Service role only (Next.js API routes); RLS on with no policies.

create table if not exists student_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  device_hash text not null,
  user_agent text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (profile_id, device_hash)
);
create index if not exists student_devices_hash_idx on student_devices (device_hash);

alter table student_devices enable row level security;
revoke all on student_devices from anon, authenticated;
grant all on student_devices to service_role;
