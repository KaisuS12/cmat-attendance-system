-- CMAT Council QR Attendance System — explicit Data API grants
-- Run after 0002_hardening.sql.
--
-- Newer Supabase projects can be created with "automatically expose new
-- tables" turned off, in which case the API roles get no privileges on the
-- tables above and every query fails with "permission denied". Granting
-- explicitly makes setup work either way. It's safe to re-run, and RLS still
-- decides which rows each signed-in user can actually see.

grant usage on schema public to anon, authenticated, service_role;

-- Signed-in users only read through the API; every write goes through
-- service-role API routes (see the RLS note in 0001_init.sql).
grant select on
  profiles,
  semesters,
  venues,
  events,
  event_days,
  qr_tokens,
  attendance_records,
  audit_log
to authenticated;

-- The service role (Next.js API routes) needs full access.
grant all on all tables in schema public to service_role;

-- RLS policies call this function as the signed-in user.
grant execute on function current_user_role() to authenticated, service_role;
