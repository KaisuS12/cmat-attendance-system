export type UserRole = "admin" | "officer" | "student";
export type AttendanceType = "sign_in" | "sign_out";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  student_id: string | null;
  program: string | null;
  year_level: string | null;
  section: string | null;
  created_at: string;
}

export interface Semester {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface Venue {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  created_at: string;
}

export interface EventRecord {
  id: string;
  title: string;
  description: string | null;
  venue_id: string;
  semester_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventDay {
  id: string;
  event_id: string;
  day_date: string;
  sign_in_start: string;
  sign_in_end: string;
  sign_out_start: string;
  sign_out_end: string;
  created_at: string;
  updated_at: string;
}

export interface QrToken {
  id: string;
  student_id: string;
  event_day_id: string;
  type: AttendanceType;
  issued_latitude: number;
  issued_longitude: number;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  event_day_id: string;
  student_id: string;
  type: AttendanceType;
  qr_token_id: string;
  scanned_by: string;
  recorded_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}
