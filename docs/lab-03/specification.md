# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal

Replace the temporary Development Requester selector with real email/password login and server-side role-based authorization for three roles: Requester, IT Staff, and Administrator. Deliver the first IT Staff workflow (Ticket Queue, Ticket Detail, ownership, IT Priority, status, Public Comments, Internal Notes) and a minimal Administrator User Management screen, while all Lab 2 Requester functions keep working with the authenticated identity.

## 2. Stakeholder Request Interpretation

The system needs real users. Users sign in securely, and anyone with an initial password must choose their own before using the app. Requesters keep using Lab 2 features as themselves and can talk to IT through Public Comments and say a problem appears resolved. IT Staff get a queue and a Ticket Detail screen to own, prioritise, update, and discuss tickets, with private Internal Notes. Administrators manage accounts on one simple screen. Every rule is enforced by the backend, not only by hiding buttons.

## 3. Scope

### Included

login/logout/current user/first-login password change; role-based navigation and API authorization; migration of Development Requesters to real users; Requester regression plus Public Comments and "Problem Appears Resolved"; IT Staff queue, Ticket Detail, ownership, IT Priority, status, Public Comments, Internal Notes; minimal user management; Zen Green UI extensions.

### Excluded (per the Lab Sheet)

email invitations/reset, MFA, social login, SSO, self-registration; Actions Taken; SLA, escalation, notifications; dashboards beyond simple counts; organisations/departments; multiple roles per user; user deletion, bulk operations, import/export, account history, extended profiles; account unlocking; user-list pagination, multi-column sort, multiple filters; editing/deleting comments or notes; production deployment changes.

## 4. Functional Requirements

**Authentication**
- **FR-01:** A user logs in with email and password and receives an authenticated session.
- **FR-02:** A user who must change the initial password can only use Change Password and Logout until a valid new password is saved.
- **FR-03:** A logged-in user can change their password; the app can retrieve the current user and log out.
- **FR-04:** The shell shows the user's name and role, a Logout action, and navigation permitted for the role. The Development Requester selector and Change Requester action are removed.

**Authorization and Requester**
- **FR-05:** The backend requires login and enforces role and ownership on every endpoint except login.
- **FR-06:** A Requester keeps all Lab 2 functions (create ticket, My Tickets, Ticket Detail, attachments) for own tickets, using the authenticated identity.
- **FR-07:** A Requester can post Public Comments on own tickets and mark a ticket "Problem Appears Resolved".

**IT Staff**
- **FR-08:** IT Staff and Administrators see a shared Ticket Queue with search, filters, sorting, and pagination.
- **FR-09:** They open Ticket Detail, with ticket information, attachments (view/download), Public Comments, and Internal Notes.
- **FR-10:** They claim, assign, reassign, or unassign the Ticket Owner.
- **FR-11:** They set IT Priority and change status through permitted transitions.
- **FR-12:** They post Public Comments and Internal Notes.

**Administrator**
- **FR-13:** An Administrator lists users (Name, Email, Role, Status), searches by name or email, and optionally filters by role.
- **FR-14:** An Administrator creates a user and edits name, email, role, and active state.
- **FR-15:** An Administrator sets a new initial password that must be changed at the next login.
- **FR-16:** The backend prevents duplicate emails, invalid roles, self-deactivation, and loss of the last active Administrator.

## 5. Business Rules

**Authentication and sessions**
- **BR-01:** Only an active user with valid credentials may authenticate.
- **BR-02:** A user marked as requiring a password change cannot enter the normal application until a new valid password is saved.
- **BR-03:** The authenticated identity, not a client-supplied `requesterId`, determines ownership of Requester operations.
- **BR-04:** A wrong password and an unknown email give the same generic error. An inactive account with the correct password gets a clear "account inactive" response. There is no lockout in Lab 3. The current-user response contains only id, name, email, role, and the password-change flag.
- **BR-05:** Passwords are hashed with bcrypt and never stored, logged, or returned. A new password must be 8–72 characters, contain at least one letter and one digit, and differ from the current password.
- **BR-06:** Sessions use an HttpOnly, SameSite=Lax cookie that expires after 30 minutes of inactivity. The session secret comes from an environment variable. The user is re-read from the database on each request, so deactivation, role changes, and password-change requirements apply immediately. Logout destroys the session. CORS allows only the client origin.

**Roles and ownership**
- **BR-07:** Each user has one role. Access follows the matrix in 5.1 and is enforced by the backend.
- **BR-08:** No session → `401`; role not permitted → `403`; invalid input → `400`; not found → `404`; rule conflict → `409`. A Requester requesting another Requester's ticket or attachment gets the same `404` as a missing one, so existence is not leaked (this replaces the Lab 2 `403`).
- **BR-09:** Public Comments are visible to the owning Requester, IT Staff, and Administrator. Internal Notes are visible only to IT Staff and Administrator and never appear in Requester responses.
- **BR-10:** A Requester can mark a ticket "Problem Appears Resolved" while it is not Resolved, Closed, or Cancelled. This only sets a flag shown to staff; it never changes status. Requesters cannot set Resolved or Closed.

### 5.1 Authorization matrix

| Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| Login, logout, current user, change own password | Yes | Yes | Yes |
| Create ticket; list/view tickets | Own only | Via queue | Via queue |
| Attachment upload / remove | Own tickets | No | No |
| Attachment list / download | Own tickets | Any ticket | Any ticket |
| Ticket Queue, staff Ticket Detail, owner, IT Priority, status | No | Yes | Yes |
| Public Comments (read, post) | Own tickets | Any ticket | Any ticket |
| Problem Appears Resolved | Own tickets | No | No |
| Internal Notes (read, post) | No | Yes | Yes |
| User Management | No | No | Yes |

The Lab Sheet leaves Administrator ticket access open; Administrators are allowed IT Staff ticket operations so they can own tickets and read Internal Notes (BR-09, BR-11). IT Staff cannot manage users.

**Ticket workflow**
- **BR-11:** A ticket has zero or one Owner, who must be an active IT Staff or Administrator user when assigned. Claiming means assigning the ticket to yourself and is offered when the ticket is unassigned. Any IT Staff or Administrator may also assign, reassign (including to themselves), or unassign any ticket.
- **BR-12:** IT Priority starts as the Requested Priority and is changed only by IT Staff or Administrator. Requested Priority never changes.
- **BR-13:** Statuses are New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, Cancelled. Only IT Staff and Administrator change status, using this matrix; any other change is rejected:

| From | Allowed to |
|---|---|
| New | Open, In Progress, Cancelled |
| Open | In Progress, Waiting for Requester, Resolved, Cancelled |
| In Progress | Open, Waiting for Requester, Resolved, Cancelled |
| Waiting for Requester | Open, In Progress, Resolved, Cancelled |
| Resolved | Closed, Reopened |
| Closed | Reopened |
| Reopened | In Progress, Waiting for Requester, Resolved, Cancelled |
| Cancelled | none |

- **BR-14:** Changing status requires an Owner (except Cancelling), and Resolved, Closed, and Cancelled require confirmation. Moving to Reopened clears the "Problem Appears Resolved" flag.
- **BR-15:** Public Comments and Internal Notes are append-only (no edit or delete), 1–2000 characters after trimming, with author and time set by the backend. They are stored and shown as plain text.
- **BR-16:** Staff can view and download active attachments but cannot upload or remove them. Lab 2 attachment rules are unchanged.
- **BR-17:** Queue defaults to 10 tickets per page, ordered by IT Priority (high first) then oldest first. Invalid query values are rejected with `400`.

**Administrator**
- **BR-18:** A user has exactly one role. Email is trimmed, lower-cased, and unique. Name is 2–100 characters.
- **BR-19:** A created user or a user given a new initial password must change it at next login. The Administrator types the initial password (no email delivery); it is never shown again.
- **BR-20:** An Administrator cannot deactivate their own account. The last active Administrator cannot be deactivated or have their role changed.
- **BR-21:** Users are deactivated, never deleted. Their tickets, comments, and notes remain; a deactivated owner stays on the ticket until reassigned.

**General**
- **BR-22:** Errors use safe messages without stack traces, SQL, or secrets. Submit buttons are disabled while busy and entered values are kept on failure.
- **BR-23:** Lab 2 behaviour continues to work after migration.

## 6. UI Specification Summary

Details are in [`ui-spec.md`](ui-spec.md). New screens are Login, Change Password, Ticket Queue, Staff Ticket Detail, and User Management. The Requester Ticket Detail gains Public Comments and the "Problem Appears Resolved" action. The shell shows name and role with role-specific navigation (Requester: My Tickets, Create Ticket; IT Staff: Ticket Queue; Administrator: Ticket Queue, User Management). Screens are usable on Desktop, Tablet, and Mobile and use the Zen Green design.

## 7. Data Changes

**User** (replaces `RequesterUser`): `id`, `name`, `email` (unique), `passwordHash`, `role` (`REQUESTER | IT_STAFF | ADMIN`), `isActive`, `mustChangePassword`, `createdAt`, `updatedAt`.

**Ticket** adds: `ownerId` (optional FK to User), `itPriority` (same values as Requested Priority), `requesterMarkedResolved` (boolean), and the full status enum. `requesterId` now references `User`.

**TicketComment** (Public) and **TicketInternalNote**: `id`, `ticketId` (cascade), `authorId` (FK to User), `body`, `createdAt`. They are separate tables so private notes cannot be returned by a Requester query by accident.

Relationships: a User has many Tickets as requester and many as owner; a Ticket has many comments and many notes; each comment or note has one author. Categories, Related Systems, and Attachments are unchanged.

Indexes: `User.email` (unique); Ticket `(ownerId)`, `(currentStatus)`, `(itPriority)` for queue filters, plus the Lab 2 requester indexes; `(ticketId, createdAt)` on comments and notes.

**Migration from Lab 2:** rename `RequesterUser` to `User` so existing ticket ownership stays valid; add the new columns (existing users become `REQUESTER`, `mustChangePassword = true`, and a non-bcrypt placeholder hash that cannot log in); set `itPriority = requestedPriority` for existing tickets; create the comment and note tables. The seed then gives every placeholder user the documented initial password, so existing Requesters sign in and must change it. The client removes the selector and the old stored requester value.

**Seed data** (idempotent; existing passwords are never overwritten). Local development only, initial password `ChangeMe123` for all accounts, documented in the README. Accounts marked "ready" skip the forced password change so tests can log in directly.

| Role | Accounts |
|---|---|
| Requester | Jennifer Anderson (ready), Michael Brown, Sarah Johnson, David Lee; inactive: Alex Ford |
| IT Staff | Priya Nair (ready), Marcus Chen, Elena Rossi; inactive: Tom Baker |
| Administrator | Admin User (ready) |

(Emails are `firstname.lastname@example.com`, and `admin@example.com`.) Also seeded: Lab 2 categories and systems, about 12 tickets spread across Requesters, statuses, priorities, and assigned/unassigned owners, and a few harmless sample Public Comments and Internal Notes.

## 8. API Contract Summary

Session-cookie authentication under `/api`; full details in [`api-spec.md`](api-spec.md).

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password` |
| Requester tickets | Lab 2 `/tickets` and attachment endpoints, now session-scoped; `POST /tickets/:id/appears-resolved` |
| Comments and notes | `GET/POST /tickets/:id/comments`, `GET/POST /tickets/:id/internal-notes` |
| Staff | `GET /staff/tickets`, `GET /staff/tickets/:id`, `PATCH /staff/tickets/:id` (owner, IT Priority), `POST /staff/tickets/:id/status`, `GET /staff/assignees` |
| Admin | `GET/POST /admin/users`, `PATCH /admin/users/:id`, `POST /admin/users/:id/initial-password` |

## 9. Acceptance Criteria

- **AC-01:** Given an active user with valid credentials, when the user logs in, then the backend establishes a session and returns the user's id, name, email, role, and password-change flag, and no response ever contains a password or hash.
- **AC-02:** Given a wrong password, unknown email, or inactive account, when login is attempted, then no session is created; wrong password and unknown email give the same generic error, and an inactive account with the correct password gets an "account inactive" response.
- **AC-03:** Given a user who must change the initial password, when login succeeds, then all endpoints except current user, change password, and logout return `403` and the UI shows only the Change Password screen until a valid new password is saved.
- **AC-04:** Given the Change Password form, when the current password is wrong, the new password breaks the policy or equals the current one, or the confirmation differs, then it is rejected with field messages; otherwise the password is saved and the user continues into the application.
- **AC-05:** Given a logged-out user, a deactivated user, or no session, when a protected endpoint is called, then `401` is returned.
- **AC-06:** Given an authenticated Requester who supplies another `requesterId`, when creating or listing tickets, then the backend uses the authenticated identity and returns only that Requester's data.
- **AC-07:** Given Requester B, when requesting Requester A's ticket, attachment, or comments, then `404` is returned and no data is exposed.
- **AC-08:** Given a logged-in Requester, when using Create Ticket, My Tickets, Ticket Detail, and attachments, then all Lab 2 behaviour works and no selector exists.
- **AC-09:** Given each role, when the app loads, then only permitted navigation is shown, and a role calling a forbidden endpoint directly (for example Requester to `/staff/*`, Requester to internal notes, IT Staff to `/admin/*`) receives `403`.
- **AC-10:** Given IT Staff, when using the queue with search, filters, sorting, and pagination, then results match the criteria and invalid query values return `400`.
- **AC-11:** Given the queue, when it is loading, empty, has no matches, is forbidden, or fails, then the matching state is shown, with a table on wider screens and cards on mobile.
- **AC-12:** Given a ticket, when IT Staff opens it, then ticket information, owner, priorities, status, and attachments (download only) are shown; an unassigned ticket can be claimed, any ticket can be reassigned or unassigned, and assignment rejects inactive users, Requesters, and unknown users.
- **AC-13:** Given a new ticket, then IT Priority equals Requested Priority; IT Staff can change IT Priority without changing Requested Priority; a Requester cannot.
- **AC-14:** Given a status change, then permitted transitions succeed, other transitions return `409`, a missing Owner returns `409` (except Cancelled), Resolved/Closed/Cancelled require confirmation, and a Requester cannot change status.
- **AC-15:** Given a Public Comment from a Requester (own ticket) or IT Staff, then it is saved append-only with backend author and time, visible to the Requester, IT Staff, and Administrator; empty or over-long text is rejected.
- **AC-16:** Given Internal Notes, when IT Staff or an Administrator posts or reads them, then they work and look different from Public Comments; when a Requester asks, then `403` is returned with no note content.
- **AC-17:** Given a ticket that is not Resolved, Closed, or Cancelled, when the Requester marks it "Problem Appears Resolved", then the flag is saved, status is unchanged, and staff see the indicator.
- **AC-18:** Given an Administrator, when opening User Management, then users show Name, Email, Role, Status, and Edit, and name/email search and the role filter work.
- **AC-19:** Given valid input, when an Administrator creates or edits a user or sets a new initial password, then the change is saved and the user must change the initial password at next login; invalid fields, invalid roles, and duplicate emails are rejected.
- **AC-20:** Given the safety rules, when an Administrator deactivates their own account, or deactivates or demotes the last active Administrator, then `409` is returned.
- **AC-21:** Given an IT Staff or Requester user, when user management is attempted by API or UI, then it is forbidden and the navigation entry is absent.
- **AC-22:** Given the Lab 2 database, when the migration and seed run (repeatedly), then tickets, attachments, categories, and ownership are preserved, existing Requesters can log in with the documented initial password and must change it, and no duplicates appear.
- **AC-23:** Given an API, network, validation, or conflict failure, when a screen action fails, then safe feedback is shown, the submit button is disabled while busy, and entered values are kept.
- **AC-24:** Given Desktop, Tablet, and Mobile viewports, then all new screens are usable without horizontal page scroll, use Zen Green styling and badges consistently, and have labelled controls with visible focus.

## 10. Definition of Done

- [ ] FR-01 to FR-16 are implemented and nothing from the excluded scope is added.
- [ ] Migration and idempotent seed run on a fresh database and on a Lab 2 database; Lab 2 data is preserved.
- [ ] Passwords are hashed; no password, hash, or secret appears in responses, logs, or the repository; `.env.example` has no real secret.
- [ ] Every endpoint enforces login, role, ownership, and the password-change requirement on the backend, verified by direct API tests.
- [ ] The Development Requester selector, `requesterId` parameters, and `/api/development-requesters` are removed.
- [ ] Every AC maps to a passing test in `tests.md`; unit, API, UI, security, migration/regression, and E2E tests pass with none skipped, including updated Lab 2 tests.
- [ ] Implementation follows `ui-spec.md` and `api-spec.md`; screenshots are saved under `artifacts/lab-03/screenshots/`.
- [ ] README lists setup, seed accounts, and the local initial password; `.gitignore` excludes `.env` and uploads.
- [ ] `reviewer.md` and `ai-use.md` are completed; Issues are Done; work is merged feature → `lab3-staging` → `main` through reviewed PRs.

## 11. Assumptions and Decisions

1. **Session cookie instead of JWT:** `express-session` is already a project dependency and supports real logout. The in-memory session store is acceptable for the local lab (sessions reset when the server restarts). CSRF is limited by SameSite=Lax and the restricted CORS origin.
2. **Administrator and tickets:** see the note under 5.1.
3. **No lockout or rate limiting:** account unlocking is out of scope, so brute-force protection is left as a known gap.
4. **Initial password:** typed by the Administrator, with `ChangeMe123` as the documented local default for seeded and migrated users.
5. **Text limits:** comments and notes 1–2000 characters; ticket text limits unchanged from Lab 2.
6. **Reusing priorities:** IT Priority uses Low, Medium, High like Requested Priority.
7. **Shared queue:** every IT Staff user sees all tickets.
8. **Client session restore:** the client calls `GET /api/auth/me` on load; a `401` shows Login.
