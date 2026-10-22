-- CMAT Council QR Attendance System — new school year
-- Run after 0005_temp_passwords.sql.
--
-- Moving every student up a year (and graduating the last year) would
-- otherwise rewrite history: reports decide "was this event meant for this
-- student?" from the student's current program/year. So before the first
-- promotion touches anyone, each semester's class list is frozen in
-- semester_roster, and past reports read from it.

-- Graduated students keep their login (read-only: history only).
alter table profiles add column if not exists graduated_at timestamptz;

-- How many years each program runs (default 4 when a program isn't listed).
create table if not exists program_settings (
  program text primary key,
  years int not null default 4 check (years between 1 and 6),
  updated_at timestamptz not null default now()
);

-- Each student's program/year as they were during a semester.
create table if not exists semester_roster (
  semester_id uuid not null references semesters (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  program text,
  year_level text,
  primary key (semester_id, profile_id)
);
create index if not exists semester_roster_profile_idx on semester_roster (profile_id);

-- One row per promotion, with what changed, so it can be undone.
create table if not exists year_promotions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles (id),
  undone_at timestamptz,
  changes jsonb not null -- [{ "id": uuid, "from": text, "to": text|null, "graduated": bool }]
);

alter table program_settings enable row level security;
alter table semester_roster enable row level security;
alter table year_promotions enable row level security;

create policy program_settings_select on program_settings for select
  using (current_user_role() in ('admin', 'officer'));
create policy semester_roster_select on semester_roster for select
  using (profile_id = auth.uid() or current_user_role() in ('admin', 'officer'));

revoke all on program_settings, semester_roster, year_promotions from anon, authenticated;
grant select on program_settings, semester_roster to authenticated;
grant all on program_settings, semester_roster, year_promotions to service_role;

-- Applies a promotion computed (and re-checked) by the API, atomically:
-- freeze the class lists of the school year that's ending (p_last_semester
-- and every earlier semester that doesn't have one yet; a semester created
-- in advance for the new school year is left alone), record the batch for
-- undo, then update the students.
create or replace function apply_school_year(p_actor uuid, p_changes jsonb, p_last_semester uuid)
returns uuid
language plpgsql set search_path = public as $$
declare
  v_id uuid;
begin
  insert into semester_roster (semester_id, profile_id, program, year_level)
  select s.id, p.id, p.program, p.year_level
  from semesters s
  cross join profiles p
  where p.role = 'student'
    and p.graduated_at is null
    and s.start_date <= (select start_date from semesters where id = p_last_semester)
    and not exists (select 1 from semester_roster r where r.semester_id = s.id)
  on conflict do nothing;

  insert into year_promotions (created_by, changes) values (p_actor, p_changes) returning id into v_id;

  update profiles p
  set year_level = coalesce(c.to_year, p.year_level),
      graduated_at = case when c.graduated then now() else p.graduated_at end
  from jsonb_to_recordset(p_changes) as c(id uuid, "from" text, to_year text, graduated boolean)
  where p.id = c.id and p.role = 'student' and p.graduated_at is null;

  return v_id;
end;
$$;

-- Puts a batch back the way it was (within 24 hours). The frozen class
-- lists stay: they were correct either way.
create or replace function undo_school_year(p_id uuid)
returns int
language plpgsql set search_path = public as $$
declare
  v_changes jsonb;
  v_count int;
begin
  select changes into v_changes
  from year_promotions
  where id = p_id and undone_at is null and created_at > now() - interval '24 hours'
  for update;
  if v_changes is null then
    raise exception 'promotion not found, already undone, or older than 24 hours';
  end if;

  update profiles p
  set year_level = c."from",
      graduated_at = null
  from jsonb_to_recordset(v_changes) as c(id uuid, "from" text, to_year text, graduated boolean)
  where p.id = c.id;
  get diagnostics v_count = row_count;

  update year_promotions set undone_at = now() where id = p_id;
  return v_count;
end;
$$;

revoke execute on function apply_school_year(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function apply_school_year(uuid, jsonb, uuid) to service_role;
revoke execute on function undo_school_year(uuid) from public, anon, authenticated;
grant execute on function undo_school_year(uuid) to service_role;
