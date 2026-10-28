# 🎓 NAM: CMAT Attendance

<p align="center">
  <img src="public/brand/cmat-logo.png" alt="College of Management, Accountancy and Technology — Kabankalan Catholic College" width="160" />
</p>

<p align="center">
  <strong>QR + GPS attendance for CMAT events: no paper, no proxies, no encoding.</strong><br />
  A web attendance system for the CMAT Departmental Student Council of Kabankalan Catholic College. Students sign in
  with a short-lived QR code that only appears at the venue, officers scan it, and the council gets live counts,
  reports and clearance sheets.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.3-000000?logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.3-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Vercel-sin1-000000?logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white" alt="Leaflet" />
  <img src="https://img.shields.io/badge/Vitest-63_tests-6E9F18?logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white" alt="PWA" />
</p>

<p align="center">
  🌐 <b>Live:</b> <a href="https://cmat-attendance-system.vercel.app">cmat-attendance-system.vercel.app</a>
  &nbsp;·&nbsp; 🎬 <code>/demo.html</code> &nbsp;·&nbsp; 🎓 <code>/student</code> &nbsp;·&nbsp; 📷 <code>/officer</code> &nbsp;·&nbsp; 🛠️ <code>/admin</code>
</p>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [System Architecture](#️-system-architecture)
- [Key Features](#-key-features)
  - [QR Sign-in with GPS Geofencing](#-qr-sign-in-with-gps-geofencing)
  - [Phone-First Scanner](#-phone-first-scanner)
  - [Anti-Cheating Protections](#️-anti-cheating-protections)
  - [Events, Days & Sessions](#-events-days--sessions)
  - [Masterlist Import & Student Accounts](#-masterlist-import--student-accounts)
  - [New School Year & Graduates](#-new-school-year--graduates)
  - [Dashboard, Reports & Clearance](#-dashboard-reports--clearance)
  - [Admin & Staff Panel](#️-admin--staff-panel)
  - [Progressive Web App & Branding](#-progressive-web-app--branding)
- [Tech Stack](#️-tech-stack)
- [Database Schema](#️-database-schema)
- [Project Directory Structure](#-project-directory-structure)
- [API Catalog](#-api-catalog)
- [Installation & Getting Started](#-installation--getting-started)
- [Environment Configuration](#️-environment-configuration)
- [Deployment (Vercel & Supabase)](#-deployment-vercel--supabase)
- [Security & Privacy](#-security--privacy)
- [Documentation](#-documentation)

---

## 🌟 Overview

**NAM: CMAT Attendance** replaces paper sign-in sheets for the **College of Management, Accountancy and Technology (CMAT)**, Kabankalan Catholic College, Kabankalan City, Negros Occidental, an audience of 1,800+ students. Paper sheets meant long lines, friends signing for friends, and hours of encoding after every event. NAM fixes all three:

1. **Student App** (any phone browser, installable):
   Log in with your student ID, tap **Sign in**, and a QR code appears, but only if your phone's GPS says you're at the venue. The code lasts 60 seconds and works once.
2. **Officer Scanner** (phone camera, full screen):
   Point at the student's screen; in about a second a green card shows the student's name, ID, program and year so the officer can check it against the person and their school ID.
3. **Admin Panel**:
   Import the Excel masterlist as-is, create events with venues on a map, watch live counts, export per-event attendance and semester clearance sheets, and manage officers, semesters and school years.
4. **Next.js + Supabase Backend**:
   Server routes validate every request, Postgres row-level security keeps each role to its own data, and atomic database functions make each QR code single-use.

---

## 🏗️ System Architecture

```
cmat-attendance-system/
├── src/app/          # Next.js App Router: pages (student, officer, admin) and API routes
├── src/components/   # UI: scanner, event forms, charts, student directory, ...
├── src/lib/          # Rules: tokens, geofence, eligibility, reports, masterlist parser, ...
├── supabase/         # SQL migrations 0001–0010 (tables, RLS, database functions)
├── public/           # Logo, icons, animated demo page
└── .github/          # Weekly encrypted database backup (GitHub Actions)
```

```
┌──────────────────────────────────┐        ┌───────────────────────────────────┐
│   Student (phone browser / PWA)  │        │   Officer & Admin (phone/laptop)  │
│  • Events meant for my program   │        │  • Full-screen QR scanner         │
│  • GPS check → 60-second QR      │        │  • Events, venues, sessions       │
│  • My attendance for clearance   │        │  • Students, masterlist import    │
└────────────────┬─────────────────┘        │  • Dashboard, reports, audit log  │
                 │                          └─────────────────┬─────────────────┘
                 │              HTTPS / JSON                  │
                 └────────────────────┬───────────────────────┘
                                      │
                    ┌─────────────────▼────────────────┐
                    │   Next.js 16 on Vercel (sin1)    │
                    │  • proxy.ts: session + role home │
                    │  • API routes: zod validation,   │
                    │    role checks, audit logging    │
                    │  • HS256-signed QR tokens        │
                    │  • Daily keep-alive cron         │
                    └─────────────────┬────────────────┘
                                      │  service role (server only)
                    ┌─────────────────▼────────────────┐      ┌─────────────────────┐
                    │  Supabase (Singapore)            │      │  GitHub Actions     │
                    │  • Auth (email + password)       │<─────│  Weekly pg dump,    │
                    │  • PostgreSQL: 13 tables + RLS   │      │  AES-256 encrypted  │
                    │  • record_scan, create_event,    │      └─────────────────────┘
                    │    apply_school_year functions   │
                    └──────────────────────────────────┘
```

**How a sign-in works:** the student's phone sends its GPS position → the server checks the distance to the session's venue and the time window → it stores a one-time token row and returns a signed QR (60 s) → the officer scans → `record_scan` claims the token and saves the attendance in **one** database transaction → the student's screen turns ✓.

---

## 🚀 Key Features

### 📍 QR Sign-in with GPS Geofencing
- **QR Only at the Venue** — The QR is created only when the phone is inside the venue radius (e.g. 150 m), with the phone's GPS accuracy taken into account (up to 50 m).
- **Short-Lived & Single-Use** — Each QR expires in 60 seconds and is claimed atomically the moment it's scanned, so a screenshot can't be reused.
- **Clear Feedback** — Outside the radius the app says how far away you are; inside, a big countdown and "turn your brightness up".
- **Live Confirmation** — The student's screen switches to ✓ "You're signed in!" as soon as the officer's scan lands.

### 📷 Phone-First Scanner
- **Full Screen, Scan Anywhere** — The whole camera view reads QR codes; uses the browser's BarcodeDetector when available.
- **Big Result Card** — Green ✓ with name, ID, program and year; red ✕ with the reason (expired, already used, different event).
- **Manual Entry** — For dead phones or no signal: search the student, a reason is required, and it's audit-logged.
- **Tools** — Flashlight, camera flip, recent scans on this phone, live sign-in/sign-out counts, screen kept awake.
- **Fast** — One database round trip per scan (`record_scan`), so lines keep moving.

### 🛡️ Anti-Cheating Protections
- **Phone Limit** — Each student account works on at most **2 phones**, and each phone for only **one** student, which stops "buddy sign-in" on a friend's phone. Officers can **Reset phones** for a new phone.
- **Officer Check** — Every scan shows the real account owner's name for comparison with the person and their school ID.
- **Accountability** — Manual entries need a reason; wrong records are **voided, never deleted**; everything is in the audit log.
- **Time Windows** — Sign-in and sign-out only work inside each session's windows; officers can extend by 15 minutes live.

### 📅 Events, Days & Sessions
- **Targeted Events** — Open to all of CMAT, or only chosen programs and year levels.
- **Venue on a Map** — Pick a saved venue or drop a pin (OpenStreetMap + satellite), with a sign-in radius slider and a plain-language distance ("about 1½ football fields").
- **Multi-Day Events** — Each day can have its **own title and venue** (own GPS location and radius).
- **Morning & Afternoon Sessions** — "Whole day" creates two sessions, each with its own sign-in, sign-out, scanner and clearance column; add more sessions as needed.
- **Sign-in Only** — Sessions without sign-out count signing in as present; **Cancel sign-out** handles late announcements and is reversible.
- **Easy Times** — Quick-fill buttons, close time set one hour after opening, a plain-language summary, and a warning if the times already passed.

### 👥 Masterlist Import & Student Accounts
- **Upload the Excel File As-Is** — `.xls`, `.xlsx` or `.csv`; title rows and Male/Female rows are skipped; **every sheet** is read ("BSBA FM 1" … "BSBA MM 4").
- **Course Split** — "BSTM 1" becomes program BSTM, year 1; all-caps names are title-cased.
- **Auto Student IDs** — No ID column? Each student gets one (`NAM26-0001`, …).
- **Safe Re-imports** — Matched by ID, or by name + program, so nobody is duplicated.
- **Credential Slips** — Printable slips with temporary passwords, grouped by program and year; officers can reset a password on the spot.
- **Course Filters** — Students page with live search and buttons per course and year, built from the data, plus a 🎓 Graduated view.

### 🎓 New School Year & Graduates
- **One Button, Once a Year** — Everyone moves up a year; students past their program's last year (4 by default, 5 where set) graduate.
- **Preview & Undo** — See the counts per program before confirming; undo within 24 hours.
- **History Stays True** — Each semester's class list is frozen, so old reports and clearance sheets never change.
- **Graduates Keep Read-Only Access** — They can view and print their history but no longer sign in to events.

### 📊 Dashboard, Reports & Clearance
- **Admin Dashboard** — Signed in vs signed out vs completed per event day, average attendance gauge, semester trend, event calendar, breakdown by program and year, QR vs manual, and a "students to watch" list.
- **Per Event** — Live counts per session, who's still missing, by program and year, CSV export, missing-list CSV.
- **Clearance Sheet** — One CSV per semester: every student × every session, Present / Absent / N/A, with totals.
- **Student Record** — Each student sees their own attendance per semester, printable for clearance signing.

### 🛠️ Admin & Staff Panel
- **Roles** — Admin (everything), officer (events, scanning, students), student (own data only).
- **Staff Management** — Add officers or admins, change roles, deactivate, or **Remove** old officers (kept under "Former officers" if their name is on past records).
- **Semesters** — Active semester, clearance export, program lengths, new school year.
- **Audit Log** — Who did what and when: events, scans, manual entries, voids, imports, role changes, resets.

### 📱 Progressive Web App & Branding
- **Installable** — "Add NAM to your home screen" prompt (Android install button, iPhone instructions); opens full screen like an app.
- **One Login Box** — "Student ID or email": the system knows who is a student and who is staff.
- **CMAT Branding** — Navy and gold, animated logo intro on the login page, bottom navigation on phones.
- **Animated Demo** — `/demo.html` plays an event day on a student's and an officer's phone, for presentations (no login).

---

## 🛠️ Tech Stack

*Exact versions installed in the project (October 2026).*

### Application
| Package | Version | Purpose |
|---------|---------|---------|
| **Next.js** | 16.3.1 | App Router pages, API routes, `proxy.ts` session handling |
| **React / React DOM** | 19.2.8 | User interface |
| **TypeScript** | 5.9.3 | Typed code everywhere |
| **Tailwind CSS** | 4.3.3 | Styling with CMAT brand tokens, phone-first layouts |
| **@supabase/supabase-js** | 2.112.3 | Database and auth client |
| **@supabase/ssr** | 0.12.4 | Cookie-based sessions on the server |
| **zod** | 4.4.3 | Validating every API request |
| **jose** | 6.2.9 | Signing and verifying QR tokens (HS256, 60 s) |
| **html5-qrcode** | 2.3.8 | Camera QR scanning in the browser |
| **qrcode** | 1.5.4 | Drawing the student's QR code |
| **Leaflet** | 1.9.4 | Venue map with radius circle (OpenStreetMap + Esri satellite tiles) |
| **SheetJS (xlsx)** | 0.20.3 | Reading Excel masterlists in the browser |

### Development & Testing
| Tool | Version | Purpose |
|------|---------|---------|
| **Vitest** | 3.2.7 | 63 unit tests (masterlist parser, analytics, school year, phone limit, sessions, …) |
| **ESLint** | 9.39.5 | Linting with `eslint-config-next` |
| **sharp** | 0.35.3 | Icons and QR posters |
| **Node.js** | 20+ | Runtime |

### Services
| Service | Used for |
|---------|----------|
| **Vercel** | Hosting (Singapore, `sin1`), HTTPS, auto-deploy on push, daily keep-alive cron |
| **Supabase** | PostgreSQL, Auth, row-level security (Singapore) |
| **GitHub** | Source code; Actions run the weekly encrypted database backup |
| **OpenStreetMap / Esri** | Map and satellite tiles for venues |

---

## 🗄️ Database Schema

NAM runs on **Supabase PostgreSQL** with row-level security on every table. Times are stored in UTC and shown in Philippine time.

| Group | Tables |
|-------|--------|
| **People** | `profiles` (role, student ID, program, year, active, graduated), `student_devices` (phone limit), `temp_passwords` (until changed) |
| **Events** | `events` (targets, venue, semester), `event_days` (date, session, title, venue, windows, sign-out required), `venues` |
| **Attendance** | `qr_tokens` (one-time, 60 s), `attendance_records` (sign-in / sign-out, QR or manual, voidable) |
| **School year** | `semesters`, `semester_roster` (frozen class lists), `program_settings` (years per program), `year_promotions` (undo) |
| **Accountability** | `audit_log` |

Database functions: `create_event`, `record_scan`, `apply_school_year`, `undo_school_year`, `set_active_semester`, `current_user_role`.

> **Setting up a new database?** Run the files in [`supabase/migrations/`](supabase/migrations/) in order, `0001` → `0010`, in the Supabase SQL editor.

---

## 📁 Project Directory Structure

```
cmat-attendance-system/
├── src/
│   ├── proxy.ts                    # Session refresh, login redirect, role home
│   ├── app/
│   │   ├── login/                  # One login box + animated logo intro
│   │   ├── student/                # Events for me, sign in/out, my attendance
│   │   ├── officer/                # Events, new event, event page, scanner, students
│   │   ├── admin/                  # Dashboard, students, import, staff, semesters, audit log
│   │   ├── account/                # Change password
│   │   └── api/                    # 42 endpoints (see API Catalog)
│   ├── components/
│   │   ├── Scanner.tsx             # Full-screen scanner, manual entry
│   │   ├── AttendanceAction.tsx    # GPS check → QR with countdown
│   │   ├── DayCard.tsx             # Day with sessions, title, venue
│   │   ├── VenuePicker.tsx         # Saved venue or new pin + radius
│   │   ├── StudentDirectory.tsx    # Search + course/year/graduated filters
│   │   ├── SchoolYearCard.tsx      # New school year: preview, confirm, undo
│   │   └── charts/                 # Dashboard charts (SVG)
│   └── lib/
│       ├── tokens.ts               # QR token signing
│       ├── geofence.ts             # Distance and radius checks
│       ├── devices.ts              # 2 phones per student, 1 student per phone
│       ├── masterlist.ts           # Excel/CSV masterlist parser
│       ├── reports.ts              # Attendance, analytics, frozen class lists
│       ├── school-year.ts          # Promotion plan
│       └── __tests__/              # Vitest unit tests
├── supabase/migrations/            # 0001_init.sql … 0010_student_devices.sql
├── public/                         # Logo, icons, demo.html
├── .github/workflows/backup.yml    # Weekly encrypted backup
└── vercel.json                     # Region + keep-alive cron
```

---

## 🔌 API Catalog

All **42 endpoints** are under `/api`. Highlights:

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/api/attendance/generate-token` | Student | GPS + time-window + phone check → 60-second QR |
| `POST` | `/api/attendance/scan` | Officer, Admin | Verify and claim a QR, record attendance (one transaction) |
| `POST` | `/api/attendance/manual` | Officer, Admin | Manual sign-in/out with a required reason |
| `POST` | `/api/attendance/{id}/void` | Admin | Void a wrong record (kept, never deleted) |
| `POST` | `/api/events` | Officer, Admin | Create an event with targets, venue, days and sessions |
| `PATCH` | `/api/events/{id}/days/{dayId}` | Officer, Admin | Edit or extend a session's time windows |
| `PATCH` | `/api/events/{id}/days/{dayId}/sign-out` | Officer, Admin | Cancel / restore sign-out for a session |
| `GET` | `/api/events/{id}/export` | Officer, Admin | Event attendance CSV |
| `GET` | `/api/semesters/{id}/export` | Admin | Semester clearance CSV |
| `POST` | `/api/students/bulk-import` | Admin | Create accounts from the masterlist (auto IDs, safe re-import) |
| `GET/POST` | `/api/school-year` | Admin | Preview / start a new school year |
| `POST` | `/api/school-year/{id}/undo` | Admin | Undo a promotion (24 h) |
| `DELETE` | `/api/users/{id}/devices` | Officer, Admin | Reset a student's phones |
| `POST` | `/api/auth/device` | Signed in | Register this phone after login |
| `GET` | `/api/cron/keep-alive` | Cron secret | Daily ping so the free database doesn't pause |

---

## 📦 Installation & Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- A free [Supabase](https://supabase.com/) project

### 1. Clone the Repository

```bash
git clone https://github.com/KaisuS12/cmat-attendance-system.git
cd cmat-attendance-system
npm install
```

### 2. Set Up the Database

In the Supabase dashboard → **SQL Editor**, run each file in `supabase/migrations/` in order (`0001` → `0010`). Then in **Authentication → Providers → Email**, turn off public sign-ups (accounts are created by admins).

### 3. Configure and Run

```bash
cp .env.example .env.local      # fill in the values below
npm run dev                     # http://localhost:3000
```

### 4. Create the First Admin

In Supabase → **Authentication → Users**, add a user with your email and password, then in the SQL Editor:

```sql
insert into profiles (id, role, full_name, email)
select id, 'admin', 'Your Name', email from auth.users where email = 'you@example.com';
```

### Useful Scripts

```bash
npm test             # Vitest unit tests
npm run lint         # ESLint
npm run typecheck    # Route types + TypeScript
npm run build        # Production build
```

---

## ⚙️ Environment Configuration

### **`.env.local`**
```env
# Supabase → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key     # server only, never exposed

# Signs QR tokens (openssl rand -base64 32)
QR_TOKEN_SECRET=change-me-to-a-long-random-string

# Daily keep-alive cron (openssl rand -base64 32)
CRON_SECRET=change-me-to-another-long-random-string

# Optional: student ID format for imports (default ^\d{2}-\d{4,6}$)
# NEXT_PUBLIC_STUDENT_ID_PATTERN=^\d{2}-\d{4,6}$
```

---

## 🚀 Deployment (Vercel & Supabase)

| Setting | Value |
|---------|-------|
| Hosting | Vercel, region `sin1` (Singapore, next to the Supabase database) |
| Updates | every `git push` to `main` deploys automatically |
| Environment | the same variables as `.env.local`, in Vercel → Settings → Environment Variables |
| Cron | `/api/cron/keep-alive` daily (keeps the free Supabase project awake) |
| Database changes | run new `supabase/migrations/` files in the SQL editor **before** pushing code that uses them |

### Weekly Backup

`.github/workflows/backup.yml` dumps the whole database every Sunday 2:00 AM (Manila) and **encrypts it with AES-256** before storing it as a GitHub Actions artifact (kept 90 days). Add two repository secrets:

| Secret | Value |
|--------|-------|
| `SUPABASE_DB_URL` | Supabase → **Connect** → Session pooler connection string |
| `BACKUP_PASSPHRASE` | A long passphrase. Keep a copy: backups can't be opened without it. |

Open a backup with `gpg -d cmat-backup-YYYY-MM-DD.tar.gz.gpg | tar -xz`.

> After a deploy, press **Ctrl+Shift+R** once if an installed app still shows the old version.

---

## 🔒 Security & Privacy

- **Row-Level Security** — Students can read only their own records; all writes go through server routes that check the role.
- **Service Key Stays on the Server** — The browser only ever has the public anon key.
- **Signed, One-Time QR Codes** — HS256 tokens that carry only a random ID; who, which session and which type are read from the server's own row; 60-second expiry; atomic claim.
- **Geofence + Phone Limit** — QR only inside the venue radius; 2 phones per student account, 1 student per phone (stored only as hashes).
- **Rate Limits** — At most 6 QR codes per student per minute.
- **Passwords** — Hashed by Supabase Auth; temporary passwords are visible to officers only until the student changes them.
- **Accountability** — Audit log of events, scans, manual entries, voids, imports, role changes and resets; records are voided, never deleted.
- **Data Privacy Act** — The masterlist is imported only after written permission, and only name, student ID, program and year are stored.
- **Secrets** — Only in environment variables; `.env.local` is git-ignored; backups are encrypted because this repository is public.

**Known limitation:** GPS can be faked on a phone with developer tools. The officer's name check against the school ID at the door is the backup ([Officer Scanning Rules](#-documentation)).

---

## 📚 Documentation

| Document | Contents |
|----------|----------|
| [CMAT_QR_Attendance_System_Documentation.md](CMAT_QR_Attendance_System_Documentation.md) | Presentation guide: how it works, anti-cheating, demo script, Q&A |
| [supabase/migrations/](supabase/migrations/) | Every database change, with comments explaining why |
| [/demo.html](https://cmat-attendance-system.vercel.app/demo.html) | Animated event-day walkthrough (no login) |

---

© 2026 **CMAT Departmental Student Council** · Kabankalan Catholic College — built so every CMAT student's attendance is counted fairly, without the lines.
