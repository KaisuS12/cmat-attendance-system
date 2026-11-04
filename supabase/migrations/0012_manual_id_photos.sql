-- CMAT Council QR Attendance System — ID photo for manual entries
-- Run after 0011_scanned_by_index.sql.
--
-- Manual entry skips the QR and GPS checks, so each new one needs a photo of
-- the student's ID, taken live, for admins to check against the record.
-- Photos are personal data: the bucket is private with no policies (only the
-- server's service role can reach it), admins view them through short-lived
-- links, and each photo is deleted after 90 days. The record and reason stay.

alter table attendance_records add column if not exists proof_photo_path text;
alter table attendance_records add column if not exists proof_photo_deleted_at timestamptz;

create index if not exists attendance_records_proof_photo_idx
  on attendance_records (recorded_at) where proof_photo_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manual-id-photos', 'manual-id-photos', false, 1048576, array['image/jpeg'])
on conflict (id) do nothing;
