# CMAT Council QR Attendance System

QR-based attendance tracking for the CMAT departmental student council. See
[`CMAT_QR_Attendance_System_Documentation.md`](./CMAT_QR_Attendance_System_Documentation.md)
for the full design doc this app implements.

**Stack:** Next.js (App Router, TypeScript) · Supabase (Postgres + Auth) · Tailwind CSS.

## Setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the Supabase SQL Editor, run [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) to create the schema.
3. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — same page, `service_role` secret. **Server-only, never commit this.**
   - `QR_TOKEN_SECRET` — any long random string, e.g. `openssl rand -base64 32`.
4. Install dependencies and run the dev server:
   ```bash
   npm install
   npm run dev
   ```
5. Create the first admin account manually (there's no self-serve admin signup, by design):
   - In the Supabase dashboard → Authentication → Users → **Add user**, create one with an email + password.
   - In the SQL Editor, insert their profile row:
     ```sql
     insert into profiles (id, role, full_name)
     values ('<the-user-id-from-auth>', 'admin', 'Your Name');
     ```
   - Log in at `/login` under the "Officer / Admin" tab.

From the admin dashboard you can then create officer accounts (§7: school email + password) and, once
the student masterlist and written permission are in hand (§9), bulk-import students via
`POST /api/students/bulk-import`.

## How the design doc's requirements map to this code

| Doc section | Where it lives |
|---|---|
| §3 Roles | `profiles.role` enum + route protection in `src/middleware.ts` |
| §4.1 Event windows, multi-day, live extension | `event_days` table (one row per day); `PATCH /api/events/[id]/days/[dayId]` |
| §4.2 Audit log | `audit_log` table, written via `src/lib/audit.ts` from every state-changing API route; readable only by admins (RLS) |
| §4.3 QR sign-in/out, 60s single-use | `src/lib/tokens.ts` (signed JWT) + `qr_tokens` table (claims/single-use) |
| §5 GPS geofencing | `src/lib/geofence.ts`, enforced server-side in `POST /api/attendance/generate-token` — never trusted from the client alone |
| §6 On-demand, non-permanent QR | QR is generated client-side from a server-issued token per action, never stored as an image |
| §7 Auth | Students: student ID → synthetic email (`src/lib/constants.ts`) + Supabase Auth. Officers/Admins: school email + Supabase Auth |
| §9 Masterlist import | `POST /api/students/bulk-import` |

## Open items from the design doc (§10–11) not yet resolved in code

- Exact student login identifier format — currently accepts any string as the student ID.
- Offline queueing for poor venue connectivity — not implemented; a failed `generate-token`/`scan`
  request currently just fails and must be retried once back online.
- Manual override entry for students who can't generate a QR — not implemented.
- Reporting/export (Excel/PDF) — not implemented; attendance can currently only be read via the
  officer event view and the student history view.
