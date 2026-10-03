# Lab 3 Test Plan and Traceability

## 1. Strategy

| Layer | Tools | Covers |
|---|---|---|
| Unit | Vitest | Password policy, status transition matrix |
| API / integration / security | Vitest + Supertest + PostgreSQL | Login, sessions, role and ownership checks, queue, ticket operations, comments and notes, user administration |
| Migration / regression | Vitest + updated Lab 2 suites | Lab 2 data and behaviour preserved, idempotent seed |
| UI component and style | Vitest + React Testing Library | New screens, states, badges, labels |
| Responsive / accessibility | Visual inspection at 1440×900, 768×1024, 375×812 | Layout, no horizontal scroll |
| End-to-end | Playwright | Complete role workflows |

Tests use the seed accounts (`ChangeMe123`, see `specification.md` §7).

## 2. Planned Tests

### 2.1 Unit, API, Security, and Migration

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-04 | Password policy boundaries (7, 8, 72, 73 characters; no digit; no letter) | Valid only 8–72 with a letter and a digit | `server/tests/lab-03/rules.unit.test.ts` | Pass |
| UNIT-02 | Unit | AC-14 | Status transition matrix, all pairs | Only the listed transitions are allowed | `server/tests/lab-03/rules.unit.test.ts` | Pass |
| API-01 | API | AC-01 | Valid login for each role | `200`, cookie set, identity and role returned, no hash | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-02 | API | AC-02 | Wrong password, unknown email | Same `401`; no session | `auth.api.test.ts` | Pass |
| API-03 | API | AC-02 | Inactive user (correct password) | `403 ACCOUNT_INACTIVE`; no session | `auth.api.test.ts` | Pass |
| API-04 | API | AC-03 | User who must change password calls other endpoints | `403 PASSWORD_CHANGE_REQUIRED`; me, change-password, logout work | `auth.api.test.ts` | Pass |
| API-05 | API | AC-04 | Change password: valid, wrong current, weak, same as current | `200` with flag cleared (stored hash is bcrypt); otherwise `400` | `auth.api.test.ts` | Pass |
| API-06 | API | AC-05 | Logout then reuse cookie; no session; user deactivated mid-session | `401` in each case | `auth.api.test.ts` | Pass |
| API-07 | Security | AC-06 | Create and list tickets with a foreign `requesterId` | Authenticated identity used; only own tickets | `authorization.api.test.ts` | Pass |
| API-08 | Security | AC-07 | Requester B requests A's ticket, attachment, comments | `404`, no data | `authorization.api.test.ts` | Pass |
| API-09 | API | AC-08 | Lab 2 flows under login (create, list, search, filter, attachments); removed development-requesters endpoint | Lab 2 behaviour unchanged; old endpoint `404` | `authorization.api.test.ts` (the Lab 1 and Lab 2 test files are left unchanged) | Pass |
| API-10 | Security | AC-09, AC-21 | Wrong-role calls (Requester → staff, admin, internal notes; IT Staff → admin) | `403` for every forbidden case | `authorization.api.test.ts` | Pass |
| API-11 | API | AC-10 | Queue returns all requesters; search; filters (status, IT Priority, category, owner/unassigned); sort; pagination | Results match the query; metadata correct | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-12 | API | AC-10 | Queue invalid values (`page=0`, `sort=x`, `status=BAD`) | `400` | `staff-queue.api.test.ts` | Pass |
| API-13 | API | AC-12 | Staff ticket detail; staff download of a Requester's attachment; staff upload/remove | `200`; download works; upload/remove `403`; unknown id `404` | `server/tests/lab-03/staff-ticket-detail.api.test.ts`; staff upload/remove `403` in `authorization.api.test.ts` | Pass |
| API-14 | API | AC-12 | Claim unassigned; assign/reassign/unassign; inactive, Requester, or unknown assignee | Success; `409` for invalid assignees | `staff-ticket-detail.api.test.ts` | Pass |
| API-15 | API | AC-13 | IT Priority initial value and change; invalid value; Requester attempt | Copied at creation; Requested Priority unchanged; `400`; `403` | `staff-ticket-detail.api.test.ts` | Pass |
| API-16 | API | AC-14 | Allowed and disallowed transitions; no Owner; missing confirmation; Requester attempt | `200`; `409`; `409`; `400`; `403` | `staff-ticket-detail.api.test.ts` | Pass |
| API-17 | API | AC-15 | Public Comment by Requester and staff; read by all three roles; empty, 2001-char, and 2000-char text; edit/delete routes | `201` with backend author/time; `400`; accepted; routes absent | `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-18 | API | AC-16 | Internal Notes by staff/Admin; Requester read and post; notes absent from Requester payloads | `201`/`200`; Requester `403` with no content | `comments-notes.api.test.ts` | Pass |
| API-19 | API | AC-17 | Problem Appears Resolved: eligible, ineligible status, other Requester's ticket, staff attempt; Reopened clears flag | Flag set and status unchanged; `409`; `404`; `403`; cleared | `comments-notes.api.test.ts`; reopen in `staff-ticket-detail.api.test.ts` | Pass |
| API-20 | API | AC-18 | Admin list, name/email search, role filter, invalid role | `200` filtered by name; `400` | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-21 | API | AC-19 | Create user (valid, invalid fields, duplicate email) | `201` with must-change flag; `400`; `409` | `users-admin.api.test.ts` | Pass |
| API-22 | API | AC-19 | Edit name, email, role, active; set new initial password | Saved; old password stops working; must change | `users-admin.api.test.ts` | Pass |
| API-23 | API | AC-20 | Self-deactivation; last active Administrator deactivated or demoted | `409` | `users-admin.api.test.ts` | Pass |
| API-24 | API | AC-21 | IT Staff and Requester call admin endpoints | `403` | `users-admin.api.test.ts` | Pass |
| API-25 | API | AC-23 | Forced server error | `500`, generic message, no internals | `authorization.api.test.ts` | Pass |
| MIG-01 | Migration | AC-22 | Migrate a Lab 2 database | Tickets, attachments, categories, systems and ownership preserved; `itPriority` filled | `server/tests/lab-03/migration.test.ts` | Pass |
| MIG-02 | Migration | AC-22 | Seed run twice; password changed then reseed | Existing Requesters log in with initial password and must change it; no duplicates; changed password kept; required account counts present | `migration.test.ts` | Pass |

### 2.2 UI Component and Style

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UI-01 | UI | AC-01, AC-02 | Login: submit, busy state, invalid, inactive, network failure, client validation | Correct messages; email kept; button disabled while busy | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-02 | UI | AC-03, AC-04 | Change Password: mandatory mode, validation, server errors, success | Only this screen until saved; field messages; continues to home | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| UI-03 | UI | AC-05, AC-09, AC-21 | Shell: name and role, logout, navigation per role, forbidden screen, expired session | Only permitted links; forbidden state; Login on expiry | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-04 | UI | AC-08, AC-15, AC-17 | Requester Ticket Detail: Public Comments, Problem Appears Resolved, no Internal Notes, selector removed | As ui-spec §3.3 | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Pass |
| UI-05 | UI | AC-10 | Queue rows, search, filters, sort, pagination parameters | Correct request parameters; filter change resets page | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass |
| UI-06 | UI | AC-11 | Queue loading, empty, no results, forbidden, failure; table vs cards | Each state shown | `StaffTicketQueue.test.tsx` | Pass |
| UI-07 | UI | AC-12, AC-13 | Staff detail: information, attachments view-only, claim, owner, IT Priority | Updates and success/error messages | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| UI-08 | UI | AC-14 | Status options limited to permitted transitions; confirmation dialog; owner-required message | Dialog shown; cancel makes no request | `StaffTicketDetail.test.tsx` | Pass |
| UI-09 | UI | AC-15, AC-16 | Public and Internal composers: separate, validation, busy, failure keeps text | Correct endpoint for each composer | `StaffTicketDetail.test.tsx` | Pass |
| UI-10 | UI | AC-18 | User list columns, search, role filter, empty, no results | As ui-spec §3.6 | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| UI-11 | UI | AC-19, AC-20 | Create/edit dialogs, set initial password, duplicate email, own row disabled, last-Administrator message | Messages near fields; password cleared on close | `UserManagement.test.tsx` | Pass |
| UI-12 | UI | AC-23 | Busy state and kept values on failure across new screens | Buttons disabled; values retained | New component test files | Pass |
| STYLE-01 | UI Style | AC-24 | Status, priority, role, account badges; Internal Notes "Staff only" panel; read-only vs editable fields; button and error classes | Text labels and expected classes present | `StaffTicketDetail.test.tsx`, `UserManagement.test.tsx`, `RequesterTicketDetail.test.tsx` (status badges) | Pass |

### 2.3 Responsive, Accessibility, and End-to-End

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test / Evidence | Final |
|---|---|---|---|---|---|---|
| RESP-01 | Responsive | AC-24 | Login, Change Password, Queue, Staff Ticket Detail, User Management at 3 viewports | No clipping or horizontal scroll; cards on mobile | `e2e/lab-03/responsive-screenshots.spec.ts` (also checks no sideways scroll); screenshots in `artifacts/lab-03/screenshots/` | Pass |
| A11Y-01 | Accessibility | AC-24 | Labels, alert/status roles, dialog focus and `Esc`, keyboard walkthrough | Controls reachable with visible focus | Component tests, Playwright keyboard checks (`Esc`), and a manual check | Pass |
| E2E-01 | E2E | AC-01–AC-05 | Valid and invalid login, inactive account, first login with forced password change, logout | Correct feedback; app opens only after valid change | `e2e/lab-03/authentication.spec.ts` | Pass |
| E2E-02 | E2E | AC-06–AC-08, AC-15, AC-17 | Requester logs in, creates a ticket, comments, marks Problem Appears Resolved | Works without selector; only own data | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass |
| E2E-03 | E2E | AC-09–AC-16 | IT Staff finds the ticket, claims it, sets IT Priority, changes status with confirmation, posts a Public Comment and an Internal Note; Requester sees the comment but not the note | Full workflow with privacy preserved | `staff-ticket-flow.spec.ts` | Pass |
| E2E-04 | E2E | AC-18–AC-21 | Administrator creates a user, edits the role, sets an initial password, deactivates; safety rules; non-admin blocked | All rules visible in the UI | `e2e/lab-03/user-administration.spec.ts` | Pass |

## 3. Acceptance Criteria Traceability

| AC | Tests | AC | Tests |
|---|---|---|---|
| AC-01 | API-01, UI-01, E2E-01 | AC-13 | API-15, UI-07, E2E-03 |
| AC-02 | API-02, API-03, UI-01, E2E-01 | AC-14 | UNIT-02, API-16, UI-08, E2E-03 |
| AC-03 | API-04, UI-02, E2E-01 | AC-15 | API-17, UI-04, UI-09, E2E-02, E2E-03 |
| AC-04 | UNIT-01, API-05, UI-02, E2E-01 | AC-16 | API-18, UI-09, E2E-03 |
| AC-05 | API-06, UI-03, E2E-01 | AC-17 | API-19, UI-04, E2E-02 |
| AC-06 | API-07, E2E-02 | AC-18 | API-20, UI-10, E2E-04 |
| AC-07 | API-08, E2E-02 | AC-19 | API-21, API-22, UI-11, E2E-04 |
| AC-08 | API-09, UI-04, E2E-02 | AC-20 | API-23, UI-11, E2E-04 |
| AC-09 | API-10, UI-03, E2E-03 | AC-21 | API-10, API-24, UI-03, E2E-04 |
| AC-10 | API-11, API-12, UI-05, E2E-03 | AC-22 | MIG-01, MIG-02 |
| AC-11 | UI-06, RESP-01 | AC-23 | API-25, UI-12 |
| AC-12 | API-13, API-14, UI-07, E2E-03 | AC-24 | STYLE-01, RESP-01, A11Y-01 |

## 4. Responsive and Visual Checklist

Checked against `ui-spec.md` §6 at Desktop (1440×900), Tablet (768×1024), and Mobile (375×812) for Login, Change Password, Ticket Queue, Staff Ticket Detail, and User Management. The screenshots are in `artifacts/lab-03/screenshots/`; the Playwright run also asserts that no screen scrolls sideways at any of the three sizes.

- [x] Desktop: tables and two-column Staff Ticket Detail display correctly.
- [x] Tablet: tables remain usable, single-column detail, toolbars do not overlap. (The queue table was tightened after inspection: the ticket number stays on one line and the requester sits under the summary.)
- [x] Mobile: queue and user list switch to cards, dialogs fit the screen.
- [x] No clipped text, overlapping controls, or horizontal page scroll at any size. (The Sort option "Default (priority, oldest first)" was clipped on mobile and was shortened to "Default".)
- [x] Badges, read-only vs editable fields, and Public vs Internal panels follow the Zen Green spec.

## 5. Test Commands

Run `npm run prisma:seed` first: the Lab 3 tests log in with the seeded accounts and do not create their own users.

```bash
cd server && npx vitest run tests/lab-03   # unit, API, security, migration
cd client && npx vitest run tests/lab-03   # UI component and style
npx playwright test                        # end-to-end and screenshots (e2e/lab-03)
```

## 6. Final Results

Run on the Lab 3 branch with the seeded database (Lab 3 test folders only).

```text
=== server (cd server && npx vitest run tests/lab-03)
 ✓ tests/lab-03/authorization.api.test.ts (20 tests)
 ✓ tests/lab-03/users-admin.api.test.ts (20 tests)
 ✓ tests/lab-03/comments-notes.api.test.ts (20 tests)
 ✓ tests/lab-03/staff-ticket-detail.api.test.ts (17 tests)
 ✓ tests/lab-03/auth.api.test.ts (13 tests)
 ✓ tests/lab-03/migration.test.ts (3 tests)
 ✓ tests/lab-03/staff-queue.api.test.ts (10 tests)
 ✓ tests/lab-03/rules.unit.test.ts (10 tests)
 Test Files  8 passed (8)
      Tests  113 passed (113)

=== client (cd client && npx vitest run tests/lab-03)
 ✓ tests/lab-03/RequesterTicketDetail.test.tsx (15 tests)
 ✓ tests/lab-03/StaffTicketQueue.test.tsx (13 tests)
 ✓ tests/lab-03/Login.test.tsx (14 tests)
 ✓ tests/lab-03/ChangePassword.test.tsx (6 tests)
 ✓ tests/lab-03/StaffTicketDetail.test.tsx (29 tests)
 ✓ tests/lab-03/UserManagement.test.tsx (21 tests)
 Test Files  6 passed (6)
      Tests  98 passed (98)

=== type checks and build
server tsc: ok
client build: ok

=== e2e (npx playwright test)
  authentication.spec.ts               8 passed
  staff-ticket-flow.spec.ts            1 passed
  user-administration.spec.ts          1 passed
  responsive-screenshots.spec.ts      12 passed (3 sizes x 4 screen groups, 54 screenshots)
  22 passed
```

## 7. Known Limitations or Deferred Tests

- Actions Taken and the rule blocking resolution until they are complete are deferred to Lab 4.
- Login lockout and rate limiting are not implemented, so they are not tested.
- Sessions use an in-memory store, so restart behaviour is not tested.
- The Lab 1 and Lab 2 tests were written for the Lab 2 API and are not expected to pass after Lab 3 replaced the Development Requester with login. They were left unchanged; the Lab 2 behaviour is covered again by the Lab 3 regression tests (AC-08, API-09).
- The screens are state-based (there is no URL for each page), so a user cannot open a page that their role does not show. The "forbidden" message for a direct visit is therefore not reachable from the browser; the backend still answers `403` for every restricted request (API-10, E2E-03, E2E-04).