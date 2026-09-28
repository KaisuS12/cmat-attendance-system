# CMAT Council QR Attendance System
## Project Documentation

**Status:** Design phase
**Prepared for:** CMAT (College of Management, Accountancy, and Technology) Departmental Student Council

---

## 1. Overview

The CMAT Council QR Attendance System is a web-based attendance tracking platform built to serve the entire CMAT departmental student council, an audience of 1,000 or more students. It replaces manual sign-in sheets with a QR-based process that ties attendance to physical presence at the event venue, while giving officers full control over event scheduling and giving students self-service access to their own attendance history.

This is being built for actual use by the council, not as a classroom exercise only.

---

## 2. Scope

- Covers the whole CMAT department, not a single club or org.
- Expected user base: 1,000+ students, plus council officers and one or more admins.
- Platform: web-based, accessed from both desktop and mobile browsers.
- Events are typically held in gyms or covered courts, and may run for a single day or span multiple consecutive days.

---

## 3. User Roles

### 3.1 Admin
- Oversees the entire system.
- Manages council officer accounts.
- Has full visibility into the audit log.
- Configures semester periods.
- Can view data across all programs, year levels, and sections.

### 3.2 Council / Officer
- Creates and manages events.
- Sets and adjusts sign-in/sign-out time windows.
- Scans student QR codes during events.
- Views attendance reports for the events they manage.

### 3.3 Student
- Views upcoming and ongoing events.
- Generates a QR code to sign in or sign out of an event.
- Views their own full attendance history for the semester.

---

## 4. Core Features

### 4.1 Event Management (Council)
- Officers can create events with a title, venue, and schedule.
- Each event has customizable sign-in and sign-out time windows.
- Officers can extend a time window mid-event (for example, extending sign-in by 15 minutes). The system checks window validity live, so any extension takes effect immediately for students who have not yet signed in.
- Events can span multiple days without needing to be recreated for each day. Each day within a multi-day event carries its own independent sign-in and sign-out windows, so attendance is tracked per day, not just per event.

### 4.2 Audit Log (Accountability)
- Tracks who created, modified, or opened records within the council portal.
- Intended to provide accountability for event creation and changes to attendance-affecting settings, viewable in full by the Admin role.

### 4.3 Student Attendance Flow
- Students log in and view the list of events open to them.
- To sign in or sign out, a student taps the corresponding button, which generates a QR code on their screen.
- The QR code is short-lived (on the order of 60 seconds) and single-use: once scanned, it cannot be reused.
- Generating the QR code is only permitted when the student's device location is confirmed to be within range of the event venue (see Section 5).
- An officer scans the code using the council scanning tool. On a successful scan, the student's name is displayed to the officer, allowing a quick visual check against the person standing in front of them.
- Attendance is recorded immediately upon a valid scan.

### 4.4 Attendance History
- Students can view their full attendance record across all events in a semester.
- This history is intended to be presented during clearance signing.

---

## 5. Location Restriction

A core requirement of this system is that attendance can only be recorded when the student is physically present at the event venue.

**Chosen approach: GPS-based geofencing.**

- When a student taps sign in or sign out, the app checks the device's GPS coordinates against the venue's registered coordinates and a defined radius.
- QR generation is blocked if the device is outside that radius.

**Why GPS over a local network restriction:**
- The system needs to be reachable at all times, not only during events, since students need to check events and view their attendance history outside of event days.
- A phone or laptop hotspot cannot reliably support 1,000+ simultaneous connections, ruling out a local-network-only setup for events at this scale.
- GPS requires no special networking hardware or campus IT coordination, which fits the resources available to the project team.

**Known limitations:**
- GPS accuracy can drift indoors, particularly inside concrete or steel-roofed gyms, so the radius needs to be set generously to avoid rejecting legitimate students.
- GPS can be spoofed on devices with developer settings unlocked. This is treated as an acceptable residual risk for this use case, mitigated by the officer visually confirming the student's name at scan time rather than relying on location alone.

---

## 6. Attendance Token Design

Rather than issuing students a permanent, printable QR code, the system generates a new QR code on demand for each sign-in or sign-out action.

**Why not a permanent QR code:**
A static, reusable code can be screenshotted or photographed and shared with someone else, defeating the purpose of the location and identity checks. A code that expires within about a minute of being generated, and that can only be scanned once, closes that gap.

**Trade-off:** because the code only exists on the student's own phone screen at the moment of scanning, it cannot be pre-printed onto an ID or card, which makes screen visibility and glare at the scanning point a practical factor to manage at events.

---

## 7. Authentication

| Role | Login Method |
|---|---|
| Student | Student ID (with an additional identifier, to be finalized) as username, paired with a system-generated password |
| Officer / Admin | Not yet finalized — recommended: official school email plus a password, to keep every account tied to a verifiable individual for audit purposes |

---

## 8. Hosting Requirements

- The system requires a real, always-on server reachable from anywhere, since students need access to events and attendance history outside of event days. A laptop that is only powered on during events is not sufficient.
- At the event venue itself, officer and student devices need a working internet connection (WiFi or mobile data) to submit sign-ins and scans. GPS location itself does not require internet, but submitting the sign-in request to the server does.
- Signal strength inside actual event venues (particularly gyms) should be tested ahead of time, since covered courts can weaken cellular signal.

---

## 9. Data Source

- A masterlist of CMAT students will be obtained to populate the student database and enable bulk QR/account generation.
- Because this masterlist contains personal data covered by the Data Privacy Act, written permission from the appropriate department authority should be secured before the list is pulled or used, and only the fields actually needed by the system should be stored.

---

## 10. Open Items

The following decisions are not yet finalized:

1. Exact format of the student login identifier ("student ID with some addition").
2. Officer and admin login method (recommended: school email + password, pending confirmation).
3. Whether an offline queueing fallback is needed for poor venue connectivity — pending a signal test at an actual venue.
4. Formal database schema (table structures) — ready to be drafted based on the decisions recorded in this document.
5. Formal written permission to obtain and use the student masterlist.

---

## 11. Out of Scope / Not Yet Decided

- Whether officers scan via a dedicated mobile app or a browser-based scanning page.
- Process for handling students who forget or are unable to generate a QR (manual override entry).
- Reporting and export formats (e.g., Excel/PDF export) for clearance and council use.

---

*This document reflects the system design as discussed and decided to date. It should be updated as further decisions are made, particularly once the database schema and remaining login details are finalized.*
