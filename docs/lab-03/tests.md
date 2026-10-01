# Lab 3 Test Plan and Traceability

> Written before implementation (Test DD / TDD) from `specification.md`, `api-spec.md`, and `ui-spec.md`. **Final Status** is `Planned` until the test runs; it is updated to `Pass` only from real output on `main`.

## 1. Test Strategy

| Layer | Tooling | Focus |
|---|---|---|
| Unit | Vitest | Password policy, transition matrix, query-param parsing, email normalisation |
| API / Integration | Vitest + Supertest + PostgreSQL/Prisma (cookie-agent sessions) | Auth, sessions, authorization matrix, ownership, queue, ticket operations, comments/notes, admin |
| Security / Authorization | Supertest | Direct API calls with wrong role, no session, other user's data, CSRF header, no hash leakage |
| Migration / Regression | Vitest + scripts, updated Lab 2 suites | Lab 2 data preserved, idempotent seed, Lab 2 flows under authentication |
| UI Component | Vitest + React Testing Library | Login, Change Password, Queue, Staff Detail, User Management, Requester additions |
| UI Style / Accessibility | RTL class/role assertions + manual | Badges, panels, labels, roles, focus |
| Responsive | Visual inspection at 1440×900, 768×1024, 375×812 | Layout, cards vs table, no h-scroll |
| End-to-End | Playwright | Complete role workflows |

Test data come from the idempotent seed (`ChangeMe123`; see specification §7.5). API tests create their own records and clean up.

## 2. Planned Tests

### 2.1 Unit

| ID | Req / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| UNIT-01 | BR-07 / AC-05 | Password policy boundaries (7/8/72/73 chars, no digit, no letter, spaces) | Accepts 8–72 with letter+digit; rejects others | `server/tests/lab-03/password-policy.unit.test.ts` | Planned |
| UNIT-02 | BR-16 / AC-18 | Transition matrix function for all 8×8 pairs | Only pairs in BR-16 allowed; same-status rejected | `server/tests/lab-03/status-transitions.unit.test.ts` | Planned |
| UNIT-03 | BR-27 / AC-23 | Email normalisation/validation | Trimmed, lower-cased; invalid/>254 rejected | `server/tests/lab-03/user-validation.unit.test.ts` | Planned |
| UNIT-04 | BR-24 / AC-13 | Queue query parser | Defaults applied; unknown/invalid values produce errors | `server/tests/lab-03/queue-query.unit.test.ts` | Planned |

### 2.2 API, Authorization, and Security

| ID | Req / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| API-01 | AC-01 | Valid login (each role) | `200`, cookie set, user id/name/email/role/mustChangePassword, no hash | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-02 | AC-02 | Wrong password; unknown email | Identical `401 INVALID_CREDENTIALS`; no cookie | `auth.api.test.ts` | Planned |
| API-03 | AC-03 | Inactive user, correct password; wrong password | `403 ACCOUNT_INACTIVE`; wrong password gives generic `401`; no session | `auth.api.test.ts` | Planned |
| API-04 | AC-01 | Missing/blank login fields | `400 VALIDATION_ERROR` | `auth.api.test.ts` | Planned |
| API-05 | AC-04 | `mustChangePassword` user calls tickets, staff, admin endpoints | `403 PASSWORD_CHANGE_REQUIRED`; `/auth/me`, change-password, logout still work | `auth.api.test.ts` | Planned |
| API-06 | AC-05 | Change password success | `200`; flag cleared; old password fails, new works; stored hash is bcrypt | `auth.api.test.ts` | Planned |
| API-07 | AC-05 | Change password invalid (wrong current, weak, same as current) | `400` with field errors; password unchanged | `auth.api.test.ts` | Planned |
| API-08 | AC-06 | Logout then reuse cookie | `204`, then `/auth/me` `401` | `auth.api.test.ts` | Planned |
| API-09 | AC-06 | Protected endpoints without session | `401 UNAUTHENTICATED` for sample of every group | `authorization.api.test.ts` | Planned |
| API-10 | AC-06 | User deactivated while session active | Next request `401` | `authorization.api.test.ts` | Planned |
| API-11 | AC-06 | Session cookie attributes; session id changes at login; expired session | HttpOnly, SameSite=Lax; new id after login; `401` after expiry | `auth.api.test.ts` | Planned |
| API-12 | AC-07 | Scan responses of auth/admin/staff endpoints | No `passwordHash`/password fields anywhere | `authorization.api.test.ts` | Planned |
| API-13 | AC-12 | Role × endpoint matrix (specification §5.3) incl. Requester→`/staff`,`/admin`, internal notes; Staff→`/admin` | `403 FORBIDDEN` for every forbidden cell; allowed cells succeed | `authorization.api.test.ts` | Planned |
| API-14 | AC-12 | Mutating request without `X-Requested-With` | `403 CSRF_REJECTED` | `authorization.api.test.ts` | Planned |
| API-15 | AC-08 | Create ticket with foreign `requesterId` in body | Ticket owned by authenticated user; `itPriority = requestedPriority`; owner null | `requester-regression.api.test.ts` | Planned |
| API-16 | AC-08 | List tickets with foreign `requesterId` query | Only own tickets returned | `requester-regression.api.test.ts` | Planned |
| API-17 | AC-09 | Requester B requests A's ticket, attachments, download, comments, delete attachment | `404 NOT_FOUND`, identical to non-existent id | `requester-regression.api.test.ts` | Planned |
| API-18 | AC-10 | Lab 2 flows under login: validation, search, filter, sort, pagination, empty, attachments (type, size, 5-limit, soft-remove, `410`) | Lab 2 behaviour unchanged | `requester-regression.api.test.ts` (updated Lab 2 suites in `server/tests/lab-02/`) | Planned |
| API-19 | AC-10 | `GET /api/development-requesters` | `404` (removed) | `requester-regression.api.test.ts` | Planned |
| API-20 | AC-13 | Queue returns all requesters' tickets for staff | `200`; items from multiple requesters; pagination + counts | `staff-queue.api.test.ts` | Planned |
| API-21 | AC-13 | Queue search (ticket no., summary, requester name) | Only matches | `staff-queue.api.test.ts` | Planned |
| API-22 | AC-13 | Queue filters: status, itPriority, categoryId, ownerId (id/unassigned/me), combined | Results satisfy all filters | `staff-queue.api.test.ts` | Planned |
| API-23 | AC-13 | Queue sort options and default ordering | Order as specified; ties stable | `staff-queue.api.test.ts` | Planned |
| API-24 | AC-13 | Pagination: sizes 10/25/50, page beyond range, metadata | Correct slices and `totalItems/totalPages` | `staff-queue.api.test.ts` | Planned |
| API-25 | AC-13 | Invalid params (`pageSize=7`, `sort=x`, `status=BAD`, `page=0`) | `400 VALIDATION_ERROR` with `fields` | `staff-queue.api.test.ts` | Planned |
| API-26 | AC-15 | Staff ticket detail incl. `allowedTransitions`; unknown id | `200` full data; `404` | `staff-ticket-detail.api.test.ts` | Planned |
| API-27 | AC-15 | Staff lists/downloads Requester attachment; staff upload/delete | Download `200`; upload/delete `403` | `staff-ticket-detail.api.test.ts` | Planned |
| API-28 | AC-16 | Claim unassigned; claim owned | `200` owner = caller; `409 ALREADY_OWNED` | `staff-ticket-detail.api.test.ts` | Planned |
| API-29 | AC-16 | Assign/reassign/unassign valid; to inactive, Requester, unknown user | Success; `409 INVALID_ASSIGNEE` for invalid targets | `staff-ticket-detail.api.test.ts` | Planned |
| API-30 | AC-17 | IT Priority change keeps Requested Priority; invalid value; Requester attempt | `200`/`400`/`403` | `staff-ticket-detail.api.test.ts` | Planned |
| API-31 | AC-18 | Every allowed transition succeeds; sample of disallowed and same-status | `200`; `409 INVALID_TRANSITION` | `staff-ticket-detail.api.test.ts` | Planned |
| API-32 | AC-18 | Status change with no owner; to Cancelled with no owner | `409 OWNER_REQUIRED`; Cancelled allowed | `staff-ticket-detail.api.test.ts` | Planned |
| API-33 | AC-18 | Resolved/Closed/Cancelled without `confirm`; Requester status attempt | `400`; `403` | `staff-ticket-detail.api.test.ts` | Planned |
| API-34 | AC-19 | Post Public Comment as Requester and staff; read by all three roles | `201`; author/time from backend; visible to all | `comments-notes.api.test.ts` | Planned |
| API-35 | AC-19 | Blank, whitespace, 2001-char comment; 2000-char accepted; no PUT/DELETE | `400`; accepted; `404/405` | `comments-notes.api.test.ts` | Planned |
| API-36 | AC-19 | Requester comment on Closed/Cancelled ticket; staff same | `409 TICKET_CLOSED_FOR_COMMENTS`; staff `201` | `comments-notes.api.test.ts` | Planned |
| API-37 | AC-20 | Staff/Admin post and read Internal Notes; validation | `201`/`200`; same limits | `comments-notes.api.test.ts` | Planned |
| API-38 | AC-20 | Requester calls internal-notes GET/POST (own and others' ticket) | `403`, no note content; notes absent from `/tickets/:id` and comments payloads | `comments-notes.api.test.ts` | Planned |
| API-39 | AC-21 | Appears Resolved in eligible status; idempotent; ineligible status; non-owner; staff attempt | `200` flag set, status unchanged; `409 NOT_RESOLVABLE`; `404`; `403` | `comments-notes.api.test.ts` | Planned |
| API-40 | AC-21 | Reopen clears the flag | `requesterMarkedResolved = false` | `staff-ticket-detail.api.test.ts` | Planned |
| API-41 | BR-25 / AC-15 | Owner/priority/status/comment/note updates | `updatedAt` advances | `staff-ticket-detail.api.test.ts` | Planned |
| API-42 | AC-22 | Admin list; search by name/email (case-insensitive); role filter; invalid role | `200` filtered, name order; `400` | `users-admin.api.test.ts` | Planned |
| API-43 | AC-23 | Create user valid; user logs in and is gated | `201`, `mustChangePassword = true`, hash stored | `users-admin.api.test.ts` | Planned |
| API-44 | AC-23 | Create invalid (name, email, role, weak password) and duplicate email (case-variant) | `400`; `409 EMAIL_TAKEN` | `users-admin.api.test.ts` | Planned |
| API-45 | AC-24 | Edit name/email/role/active; invalid role; duplicate email; empty body; unknown id | `200`; `400`; `409`; `404` | `users-admin.api.test.ts` | Planned |
| API-46 | AC-25 | Set new initial password | Old password fails; new works; must change | `users-admin.api.test.ts` | Planned |
| API-47 | AC-26 | Admin deactivates self | `409 CANNOT_DEACTIVATE_SELF` | `users-admin.api.test.ts` | Planned |
| API-48 | AC-26 | Deactivate/demote last active Admin; allowed when another admin exists | `409 LAST_ADMIN_REQUIRED`; `200` | `users-admin.api.test.ts` | Planned |
| API-49 | AC-27 | Staff and Requester call every `/api/admin/*` endpoint; delete route | `403`; delete `404` | `users-admin.api.test.ts` | Planned |
| API-50 | AC-29 | Forced server error (mocked Prisma failure) | `500 INTERNAL_ERROR`, generic message, no stack/SQL | `authorization.api.test.ts` | Planned |

### 2.3 Migration and Regression

| ID | Req / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| MIG-01 | AC-28 | Apply migration to a Lab 2-shaped database (fixture) | Tickets, attachments, categories, systems keep ids; requesterId still resolves to User | `server/tests/lab-03/migration.test.ts` | Planned |
| MIG-02 | AC-28 | Migrated users before seed | `passwordHash = '!'`, cannot log in; `itPriority = requestedPriority` | `migration.test.ts` | Planned |
| MIG-03 | AC-28 | Seed/initial-password step | Existing Requesters can log in with documented initial password and are gated | `migration.test.ts` | Planned |
| MIG-04 | AC-28 | Run seed twice; change a password then reseed | No duplicates; changed password preserved; counts per role/active state met (4+1 Requesters, 3+1 Staff, 1 Admin) | `migration.test.ts` | Planned |
| MIG-05 | AC-10 | Updated Lab 2 server and client suites | Pass under authentication | `server/tests/lab-02/`, `client/tests/lab-02/` | Planned |
| MIG-06 | AC-10 | Selector code and `sessionStorage` key removed | No selector component; stale key cleared on load | `client/tests/lab-03/Shell.test.tsx` | Planned |

### 2.4 UI Component

| ID | Req / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| UI-01 | AC-01, AC-29 | Login valid / busy state | Calls API, button disabled while busy, navigates to role home | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-02 | AC-02, AC-03 | Login invalid credentials, inactive, network failure | Correct alert text; email kept; password cleared | `Login.test.tsx` | Planned |
| UI-03 | AC-02 | Login client validation (empty, bad email) | Field messages; no request | `Login.test.tsx` | Planned |
| UI-04 | AC-04 | `mustChangePassword` login | Change Password shown, no navigation, no other screen reachable | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-05 | AC-05 | Change Password validation (policy, mismatch, same as current) and server field errors | Messages beside fields; submit blocked | `ChangePassword.test.tsx` | Planned |
| UI-06 | AC-05 | Change Password success, mandatory vs voluntary | Continues to home / returns | `ChangePassword.test.tsx` | Planned |
| UI-07 | AC-06, AC-11 | Shell shows name + role; Logout; session restore via `/auth/me`; mid-session `401` | Login shown with expiry message | `client/tests/lab-03/Shell.test.tsx` | Planned |
| UI-08 | AC-11 | Navigation per role; direct access to unauthorized screen | Only permitted links; Forbidden state | `Shell.test.tsx` | Planned |
| UI-09 | AC-10, AC-21 | Requester Ticket Detail: Appears Resolved button visibility/after state; no Internal Notes | Matches BR-19; no notes request | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Planned |
| UI-10 | AC-19 | Requester comment composer and thread; closed ticket message | Posts; counter; hidden when Closed/Cancelled | `RequesterTicketDetail.test.tsx` | Planned |
| UI-11 | AC-13 | Queue renders rows, counts, badges, owner/unassigned | Matches API data | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-12 | AC-13 | Queue search/filter/sort/page-size/pagination send correct params; filter change resets page | Params correct | `StaffTicketQueue.test.tsx` | Planned |
| UI-13 | AC-14 | Queue loading, empty, no-results (+Clear Filters), forbidden, failure (+Retry) | Each state shown | `StaffTicketQueue.test.tsx` | Planned |
| UI-14 | AC-14 | Queue table vs cards by viewport | Table ≥768, cards below | `StaffTicketQueue.test.tsx` | Planned |
| UI-15 | AC-15 | Staff Detail renders grouped read-only info and attachments (no Add/Remove) | As ui-spec §3.5 | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-16 | AC-16 | Claim and owner change; error alerts for conflicts | Calls API, "Saved", conflict text | `StaffTicketDetail.test.tsx` | Planned |
| UI-17 | AC-17 | IT Priority change keeps Requested Priority displayed | Updated badge | `StaffTicketDetail.test.tsx` | Planned |
| UI-18 | AC-18 | Status dropdown limited to `allowedTransitions`; confirm dialog for Resolved/Closed/Cancelled; owner-required message | Dialog shown; cancel does not call API | `StaffTicketDetail.test.tsx` | Planned |
| UI-19 | AC-19, AC-20 | Public Comment and Internal Note composers: separate, validation, busy, failure keeps text | Correct endpoint per composer | `StaffTicketDetail.test.tsx` | Planned |
| UI-20 | AC-22 | User list columns, search, role filter, empty/no-results | As ui-spec §3.6 | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-21 | AC-23, AC-24 | Create/Edit dialogs: validation, success banners, duplicate-email conflict | Messages near fields | `UserManagement.test.tsx` | Planned |
| UI-22 | AC-25 | Set new initial password dialog; password cleared on close | API called; not displayed | `UserManagement.test.tsx` | Planned |
| UI-23 | AC-26 | Own row Active control disabled; last-admin conflict message | Disabled; message shown | `UserManagement.test.tsx` | Planned |
| UI-24 | AC-27 | User Management hidden for non-admin; forbidden state | Absent / Forbidden | `Shell.test.tsx` | Planned |
| UI-25 | AC-29 | Busy states and form retention on API failure across new screens | Buttons disabled; values kept | Component test files above | Planned |

### 2.5 UI Style, Accessibility, Responsive

| ID | Req / AC | What It Tests | Expected Result | Automated / Manual | Final |
|---|---|---|---|---|---|
| STYLE-01 | AC-31 | Status, Priority, Role, Account badges render text + expected classes for every value | Consistent badge component | `client/tests/lab-03/Badges.test.tsx` | Planned |
| STYLE-02 | AC-31 | Internal Notes panel has warning style and "Staff only" label; Public panel does not | Distinct | `StaffTicketDetail.test.tsx` | Planned |
| STYLE-03 | AC-31 | Read-only vs editable fields styling on Staff Detail | Read-only shading class vs editable | `StaffTicketDetail.test.tsx` | Planned |
| STYLE-04 | AC-31 | Primary/secondary/destructive button hierarchy; invalid-feedback class | Bootstrap classes present | `Login.test.tsx`, `UserManagement.test.tsx` | Planned |
| A11Y-01 | AC-30 | Labels, roles (`alert`, `status`, `dialog`), table header scopes, Show/Hide `aria-pressed`, focus into dialog | Queries by role/label succeed | New component tests | Planned |
| A11Y-02 | AC-30 | Keyboard-only walkthrough of login, queue, detail, user dialogs | Reachable, visible focus, Esc closes dialogs | Manual | Planned |
| RESP-01 | AC-30 | Login/Change Password at 3 viewports | No clipping/h-scroll | Screenshots `authentication/` | Planned |
| RESP-02 | AC-30 | Queue at 3 viewports (table/cards, toolbar) | No clipping/h-scroll | Screenshots `staff-queue/` | Planned |
| RESP-03 | AC-30 | Staff Ticket Detail at 3 viewports | Two-column → single column; usable | Screenshots `staff-ticket-detail/` | Planned |
| RESP-04 | AC-30 | User Management at 3 viewports incl. dialogs | Table → cards; dialogs usable | Screenshots `user-management/` | Planned |

### 2.6 End-to-End (Playwright)

| ID | Req / AC | Scenario | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|
| E2E-01 | AC-01–03, 06 | Valid login, invalid login, inactive account, logout | Correct feedback; logout returns to Login; back button shows no data | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | AC-04, 05 | First login with initial password → forced Change Password → app opens | Normal app only after valid change | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-03 | AC-08–11, 19, 21 | Requester logs in, creates ticket, finds it, adds attachment, comments, marks Appears Resolved | Works with no selector; only own data | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-04 | AC-13–21 | IT Staff finds that ticket in queue, claims, sets IT Priority, changes status (with confirm), posts Public Comment and Internal Note; Requester sees comment but not note | Full workflow; privacy verified | `staff-ticket-flow.spec.ts` | Planned |
| E2E-05 | AC-12, 27 | Direct URL/API access by wrong role | Forbidden state / `403` | `staff-ticket-flow.spec.ts`, `user-administration.spec.ts` | Planned |
| E2E-06 | AC-22–26 | Admin creates user, edits role, sets initial password, deactivates; new user first-logs-in; safety rules | All rules visible in UI | `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-07 | AC-29 | Backend failure during a staff action (route abort) | Safe error, values retained | `staff-ticket-flow.spec.ts` | Planned |

---

## 3. Acceptance-Criterion Traceability

| AC | Planned Tests |
|---|---|
| AC-01 | API-01, API-04, UI-01, E2E-01 |
| AC-02 | API-02, UI-02, UI-03, E2E-01 |
| AC-03 | API-03, UI-02, E2E-01 |
| AC-04 | API-05, UI-04, E2E-02 |
| AC-05 | UNIT-01, API-06, API-07, UI-05, UI-06, E2E-02 |
| AC-06 | API-08, API-09, API-10, API-11, UI-07, E2E-01 |
| AC-07 | API-06, API-12 |
| AC-08 | API-15, API-16, E2E-03 |
| AC-09 | API-17, E2E-03 |
| AC-10 | API-18, API-19, MIG-05, MIG-06, UI-09, E2E-03 |
| AC-11 | UI-07, UI-08, E2E-03 |
| AC-12 | API-13, API-14, E2E-05 |
| AC-13 | UNIT-04, API-20–API-25, UI-11, UI-12, E2E-04 |
| AC-14 | UI-13, UI-14, RESP-02 |
| AC-15 | API-26, API-27, API-41, UI-15, E2E-04 |
| AC-16 | API-28, API-29, UI-16, E2E-04 |
| AC-17 | API-30, UI-17, E2E-04 |
| AC-18 | UNIT-02, API-31, API-32, API-33, UI-18, E2E-04 |
| AC-19 | API-34, API-35, API-36, UI-10, UI-19, E2E-03, E2E-04 |
| AC-20 | API-37, API-38, UI-19, STYLE-02, E2E-04 |
| AC-21 | API-39, API-40, UI-09, E2E-03 |
| AC-22 | API-42, UI-20, E2E-06 |
| AC-23 | UNIT-03, API-43, API-44, UI-21, E2E-06 |
| AC-24 | API-45, UI-21, E2E-06 |
| AC-25 | API-46, UI-22, E2E-06 |
| AC-26 | API-47, API-48, UI-23, E2E-06 |
| AC-27 | API-49, UI-24, E2E-05 |
| AC-28 | MIG-01, MIG-02, MIG-03, MIG-04 |
| AC-29 | API-50, UI-25, UI-01, E2E-07 |
| AC-30 | A11Y-01, A11Y-02, RESP-01–RESP-04 |
| AC-31 | STYLE-01–STYLE-04 |

Every AC-01 to AC-31 has at least one planned test.

## 4. Test Execution Commands

```bash
# Backend (from server/)
npm test -- --run

# Frontend (from client/)
npm test -- --run

# End-to-end (from repo root; backend, client, seeded database running)
npx playwright test e2e/lab-03
```

Final pass/fail output from `main` (all of Lab 1–3 suites, none skipped) is pasted here at release time:

```text
(to be completed after implementation)
```
