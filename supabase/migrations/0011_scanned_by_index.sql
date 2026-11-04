-- CMAT Council QR Attendance System — faster per-officer activity
-- Run after 0010_student_devices.sql.
--
-- Optional but recommended: the Officers page and each officer's activity log
-- look up attendance records by who scanned them.

create index if not exists attendance_records_scanned_by_idx
  on attendance_records (scanned_by, recorded_at desc);
