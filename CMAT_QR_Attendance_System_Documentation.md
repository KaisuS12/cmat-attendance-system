# NAM: CMAT Attendance
## QR + GPS Attendance System for the CMAT Departmental Student Council

**Status:** Built and live at **cmat-attendance-system.vercel.app**. 1,837 students are already in the system, ready for the first real event.
**Prepared for:** CMAT (College of Management, Accountancy, and Technology) Departmental Student Council, Kabankalan Catholic College
**Last updated:** November 2026

---

## What's new since the October version

If you're updating slides from the October version, these are the changes.

**Students and accounts**
- All **1,837 CMAT students** are in the system: BSIT 788, BSBA FM 443, BSBA MM 342, BSA 113, BSTM 103, BSMA 48.
- The masterlist import reads **every tab** of an Excel file (one tab per class), as is.
- Students are grouped by **program and year** only. Sections were removed.
- **New school year** button: moves every student up a year once a year; graduates keep a read-only account.
- **One login box** ("Student ID or email"), so nobody picks the wrong tab.
- **Phone limit:** each student account works on at most 2 phones, and each phone for only 1 student.

**Events**
- **Morning and afternoon sessions** in one day, each with its own sign-in and sign-out.
- **Sign-in-only sessions**, plus **Cancel sign-out** for late announcements.
- Each day can have its **own title and venue** (its own GPS location and radius).
- Times are easier to set: the close time fills in one hour after the open time, and the form warns when the times have already passed.

**Officers and admins**
- **Manual entries need a live photo of the student's ID** before they can be saved.
- **Officer activity log:** admins can see every scan and manual entry each officer made.
- The **Officers** page (renamed from "Staff") can remove old officers.
- **Course and year filter buttons** on the Students page, plus a **Graduated** list.

**Look and speed**
- **Light and dark mode**, with a smooth circle animation when switching.
- **Install as an app** on phones (home-screen icon, no app store).
- **Faster scanning:** each scan saves in one step.
- **Weekly encrypted backup** of the database.
- A public **animated demo** at `/demo.html`, and a **QR poster** for the site.

---

## 1. The problem

Attendance at CMAT events is still taken on paper sign-in sheets. With 1,800+ students, that means:

- long lines at the entrance and the exit;
- friends signing for friends who never came;
- hours of encoding names into Excel after every event;
- a slow, error-prone check of who is cleared at the end of the semester.

## 2. What the system does

Students sign in and out with a **QR code on their own phone**. The QR **only appears when the phone is physically at the venue** (GPS check). An officer scans it, and attendance is recorded instantly.

Everything is saved automatically. Officers and admins see live counts and who is missing, and can export clearance sheets in one click.

It runs as a website, so there's **no app to download**. It works on any phone or laptop browser, and it can be **added to the home screen** to open like an app.

---

## 3. Who uses it

| Role | What they do |
|---|---|
| **Student** | Logs in with their student ID. Sees the events meant for them, taps **Sign in** / **Sign out** to show a QR, and views their own attendance record for clearance. |
| **Officer** | Creates events, opens the **scanner** on their phone at the door, records manual entries (with an ID photo), resets student passwords and phones, and downloads attendance. |
| **Admin** | Everything an officer can do, plus: imports the masterlist, manages officers, semesters and the new school year, views the dashboard, each officer's activity log and the audit log, and checks ID photos. |

Everyone logs in on the **same page** with one box: students type their student ID, officers and admins type their email. The system opens the right screen for each person.

---

## 4. How an event works (step by step)

1. **Before the event:** an officer creates the event.
   - **Who it's for:** all of CMAT, or chosen programs and year levels (e.g. only BSTM 1).
   - **Venue:** pick it on a map and set the allowed radius, e.g. 150 m. The map shows the circle.
   - **Days:** one or more. Each day can have its **own title** (e.g. "Field Day") and its **own venue**.
   - **Sessions in a day:**
     - **Whole day (morning + afternoon):** two sessions, each with its own sign-in and sign-out.
     - **Morning only**, **Afternoon only**, or **One session, all day**.
     - **Sign-in only:** no sign-out needed, so signing in counts as present.
   - Setting when a window opens fills in the close time one hour later; every time stays editable.
2. **Arrival:** the student opens the site and taps **Sign in**.
   - The phone checks its location. Outside the radius, it says how far away the student is and refuses to make a QR.
   - Inside the radius, a QR appears with a 60-second countdown.
3. **Scan:** the officer's phone scanner reads the QR.
   - A big ✓ shows the **student's name, ID, program and year**. The officer checks it against the student's school ID.
   - The student's phone also shows ✓ "You're signed in!".
4. **Leaving:** the same steps during the sign-out window. If there's a last-minute "no sign-out today", an officer presses **Cancel sign-out**: everyone who signed in counts as present right away.
5. **After the event:** officers see, per session, who signed in, who signed out, who completed, and who is missing, with a breakdown by program and year. They can download a CSV.
6. **End of semester:** the admin downloads one **clearance CSV** showing, per student, every session: Present / Absent / N/A (not meant for them).

**No phone, dead battery, no signal?** The officer finds the student and records a **manual entry**, with a reason and a **live photo of the student's ID**. Without the photo it can't be saved.

---

## 5. How it stops cheating

| Trick | Why it doesn't work |
|---|---|
| Sending a QR screenshot to a friend at the venue | The QR expires after **60 seconds** and works **only once**. The officer sees the real owner's name on every scan and checks the school ID. |
| Generating a QR from home or the canteen | The QR is only created when the phone's **GPS is inside the venue radius** for that day. |
| A friend logging in to your account on their own phone | Each student account works on **at most 2 phones**, and each phone for **only 1 student**. The friend's phone is already tied to the friend's account. |
| A biased officer signing in absent friends | Every manual entry needs a reason **and a live photo of the student's ID**, taken with the camera (no gallery). Admins can view each photo and see every officer's scans and manual entries in their **activity log**. |
| Fixing records quietly | Wrong records are **voided, never deleted**, and every change is in the **audit log** with who did it and when. |
| Signing in outside the allowed time | Sign-in and sign-out only work inside each session's time windows. Officers can extend by 15 minutes live. |

**Honest limitations:**
- GPS can be faked on a phone with developer tools; the officer's check against the school ID at the door is the backup.
- An ID photo shows the ID, not who was holding it, so a borrowed ID could still pass. Admins should spot-check officers with many manual entries.

**Officer rule at the door:** "QR and school ID, please." Every student, every time, friends included.

---

## 6. Accounts and the masterlist

- **Student login:** student ID plus a temporary password, printed on a **credential slip** (grouped by program and year). Students can then set their own password.
- **Importing:** the admin uploads the department's Excel masterlist **as is** (.xls / .xlsx / .csv).
  - Every tab is read, e.g. "BSBA FM 1" to "BSBA MM 4" in one file.
  - Title rows and "Male"/"Female" rows are skipped automatically.
  - "BSTM 1" is read as program BSTM, year 1.
  - Students without an ID get one automatically (e.g. **NAM26-0001**), printed on their slip.
  - Re-uploading a list never creates duplicates.
- **Forgotten password or new phone:** an officer can **reset the password** (and print a new slip) or **reset phones** on the spot.
- **Officers and admins:** email and password. Admins add officers or admins, change roles, deactivate them, or **remove** old officers. Officers who handled events are kept as "Former officers", so their name stays on past records.

---

## 7. New school year and graduates

- Once a year, at the start of the new school year, an admin presses **Start new school year**.
  - Everyone moves up a year (1st → 2nd → 3rd → 4th).
  - Students in their program's last year (4 by default, 5 where set) become **Graduated**.
  - A **preview** shows the counts before confirming, and **Undo** works for 24 hours.
- **Graduates** can still log in to view and print their history, but no longer sign in to events.
- **Old reports never change:** each semester's class list is saved, so last year's clearance still shows what was true then.
- Then the admin imports the incoming 1st-year masterlist.

---

## 8. Dashboard, reports and activity

- **Admin dashboard:**
  - per event day: signed in, signed out, completed;
  - average attendance;
  - trend over the semester;
  - event calendar;
  - breakdown by program and year;
  - QR vs manual entries;
  - a **"students to watch"** list of those below 50% attendance.
- **Students page:** live search, a button per course and year, and a Graduated list.
- **Per event:** live counts per session, missing students, by program and year, and CSV exports.
- **Clearance:** one CSV per semester.
- **Officer activity log** (admins only): every sign-in scan, sign-out scan and manual entry by each officer, with filters by action and event, a student search, and **View ID photo** on manual entries.
- **Audit log:** who did what and when (events, manual entries, voids, imports, role changes, resets, school year, ID photo views).

---

## 9. Privacy and security

- **Masterlist:** personal data under the **Data Privacy Act**. It is only imported with written permission from the department, and only name, student ID, program and year are stored.
- **Who sees what:** students see only their own records, enforced by the database itself, not just hidden in the app.
- **Passwords:** never stored in readable form. A temporary password is visible to officers **only until the student changes it**.
- **ID photos:** stored privately and viewable only by admins, through a link that expires after 60 seconds. Each view is logged, and photos are **deleted automatically after 90 days**.
- **Phones:** recognised by a random marker, stored only in coded (hashed) form.
- **Backups:** encrypted weekly backups of the database.
- **Connection:** all traffic is encrypted (HTTPS).

---

## 10. Technology and cost

| Part | Used |
|---|---|
| Website | Next.js (React), hosted on **Vercel**, Singapore region |
| Database, logins, photo storage | **Supabase** (PostgreSQL), Singapore region |
| Maps | OpenStreetMap and satellite view |
| Backups | GitHub Actions, weekly, encrypted |
| **Cost** | **₱0** on the free plans, enough for the council's current size. Paid plans exist if usage grows. |

**At the venue:** students and officers need mobile data or Wi-Fi. Test the gym's signal before the first big event.

**Capacity tip:** about **one scanning officer per 100 students** keeps lines short. Students should log in *before* arriving.

---

## 11. Suggested live demo (about 5–7 minutes)

Start with the animated demo at **`/demo.html`** (about 1 minute), then do it live on two phones:

1. **Admin:** show the dashboard and the Students page with course buttons. Import a masterlist file to show every tab being read.
2. **Officer:** create an event: the map and radius, **Whole day (morning + afternoon)**, and a day with its own title.
3. **Student (second phone):** log in with the student ID, tap **Sign in**, and show the QR with its countdown.
4. **Officer:** scan it. The ✓ shows the student's name; check it against the school ID. The student's phone shows ✓.
5. **Cheating demo:** scan the same QR again; it's rejected. Then log in to that student on a third phone; it's refused (phone limit).
6. **Manual entry:** record one with a reason and a live ID photo. As admin, open the officer's **activity log** → **View ID photo**.
7. **Cancel sign-out** on a session, then download the clearance CSV.
8. **Switch to dark mode** to show the circle animation.

---

## 12. Questions the audience may ask

**"What if a student has no phone or it's dead?"**
The officer does a manual entry with a reason and a photo of the student's ID. It's logged with the officer's name.

**"What if an officer signs in their friends?"**
Every manual entry needs a live ID photo, and admins can see each officer's full activity and the photos. Unusual numbers of manual entries stand out.

**"Can a friend use my account to sign me in?"**
Not on their own phone: each phone works for one student only, and each account for at most two phones.

**"What if there's no signal in the gym?"**
The QR and the scan both need internet. Test the venue's signal ahead of time and ask students to log in before arriving.

**"Can someone screenshot the QR?"**
They can, but it expires in 60 seconds, works once, and the officer checks the name against the school ID.

**"What if the event has a morning and an afternoon part?"**
Use **Whole day**: each part has its own sign-in and sign-out and counts separately for clearance.

**"What if we suddenly don't need a sign-out?"**
An officer presses **Cancel sign-out**; everyone who signed in counts as present right away.

**"What happens when students move up a year or graduate?"**
One button at the start of the school year moves everyone up; graduates keep read-only access, and old reports don't change.

**"Who can change attendance?"**
Only officers and admins. Every change is logged and records are voided, not deleted.

**"How much does it cost?"**
Nothing on the current free plans.

---

## 13. Next steps

1. Pilot it at one real event; test the gym's signal beforehand.
2. Hand out credential slips per program and year, and share the site's QR poster.
3. Train officers on the scanner, the ID check and manual entry with an ID photo (about 10 minutes, using the Officer Scanning Rules).
4. Tell students that ID photos are taken for manual entries (Data Privacy Act).
5. Possible upgrades:
   - a QR that changes every ~20 seconds, so screenshots stop working faster;
   - excuse requests (approved absences count as "Excused");
   - late marking;
   - opening the system to **other departments**, each with its own council and records (being discussed).
