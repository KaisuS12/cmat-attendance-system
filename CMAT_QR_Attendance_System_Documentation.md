# NAM: CMAT Attendance
## QR + GPS Attendance System for the CMAT Departmental Student Council

**Status:** Built and running. Student accounts have been created from the masterlist, ready to test at a real event.
**Prepared for:** CMAT (College of Management, Accountancy, and Technology) Departmental Student Council
**Last updated:** October 2026

---

## 1. The problem

Attendance at CMAT events is still taken on paper sign-in sheets. With 1,000+ students, that means:

- long lines at the entrance and the exit;
- friends signing for friends who never came;
- hours of encoding names into Excel after every event;
- a slow, error-prone check of who is cleared at the end of the semester.

## 2. What the system does

Students sign in and out with a **QR code on their own phone**. The QR **only appears when the phone is physically at the venue** (GPS check). An officer scans it, and attendance is recorded instantly.

Everything is saved automatically. Officers and admins can see live counts, who is missing, and export clearance sheets in one click.

It runs as a website, so there's **no app to install**. It works on any phone or laptop browser.

---

## 3. Who uses it

| Role | What they do |
|---|---|
| **Student** | Logs in with their student ID. Sees the events meant for them, taps **Sign in** / **Sign out** to show a QR, and views their own attendance history for clearance. |
| **Officer** | Creates events, opens the **scanner** on their phone at the entrance, records manual entries when needed, resets student passwords, and downloads attendance. |
| **Admin** | Everything an officer can do, plus: imports the masterlist, adds officers/admins, manages semesters, views the dashboard and analytics, and reads the audit log. |

---

## 4. How an event works (step by step)

1. **Before the event:** an officer creates the event.
   - Title and venue: pick the venue on a map and set the allowed radius, e.g. 150 m. The map shows the circle.
   - Which programs and year levels it's for: all of CMAT, or e.g. only BSTM 1.
   - One or more days, each with its own **sign-in** and **sign-out** time window. Quick-fill buttons cover whole day, morning or afternoon.
2. **Arrival:** the student opens the site and taps **Sign in**.
   - The phone checks its location. Outside the radius, it says how far away the student is and refuses to make a QR.
   - Inside the radius, a QR appears with a 60-second countdown.
3. **Scan:** the officer's phone scanner reads the QR.
   - The screen flashes ✓ with the **student's name, ID, program and year**, so the officer can glance at the person in front of them.
   - The student's phone also shows ✓ "You're signed in!".
4. **Leaving:** the same steps during the sign-out window.
5. **After the event:** officers see who completed (signed in **and** out), who is missing, and a breakdown per program and year. They can download a CSV of the event.
6. **End of semester:** the admin downloads one **clearance CSV** showing, per student, every event: Present / Absent / N/A (not meant for them).

**No phone, dead battery, no signal?** The officer searches the student's name and records a **manual entry**. A reason is required, and it is logged.

---

## 5. How it stops cheating

| Trick | Why it doesn't work |
|---|---|
| Sending a QR screenshot to a friend at the venue | The QR expires after **60 seconds** and works **only once**. The officer also sees the real owner's name on every scan. |
| Generating a QR from home or the canteen | The QR is only created when the phone's **GPS is inside the venue radius**. |
| Signing in for a friend with their account | The officer sees the name on screen at the scan. |
| An officer adding fake attendance | Every manual entry needs a reason and is recorded in the **audit log** with the officer's name and time. Wrong records can be **voided** (never silently deleted), and the void is logged too. |
| Signing in outside the allowed time | Sign-in and sign-out only work inside the time windows set for that day. Officers can extend a window live if needed. |

**Honest limitation:** GPS can be faked on a phone with developer tools. The officer seeing the student's name at the scan is the backup check for that.

---

## 6. Accounts and the masterlist

- **Student login:** student ID plus a temporary password, shown on a printable **credential slip** grouped per program and year. Students then set their own password.
- **Importing:** the admin uploads the department's Excel masterlist **as is** (.xls / .xlsx / .csv).
  - Title rows and "Male"/"Female" rows are skipped automatically.
  - "BSTM 1" is read as program BSTM, year 1.
  - If the list has no student ID column, the system assigns one (e.g. **NAM26-0001**), printed on the slip.
  - Re-uploading the same list never creates duplicates.
- **Forgotten passwords:** officers can reset a student's password on the spot and print a new slip.
- **Officer/Admin login:** email and password. Admins can add new officers or admins and promote or demote them.

---

## 7. Dashboard and reports

- **Admin dashboard:**
  - attendance per event day: signed in, signed out, completed;
  - average attendance rate;
  - trend over the semester;
  - event calendar;
  - breakdown by program and year level;
  - QR vs manual entries;
  - a **"students to watch"** list of those below 50% attendance.
- **Per event:** live counts, missing students, a by-program-and-year summary, and CSV export.
- **Clearance:** one CSV for the whole semester.
- **Audit log:** who did what and when (events created/edited, manual entries, voids, imports, role changes, password resets).

---

## 8. Privacy and security

- The masterlist is personal data under the **Data Privacy Act**. It is only imported after written permission from the department, and only the fields needed are stored: name, student ID, program, year.
- Each role only sees what it needs. Students can only see their own records; this is enforced in the database itself, not just hidden in the app.
- Passwords are never stored in readable form. A temporary password is visible to officers **only until the student changes it**.
- All traffic is encrypted (HTTPS).

---

## 9. Technology and cost

| Part | Used |
|---|---|
| Website | Next.js (React), hosted on **Vercel**, Singapore region |
| Database and logins | **Supabase** (PostgreSQL), Singapore region |
| Maps | OpenStreetMap |
| **Cost** | **₱0** on the free plans, enough for the council's current size. Paid plans are available if usage grows. |

**At the venue:** students and officers need mobile data or Wi-Fi. Signal inside the gym should be tested before the first big event.

**Capacity tip:** about **one scanning officer per 100 students** keeps lines short. Students should log in *before* arriving.

---

## 10. Suggested live demo (about 5 minutes)

1. **Admin:** show the dashboard, then **Import masterlist** with the Excel file and the auto-generated IDs, then print a credential slip.
2. **Officer:** create an event: pick the venue on the map, set the radius, use the "Whole day" quick fill.
3. **Student (second phone):** log in, tap **Sign in**, and show the QR with its countdown.
4. **Officer:** open the scanner and scan. The ✓ shows the student's name, and the student's phone shows ✓ too.
5. **Cheating demo:** scan the same QR again. It is rejected as already used.
6. **Officer:** show the event page (counts, missing list), then a manual entry with a reason, then that entry in the audit log.
7. **Admin:** download the clearance CSV.

---

## 11. Questions the audience may ask

**"What if a student has no phone or it's dead?"**
The officer does a manual entry with a reason. It's logged.

**"What if there's no signal in the gym?"**
The QR and the scan both need internet. We recommend testing the venue's signal ahead of time and asking students to log in before arriving.

**"Can someone screenshot the QR?"**
They can, but it expires in 60 seconds, works once, and the officer sees the owner's name.

**"What if GPS is wrong indoors?"**
The radius is set generously and the phone's GPS accuracy is taken into account. Students who are still rejected can be entered manually.

**"Who can change attendance?"**
Only officers and admins. Every change is logged and records are voided, not deleted.

**"How much does it cost?"**
Nothing on the current free plans.

---

## 12. Next steps

1. Pilot it at one real event, and test the gym's signal beforehand.
2. Hand out credential slips to students per program and year.
3. Train officers on the scanner and manual entry (about 10 minutes).
4. Possible upgrades:
   - a QR that changes every ~20 seconds, so screenshots stop working faster;
   - weekly automatic database backups.
