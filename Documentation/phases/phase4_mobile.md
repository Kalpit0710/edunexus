# Phase 4 — Mobile Expansion

> **Timeline:** Post Phase 3 (Future — TBD)  
> **Prerequisites:** 20+ active schools, Phase 3 complete and stable

---

## Overview

Phase 4 converts EduNexus into a **full native mobile experience** using React Native (Expo). The backend remains **exactly the same** — no rewrite needed. The mobile app simply uses the same Supabase APIs.

```
React Native App
      │
      │ (Same Supabase Auth + PostgREST + Edge Functions)
      ▼
EduNexus Supabase Backend
```

---

## Apps Planned

### Parent App (Priority: High)
The most-used mobile interface. Parents check this daily.
- Dashboard (child summary)
- Attendance calendar
- Fee status + payment
- Results + report card download
- Announcements
- Push notifications for all events

### Teacher App (Priority: Medium)
- Mark attendance (offline-first)
- View class roster
- Enter marks
- Post announcements
- Push notifications

### Student App (Future)
- Timetable
- Homework (if module added)
- Results
- Announcements

---

## Technical Approach

| Item | Decision |
|------|----------|
| Framework | React Native (Expo) |
| Navigation | Expo Router (file-based, mirrors web app structure) |
| State | Same Zustand + React Query patterns as web |
| Auth | Supabase Auth + Expo SecureStore for token storage |
| Push Notifications | Expo Push Notifications → Supabase Edge Function |
| Offline | WatermelonDB / MMKV for local cache |
| Code sharing | Shared types and utility functions with web codebase |

---

## Optional Advanced Features (Phase 4+)

| Feature | Description |
|---------|-------------|
| Biometric attendance | Fingerprint/face for teacher login + attendance |
| QR code attendance | Students scan QR on entry |
| Online fee payment | Razorpay / Stripe integration |
| In-app chat | Parent ↔ Teacher messaging |
| Digital ID cards | Student QR code ID viewable in app |

---

## Exit Criteria

- [ ] Parent app on iOS + Android app stores
- [ ] Teacher app (internal distribution or stores)
- [ ] Push notification delivery > 95%
- [ ] Offline attendance: marks saved locally, synced on reconnect
- [ ] App Store rating: 4.0+
