-- CMAT Council QR Attendance System — retrievable temporary passwords
-- Run after 0004_targeting_corrections.sql.
--
-- Real passwords are never stored (Supabase Auth only keeps a hash). This
-- table holds only the *temporary* password issued at import or reset, so an
-- officer can tell a student their login before the student has set their
-- own. The row is deleted as soon as the student changes their password.
--
-- RLS is on with no policies, and the API roles get no privileges: only the
-- service role (Next.js API routes, which check the caller is an officer or
-- admin and audit every view) can read it.

create table if not exists temp_passwords (
  profile_id uuid primary key references profiles (id) on delete cascade,
  password text not null,
  issued_by uuid references profiles (id),
  issued_at timestamptz not null default now()
);

alter table temp_passwords enable row level security;

revoke all on temp_passwords from anon, authenticated;
grant all on temp_passwords to service_role;
