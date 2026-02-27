# Module 08 — Communication & Announcements

> **Phase:** Phase 1 (basic) + Phase 2 (notifications) | **Priority:** P1

## Overview
Enables school staff to communicate with students, parents, and other teachers through in-app announcements and email notifications.

## Announcement Audiences
| Audience | Description |
|----------|-------------|
| `school` | Entire school (all roles) |
| `class` | All students/parents of a class |
| `section` | Specific section (e.g., Grade 5A) |
| `teachers` | All teachers only |
| `parents` | All parents only |

## Announcement Features
- Rich text content
- Optional PDF attachment
- Scheduled publishing (`publish_at` future timestamp)
- Expiry date (announcement disappears after)
- Admin approval for teacher announcements (configurable)

## Email Notification Events
| Event | Trigger | Recipient |
|-------|---------|-----------|
| Fee due reminder | Cron (configurable) | Parent |
| Fee receipt | After payment | Parent |
| Student absent | Daily cron | Parent |
| Exam announced | On exam create/publish | Parent |
| Results published | On exam result publish | Parent |
| General announcement | On publish | Relevant audience |

## Phase 1 Scope
- [x] Announcement CRUD
- [x] Audience targeting
- [x] In-app announcement display per role

## Phase 2 Additions
- [ ] Email delivery via Resend Edge Function
- [ ] Notification log (delivery tracking)
- [ ] Fee reminder scheduler (configurable per school)
- [ ] PDF attachment support
- [ ] Announcement approval workflow
