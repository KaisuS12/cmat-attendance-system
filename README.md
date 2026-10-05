# CMAT Council QR Attendance System

QR-based attendance tracking for the CMAT departmental student council. See
[`CMAT_QR_Attendance_System_Documentation.md`](./CMAT_QR_Attendance_System_Documentation.md)
for the full design doc this app implements.

**Stack:** Next.js 16 (App Router, TypeScript) · Supabase (Postgres + Auth) · Tailwind CSS · Vercel.

## How it works

1. A student taps **Sign in** on an event day. Their phone's GPS position is sent to the server, which checks the
   time window and the venue radius, then issues a **60-second, single-use** QR code.
2. An officer scans it with the **scanner page** (any phone browser). The student's name, ID and section appear in
   large type so the officer can check it's really them, and the record is saved.
3. Students without a working phone can be added by an officer under **Manual entry** (reason required, flagged, and
   audited).
4. Students print their **attendance record** for clearance; admins export a **clearance CSV** per semester and
   officers export **per-event CSVs**.

## Setup (local development)

1. Create a project at [supabase.com](https://supabase.com).
2. In the Supabase **SQL Editor**, run both migrations **in order**:
   - [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
   - [`supabase/migrations/0002_hardening.sql`](./supabase/migrations/0002_hardening.sql) — **required**: it closes
     a hole that let any signed-in user make themselves admin, and adds the columns and functions the app now uses.
   - [`supabase/migrations/0003_grants.sql`](./supabase/migrations/0003_grants.sql) — explicit table grants, needed
     on projects created with "automatically expose new tables" turned off (safe to run either way).
   - [`supabase/migrations/0004_targeting_corrections.sql`](./supabase/migrations/0004_targeting_corrections.sql) —
     program/year-specific events and voidable attendance records. **Required** by the current app.
   - [`supabase/migrations/0005_temp_passwords.sql`](./supabase/migrations/0005_temp_passwords.sql) — lets officers
     view a student's *temporary* password until the student sets their own. **Required** by the current app.
3. In Supabase → **Authentication → Sign In / Providers**, turn **off** “Allow new users to sign up”. All accounts are
   created by admins; leaving public sign-up on lets anyone create an account with the public anon key.
4. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project Settings → Data API (Project URL).
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API Keys: the **publishable** key (`sb_publishable_…`),
     or the legacy `anon` key.
   - `SUPABASE_SERVICE_ROLE_KEY` — same page: a **secret** key (`sb_secret_…`), or the legacy `service_role` key.
     **Server-only, never commit this.**
   - `QR_TOKEN_SECRET` — any long random string, e.g. `openssl rand -base64 32`.
   - `NEXT_PUBLIC_STUDENT_ID_PATTERN` *(optional)* — regex for valid student IDs on import. Default `^\d{2}-\d{4,6}$`
     (e.g. `21-00123`).
5. Install and run:
   ```bash
   npm install
   npm run dev
   ```
   Camera and GPS only work on `https://` or `localhost`. To test with real phones on your network, use a tunnel
   (e.g. `npx cloudflared tunnel --url http://localhost:3000`) or a Vercel preview deployment.
6. Create the first admin (there's no self-serve admin signup, by design):
   - Supabase → Authentication → Users → **Add user** with an email + password (tick “Auto confirm”).
   - In the SQL Editor:
     ```sql
     insert into profiles (id, role, full_name, email)
     values ('<the-user-id-from-auth>', 'admin', 'Your Name', 'you@school.edu.ph');
     ```
   - Log in at `/login` under **Officer / Admin**.

## First-time setup in the app (as admin)

1. **Semesters** → create the current semester and set it active.
2. **Officers** → add officer accounts (school email). Give each officer their temporary password privately; they
   must change it on first login.
3. **Students → Import masterlist** → upload the masterlist CSV (only once written permission to use it has been
   secured, §9). Download the credentials file at the end and distribute each student's temporary password
   privately. Students must change it on first login.
4. **Events** → create an event. Stand at the venue and use **Use my current location** to set its coordinates.
   Saved venues can be reused for later events.

## Deploying to Vercel

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com/new).
2. Add the same environment variables as `.env.local` (Project → Settings → Environment Variables).
3. Deploy. Vercel provides HTTPS, which phones need for the camera and GPS.
4. In Supabase → Authentication → URL Configuration, set the **Site URL** to your Vercel URL.

## Before each event (checklist)

- [ ] Walk to the venue with a phone and check that **mobile data or Wi-Fi works inside** (gyms often block signal).
- [ ] Log in as a test student at the venue and generate a QR code to confirm the **geofence radius** works
      indoors. If students are rejected, increase the radius (150–250 m is typical for covered courts).
- [ ] Officers: open the **scanner** once on each scanning phone and allow camera access.
- [ ] Remind students to **update their password beforehand**, turn on **Location**, and raise screen brightness.
- [ ] If sign-in runs late, use **Sign-in +15 min** on the event page. It takes effect immediately.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (time zones, CSV, validation, geofence) |

## How the design doc's requirements map to this code

| Doc section | Where it lives |
|---|---|
| §3 Roles | `profiles.role` + route protection in `src/proxy.ts`; `requireRole()` in `src/lib/session.ts` for API routes |
| §4.1 Event windows, multi-day, live extension | `event_days` table; `EditWindowControl` (+15 min buttons); `PATCH /api/events/[id]/days/[dayId]` |
| §4.2 Audit log | `audit_log` table, written via `src/lib/audit.ts` from every state-changing API route; `/admin/audit-log` |
| §4.3 QR sign-in/out, 60s single-use | `src/lib/tokens.ts` (signed JWT) + `qr_tokens` table (atomic claim); `src/components/Scanner.tsx` |
| §4.4 Attendance history for clearance | `src/components/AttendanceRecordView.tsx` (printable); `GET /api/semesters/[id]/export` |
| §5 GPS geofencing | `src/lib/geofence.ts`, enforced server-side in `POST /api/attendance/generate-token` |
| §6 On-demand, non-permanent QR | QR rendered client-side from a server-issued token per action, never stored as an image |
| §7 Auth | Students: student ID → synthetic email (`src/lib/constants.ts`). Officers/Admins: school email. Forced password change after any admin-issued password |
| §9 Masterlist import | `/admin/students/import` → `POST /api/students/bulk-import` (chunked) |
| §11 Manual override | Scanner **Manual entry** tab → `POST /api/attendance/manual` |
| §11 Reporting/export | Per-event CSV, per-semester clearance CSV, printable student record |

Times are always shown and entered in **Philippine time** (`src/lib/datetime.ts`), whatever the server's time zone.

## Still open (from the design doc)

- **Offline queueing** for venues with no signal isn't implemented. Do the signal test first (checklist above).
  Manual entry covers individual students whose phones can't connect.
- **Student ID format** is configurable via `NEXT_PUBLIC_STUDENT_ID_PATTERN` until it's finalized.
- **GPS spoofing** remains an accepted risk (§5). The officer's name check at scan time is the mitigation, so
  officers should actually look at the name shown.
