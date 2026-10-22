-- CMAT Council QR Attendance System — one-trip scan
-- Run after 0006_school_year.sql.
--
-- A scan used to make four calls in a row from the API (look up the token,
-- claim it, insert the attendance record, read the student's name). This
-- does all of it in one call and one transaction, so the officer sees the
-- result sooner and the claim and the record always succeed or fail together.
-- The rules are unchanged.

create or replace function record_scan(p_jti uuid, p_event_day_id uuid, p_officer uuid)
returns jsonb
language plpgsql set search_path = public as $$
declare
  t qr_tokens%rowtype;
  v_record_id uuid;
  v_recorded_at timestamptz;
  s profiles%rowtype;
begin
  select * into t from qr_tokens where id = p_jti;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- Checked before claiming, so scanning at the wrong event's scanner
  -- doesn't use up the student's code.
  if p_event_day_id is not null and p_event_day_id <> t.event_day_id then
    return jsonb_build_object('status', 'wrong_event');
  end if;

  -- Claim: only once, and only before it expires.
  update qr_tokens set used_at = now()
  where id = t.id and used_at is null and expires_at > now();
  if not found then
    return jsonb_build_object('status', 'used_or_expired');
  end if;

  begin
    insert into attendance_records (event_day_id, student_id, type, qr_token_id, scanned_by)
    values (t.event_day_id, t.student_id, t.type, t.id, p_officer)
    returning id, recorded_at into v_record_id, v_recorded_at;
  exception when unique_violation then
    return jsonb_build_object('status', 'already_recorded', 'type', t.type);
  end;

  select * into s from profiles where id = t.student_id;

  return jsonb_build_object(
    'status', 'recorded',
    'type', t.type,
    'record_id', v_record_id,
    'recorded_at', v_recorded_at,
    'student_profile_id', t.student_id,
    'student', jsonb_build_object(
      'full_name', s.full_name,
      'student_id', s.student_id,
      'program', s.program,
      'year_level', s.year_level,
      'section', s.section
    )
  );
end;
$$;

revoke execute on function record_scan(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function record_scan(uuid, uuid, uuid) to service_role;
