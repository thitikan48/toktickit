# Lab 3 Sprint Engineering Specification

> Extends `docs/lab-02/specification.md`. Companion contracts: [`ui-spec.md`](ui-spec.md), [`api-spec.md`](api-spec.md), [`tests.md`](tests.md).

## 1. Sprint Goal

Replace the temporary Development Requester selector with real email/password authentication and server-enforced role-based authorization for three roles (Requester, IT Staff, Administrator). Deliver the first operational IT Staff workflow (shared Ticket Queue, Ticket Detail, ownership, IT Priority, status workflow, Public Comments, Internal Notes) and a minimalist Administrator User Management screen, while every Lab 2 Requester function keeps working under the authenticated identity.

## 2. Stakeholder Request Interpretation

The stakeholder needs real users instead of a development switch. Sign-in must be secure, and anyone holding an initial password must set their own before using the system. Requesters keep the Lab 2 experience but now act as themselves, and can talk to IT through Public Comments and say "this looks fixed". IT Staff need a professional queue and a Ticket screen to take ownership, prioritise, progress, and discuss tickets, with a private channel (Internal Notes) the Requester can never see. Administrators need one simple screen to manage accounts. Hiding a button is not security: every rule is enforced by the backend.

## 3. Scope

### 3.1 Included

- Login, logout, current-user retrieval, mandatory first-login Change Password.
- Server-side authentication, role authorization, and ownership checks on every API.
- Migration of `RequesterUser` into a real `User` model, with initial passwords for existing Requesters and removal of the selector.
- Requester regression (Lab 2 tickets and attachments) plus Public Comments and "Problem Appears Resolved".
- IT Staff Ticket Queue (search, filters, sort, pagination), Ticket Detail, claim/assign/reassign, IT Priority, status workflow, Public Comments, Internal Notes.
- Administrator User Management: list, search by name/email, role filter, create, edit (name, email, role, active), set new initial password, safety rules.
- Zen Green extensions: shell with user/role, role navigation, badges, new screens.

### 3.2 Explicitly Excluded

- Email invitations, password-reset email, MFA, social login, SSO; self-registration and Requester-created accounts.
- Actions Taken (and the rule that blocks resolution until they are complete; deferred to Lab 4).
- SLA calculation, escalation, notification services; dashboards/KPIs beyond simple queue counts.
- Multi-tenant organisations, departments, customer administration; production deployment/cloud changes.
- Multiple roles per user; user deletion, bulk operations, import/export, account-history screens; extended profiles (department, organisation, photo).
- Account unlocking, approval workflows, advanced identity management; mandatory user-list pagination, multi-column sort, multiple simultaneous filters.
- Editing or deleting Public Comments / Internal Notes; staff modification of Attachments.
- Login rate limiting / lockout (see D-06).

## 4. Functional Requirements

### Authentication
- **FR-01:** A user shall log in with email and password; success establishes a server-side session and returns the user's id, name, email, role, and `mustChangePassword`.
- **FR-02:** Failed login shall return one generic error that does not reveal whether the email exists; an inactive account with correct credentials shall receive a clear "account inactive" response and no session.
- **FR-03:** A user with `mustChangePassword = true` shall be limited to Change Password, current-user, and logout until a valid new password is saved.
- **FR-04:** An authenticated user shall change their password by supplying the current password, a new password, and a matching confirmation (client) that satisfies the password policy.
- **FR-05:** The system shall provide logout that invalidates the server session, and a current-user endpoint used to restore the session on page load.
- **FR-06:** The application shell shall show the authenticated user's name and role, a Logout action, and role-specific navigation; the Development Requester selector and `Change Requester` action are removed.

### Authorization and Requester regression
- **FR-07:** Every endpoint except login shall require authentication (`401`) and enforce the authorization matrix (`403`) on the backend.
- **FR-08:** Requester endpoints shall derive ownership from the session; a client-supplied `requesterId` is ignored.
- **FR-09:** A Requester shall retain all Lab 2 capabilities (create ticket, My Tickets search/filter/sort/pagination, Ticket Detail, attachment upload/download/soft-removal) for owned tickets only.
- **FR-10:** A Requester shall post Public Comments on an owned ticket and view the Public Comment thread.
- **FR-11:** A Requester shall mark an owned ticket "Problem Appears Resolved" without changing its status.

### IT Staff operations
- **FR-12:** IT Staff and Administrators shall retrieve a shared Ticket Queue (all tickets) with search, filters, sorting, pagination, and simple counts.
- **FR-13:** They shall open a Ticket Detail showing ticket data, requester, owner, priorities, status, attachments, Public Comments, and Internal Notes.
- **FR-14:** They shall claim an unassigned ticket, and assign, reassign, or unassign any ticket to an active IT Staff/Administrator user.
- **FR-15:** They shall set IT Priority (Low/Medium/High); Requested Priority stays unchanged.
- **FR-16:** They shall change status only through the permitted transition matrix (BR-16), with confirmation for Resolved, Closed, Cancelled.
- **FR-17:** They shall post Public Comments and Internal Notes; both are append-only and display author and backend timestamp.
- **FR-18:** They shall view and download active attachments of any ticket but not add or remove them.

### Administrator user management
- **FR-19:** An Administrator shall list users (Name, Email, Role, Status), search by name or email, and optionally filter by role.
- **FR-20:** An Administrator shall create a user (name, email, one role, active state, initial password).
- **FR-21:** An Administrator shall edit name, email, role, and active state.
- **FR-22:** An Administrator shall set a new initial password that must be changed at next login.
- **FR-23:** The backend shall prevent duplicate emails, invalid roles, self-deactivation, and loss of the last active Administrator; users are deactivated, never deleted.

### Cross-cutting
- **FR-24:** All new screens shall provide loading, saving, success, validation, empty, no-results, forbidden, not-found, conflict, and safe failure feedback where meaningful.
- **FR-25:** Lab 2 data (categories, related systems, tickets, attachments) shall remain valid after migration, and the seed shall be idempotent.

## 5. Business Rules

### 5.1 Authentication, passwords, sessions
- **BR-01:** Only an active user with valid credentials may authenticate.
- **BR-02:** A user marked as requiring a password change cannot enter the normal application until a new valid password is saved. The gate is evaluated from the database on every request.
- **BR-03:** The authenticated user identity, not a `requesterId` supplied by the client, determines ownership of Requester operations.
- **BR-06:** Wrong password and unknown email return the same `401 INVALID_CREDENTIALS` with comparable timing (dummy hash comparison for unknown email). An inactive user with the correct password gets `403 ACCOUNT_INACTIVE`; with a wrong password gets the generic `401`. Lab 3 has no lockout and no rate limiting.
- **BR-07:** Passwords are hashed with bcrypt (cost 12) and are never stored, logged, or returned in plaintext. Policy: 8–72 characters, at least one letter and one digit, and the new password must differ from the current one. Whitespace is not trimmed.
- **BR-08:** Sessions use an HttpOnly, `SameSite=Lax` cookie (`Secure` in production) with a 30-minute rolling idle expiry; the session id is regenerated at login. Each request reloads the user from the database, so deactivation or role change takes effect immediately.
- **BR-09:** Logout destroys the server session and clears the cookie; later requests with that cookie return `401`.
- **BR-12:** The current-user response contains only `id`, `name`, `email`, `role`, `mustChangePassword`.

### 5.2 Roles and authorization
- **BR-10:** Each user has exactly one role: `REQUESTER`, `IT_STAFF`, or `ADMIN`. Authorization follows the matrix in section 5.3 and is enforced server-side; UI hiding is feedback only.
- **BR-11:** Unauthenticated → `401`; authenticated but role-forbidden → `403`; invalid input → `400`; missing **or not visible to the caller** → `404`; state conflict → `409`; unexpected → `500` with a generic message. A Requester asking for another Requester's ticket or attachment receives the same `404` as for a non-existent one (this intentionally replaces the Lab 2 `403`).
- **BR-04:** Public Comments are visible to the Requester (owner), IT Staff, and Administrator. Internal Notes are visible only to IT Staff and Administrator and never appear in any Requester-facing payload.
- **BR-05:** A Requester may indicate the problem appears resolved but cannot set Resolved or Closed.

### 5.3 Authorization matrix

| Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| Login, logout, current user, change own password | Yes | Yes | Yes |
| Read categories / related systems | Yes | Yes | Yes |
| Create ticket; list/view own tickets | Own only | No (use queue) | No (use queue) |
| Attachment upload / soft-remove | Own tickets only | No | No |
| Attachment list / download (active) | Own tickets only | Any ticket | Any ticket |
| Ticket Queue, staff Ticket Detail | No | Yes | Yes |
| Claim / assign / reassign owner | No | Yes | Yes |
| Set IT Priority; change status | No | Yes | Yes |
| Public Comment: post / read | Own tickets | Any ticket | Any ticket |
| "Problem Appears Resolved" | Own tickets | No | No |
| Internal Notes: post / read | No (`403`) | Yes | Yes |
| List assignable staff | No | Yes | Yes |
| User Management (`/api/admin/*`) | No | No | Yes |

Administrator is explicitly permitted the IT Staff ticket operations (needed for BR-04 and Ticket Owner eligibility), but IT Staff never receive user-management rights; account management stays Administrator-only.

### 5.4 Ownership, priority, status
- **BR-13:** A Ticket has zero or one primary Owner; the Owner must be an active IT Staff or Administrator at assignment time. Existing assignments are kept if the owner is later deactivated or changes role; the owner is shown with an "inactive" marker and the ticket can be reassigned.
- **BR-14:** Claim sets the caller as Owner only when the ticket is unassigned (else `409 ALREADY_OWNED`). Assign/reassign/unassign (`ownerId` = user id or `null`) may be done by any IT Staff/Administrator.
- **BR-15:** IT Priority is copied from Requested Priority at creation and is changed only by IT Staff/Administrator. Requested Priority is immutable.
- **BR-16:** Statuses: `NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED`. Allowed transitions (IT Staff/Administrator only):

| From | Allowed To |
|---|---|
| NEW | OPEN, IN_PROGRESS, CANCELLED |
| OPEN | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| IN_PROGRESS | OPEN, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| WAITING_FOR_REQUESTER | OPEN, IN_PROGRESS, RESOLVED, CANCELLED |
| RESOLVED | CLOSED, REOPENED |
| CLOSED | REOPENED |
| REOPENED | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| CANCELLED | (terminal) |

  Any other change, or a change to the same status, returns `409 INVALID_TRANSITION`.
- **BR-17:** Every transition except to `CANCELLED` requires the ticket to have an Owner (`409 OWNER_REQUIRED`).
- **BR-18:** Transitions to `RESOLVED`, `CLOSED`, `CANCELLED` require explicit confirmation (UI dialog; API `confirm: true`, else `400`).
- **BR-19:** "Problem Appears Resolved" is allowed only in `OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED` (else `409`), records time, is idempotent, does not alter status, and is cleared when status becomes `REOPENED`. Staff see an indicator.
- **BR-25:** Owner, priority, status, comment, and note changes update the ticket's `updatedAt` ("Last Updated").

### 5.5 Comments and notes
- **BR-20:** Public Comments are append-only (no edit/delete), 1–2000 characters after trimming, author and timestamp set by the backend. A Requester may comment only on an owned ticket that is not `CLOSED` or `CANCELLED`; staff/administrators may comment on any ticket.
- **BR-21:** Internal Notes follow the same length and append-only rules, are created/read only by IT Staff/Administrator; a Requester call is rejected with `403` and no note data.
- **BR-22:** Content is stored as plain text and rendered as text (never as HTML), preserving line breaks; lists are ordered oldest first.

### 5.6 Attachments and queue
- **BR-23:** Lab 2 attachment rules (types, 5 MB, max 5 active, soft-removal with reason, `410` for removed) are unchanged. Only the owning Requester uploads/removes; staff and administrators may list and download active files.
- **BR-24:** Queue defaults: `page=1`, `pageSize=10` (allowed 10, 25, 50), order IT Priority high→low then oldest first. Unknown/invalid query values return `400 VALIDATION_ERROR`; they are never silently ignored.

### 5.7 Administrator
- **BR-26:** A created user has exactly one role, an active state, and `mustChangePassword = true`.
- **BR-27:** Email is trimmed, lower-cased, ≤254 characters, valid format, and unique (`409 EMAIL_TAKEN`); name is trimmed 2–100 characters.
- **BR-28:** `role` outside the three values is rejected (`400`).
- **BR-29:** Setting a new initial password stores a new hash and sets `mustChangePassword = true`; the old password stops working.
- **BR-30:** An Administrator cannot deactivate their own account (`409 CANNOT_DEACTIVATE_SELF`).
- **BR-31:** The last active Administrator cannot be deactivated or have their role changed (`409 LAST_ADMIN_REQUIRED`).
- **BR-32:** Users are never deleted; deactivation blocks login and invalidates active sessions on the next request while keeping tickets, comments, and notes.
- **BR-33:** Administrator responses never include a password or hash, and an initial password typed by the Administrator is not echoed back or shown again.
- **BR-34:** User list is ordered by name, searches name/email (case-insensitive partial), supports one optional role filter, and is not paginated.

### 5.8 Failures and regression
- **BR-35:** Errors use the standard envelope with generic messages (no stack traces, SQL, file paths, or secrets). Submit actions are disabled while busy; entered form values are preserved on failure.
- **BR-36:** All Lab 2 behaviour is preserved, except removal of the selector, `requesterId` parameters, `GET /api/development-requesters`, the `sessionStorage` requester key (cleared on first load), and the `403`→`404` change in BR-11.

## 6. UI Specification Summary

Full detail in [`ui-spec.md`](ui-spec.md).

- **Shell:** Primary Green header; brand; role-specific nav (Requester: My Tickets, Create Ticket; IT Staff: Ticket Queue; Administrator: Ticket Queue, User Management); user name + role badge; Logout and Change Password.
- **Login** and **Change Password** screens (centered cards, busy/validation/failure states; inactive-account message).
- **Requester screens:** Lab 2 screens, selector removed; Ticket Detail adds Public Comments and "Problem Appears Resolved".
- **Ticket Queue:** toolbar (search, status, IT Priority, category, owner, sort), table on ≥768 px and cards below, pagination, counts, all states.
- **Staff Ticket Detail:** grouped read-only ticket data, editable Owner / IT Priority / Status panel, attachments, separate Public Comments and Internal Notes panels (visually distinct).
- **User Management:** list with search and role filter, create/edit dialog, set-initial-password dialog.
- Desktop ≥992 px, Tablet 768–991 px, Mobile <768 px; no horizontal page scroll.

## 7. Data Changes

### 7.1 Models

**User** (replaces `RequesterUser`; table renamed so existing ids are preserved)
- `id` Int PK; `name` String; `email` String unique (lower-case); `passwordHash` String; `role` enum `UserRole {REQUESTER, IT_STAFF, ADMIN}` default `REQUESTER`; `isActive` Boolean default true; `mustChangePassword` Boolean default true; `lastLoginAt` DateTime?; `createdAt`; `updatedAt`.

**Ticket** (additions)
- `requesterId` FK → `User.id` (unchanged column); `ownerId` Int? FK → `User.id` (users are never deleted); `itPriority` `RequestedPriority` NOT NULL (backfilled from `requestedPriority`); `requesterMarkedResolved` Boolean default false; `requesterMarkedResolvedAt` DateTime?; `currentStatus` enum `TicketStatus` extended with the eight values (default `NEW`).

**TicketComment** (Public Comment): `id`, `ticketId` FK (cascade), `authorId` FK → User, `body` Text, `createdAt`.
**TicketInternalNote**: same shape. Separate tables (not a visibility flag) so a Requester query can never accidentally join private data.

Unchanged: `Category`, `RelatedSystem`, `Attachment`.

### 7.2 Relationships
`User 1─N Ticket (requester)`; `User 1─N Ticket (owner, optional)`; `Ticket 1─N TicketComment`; `Ticket 1─N TicketInternalNote`; `User 1─N TicketComment / TicketInternalNote (author)`; Category/RelatedSystem/Attachment relations as in Lab 2.

### 7.3 Indexes
- `User(email)` unique; `User(role, isActive)`.
- Ticket (existing) `(requesterId, createdAt)`, `(requesterId, currentStatus)`, `(requesterId, categoryId)`; new `(currentStatus, updatedAt)`, `(ownerId, currentStatus)`, `(itPriority, createdAt)` for queue filters/default ordering.
- `TicketComment(ticketId, createdAt)`, `TicketInternalNote(ticketId, createdAt)`.

### 7.4 Migration from Lab 2 (no data loss)
1. Prisma migration renames `RequesterUser` → `User` (`ALTER TABLE ... RENAME`) so every existing `Ticket.requesterId` stays valid.
2. Adds `role` (default `REQUESTER`), `passwordHash`, `mustChangePassword`, `lastLoginAt`; existing rows get `passwordHash = '!'` (a non-bcrypt value that can never verify) and `mustChangePassword = true`.
3. Adds `Ticket.ownerId` (null), `itPriority` (`UPDATE ... SET itPriority = requestedPriority`, then NOT NULL), requester-resolved fields; extends the status enum; creates comment and note tables.
4. `npm run prisma:seed` (idempotent) gives every user still holding `'!'` a bcrypt hash of the local-lab initial password, so existing Requesters sign in with the documented initial password and must change it at first login. Until then those accounts cannot log in.
5. Client: selector component and API call removed; the Lab 2 `sessionStorage` requester key is deleted on load.
6. Regression evidence: Lab 2 server/client/E2E suites updated for authentication and the `404` rule, and re-run (AC-10, AC-28).

### 7.5 Seed Data (idempotent `upsert`; existing passwords are never overwritten)

Local development only. Initial password for every seeded account: **`ChangeMe123`** (override with `SEED_INITIAL_PASSWORD`); no real secrets are stored in the repository. Accounts marked "ready" are seeded with `mustChangePassword = false` so tests/demos can skip first login; "first login" accounts must change the password.

| Role | Name | Email | Active | State |
|---|---|---|---|---|
| Requester | Jennifer Anderson | jennifer.anderson@example.com | Yes | ready |
| Requester | Michael Brown | michael.brown@example.com | Yes | first login |
| Requester | Sarah Johnson | sarah.johnson@example.com | Yes | first login |
| Requester | David Lee | david.lee@example.com | Yes | first login |
| Requester | Alex Ford | alex.ford@example.com | **No** | first login |
| IT Staff | Priya Nair | priya.nair@example.com | Yes | ready |
| IT Staff | Marcus Chen | marcus.chen@example.com | Yes | first login |
| IT Staff | Elena Rossi | elena.rossi@example.com | Yes | ready |
| IT Staff | Tom Baker | tom.baker@example.com | **No** | first login |
| Administrator | Admin User | admin@example.com | Yes | ready |

Also seeded: the Lab 2 categories and related systems; at least 12 tickets spread over all Requesters, all eight statuses, all priorities (some with differing IT Priority), assigned and unassigned; several Public Comments and Internal Notes with non-sensitive content (e.g. "Checked VPN profile, waiting for reboot").

## 8. API Contract Summary

Base path `/api`; session cookie authentication; JSON envelope errors. Full contract in [`api-spec.md`](api-spec.md).

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password` |
| Reference | `GET /categories`, `GET /related-systems` (authenticated) |
| Requester tickets (Lab 2, session-scoped) | `POST/GET /tickets`, `GET /tickets/:id`, attachments list/upload/download/delete |
| Comments | `GET/POST /tickets/:id/comments`, `POST /tickets/:id/appears-resolved` |
| Internal notes | `GET/POST /tickets/:id/internal-notes` (staff/admin) |
| Staff | `GET /staff/tickets`, `GET /staff/tickets/:id`, `POST …/claim`, `PATCH …/owner`, `PATCH …/it-priority`, `POST …/status`, `GET /staff/assignees` |
| Admin | `GET/POST /admin/users`, `PATCH /admin/users/:id`, `POST /admin/users/:id/initial-password` |

## 9. Acceptance Criteria

- **AC-01:** Given an active user with valid credentials, when the user logs in, then the backend establishes an authenticated session and returns the permitted user identity and role.
- **AC-02:** Given a wrong password or unknown email, when login is attempted, then the same generic `401` is returned, no session is created, and nothing reveals whether the account exists.
- **AC-03:** Given an inactive user with the correct password, when login is attempted, then `403 ACCOUNT_INACTIVE` is returned and no session is created.
- **AC-04:** Given a user who must change the initial password, when login succeeds, then every endpoint other than current-user, change-password, and logout returns `403 PASSWORD_CHANGE_REQUIRED` and the UI shows only the Change Password screen until a valid new password is saved.
- **AC-05:** Given the Change Password form, when a valid new password is saved, then `mustChangePassword` is cleared and the user continues into the application; when the current password is wrong, the new password breaks the policy, equals the current one, or the confirmation differs, then it is rejected with field-level feedback.
- **AC-06:** Given a logged-in user, when the user logs out, then the session no longer authenticates; unauthenticated requests to protected endpoints return `401`; a session of a user deactivated afterwards is rejected on the next request.
- **AC-07:** Given any stored account, then its password is a bcrypt hash and no API response ever contains a password or hash.
- **AC-08:** Given an authenticated Requester who supplies another `requesterId`, when creating or listing tickets, then the backend uses the authenticated identity and returns only that Requester's data.
- **AC-09:** Given Requester B, when requesting Requester A's ticket, attachment, or comments, then the response is `404` and no data is exposed.
- **AC-10:** Given a logged-in Requester, when using Create Ticket, My Tickets (search/filter/sort/pagination), Ticket Detail, and the attachment lifecycle, then all Lab 2 behaviour works and no selector or `Change Requester` action exists.
- **AC-11:** Given each role, when the app loads, then only permitted navigation is shown, and opening an unauthorized screen shows a forbidden state instead of data.
- **AC-12:** Given a role not permitted by the matrix, when it calls a protected endpoint directly (e.g. Requester → `/staff/*`, `/admin/*`, internal notes; IT Staff → `/admin/*`), then the backend returns `403`.
- **AC-13:** Given IT Staff, when using the queue with search, status/IT Priority/category/owner filters, sort, and pagination, then results match the criteria and metadata is returned; invalid query values return `400`.
- **AC-14:** Given the queue, when loading, empty, no-results, forbidden, or failure conditions occur, then the matching state is shown, with a table on ≥768 px and cards on smaller screens.
- **AC-15:** Given IT Staff opens a ticket, then full ticket information, owner, priorities, status, and attachments (view/download only) are displayed.
- **AC-16:** Given an unassigned ticket, when IT Staff claims it, then they become Owner; claiming an owned ticket returns `409`; reassign/unassign works for active IT Staff/Administrator targets and rejects inactive users, Requesters, and unknown ids.
- **AC-17:** Given a new ticket, then IT Priority equals Requested Priority; IT Staff can change IT Priority without altering Requested Priority; a Requester cannot change it.
- **AC-18:** Given a status change, then permitted transitions succeed, others return `409 INVALID_TRANSITION`, unowned tickets return `409 OWNER_REQUIRED` (except to Cancelled), Resolved/Closed/Cancelled require confirmation, and a Requester cannot change status.
- **AC-19:** Given a Public Comment, when a Requester (own ticket) or IT Staff posts it, then it is saved append-only with backend author/time and shown to Requester, IT Staff, and Administrator; blank or >2000-character content is rejected; a Requester cannot comment on Closed/Cancelled tickets.
- **AC-20:** Given an Internal Note, when IT Staff/Administrator posts or reads it, then it works and is visually distinct from Public Comments; when a Requester requests it, then `403` and no note content is returned, and no Requester payload contains notes.
- **AC-21:** Given a ticket in an eligible status, when the Requester selects "Problem Appears Resolved", then the flag is recorded, status is unchanged, staff see the indicator, and the Requester can never set Resolved/Closed.
- **AC-22:** Given an Administrator, when opening User Management, then users show Name, Email, Role, Status, Edit; name/email search and the role filter work.
- **AC-23:** Given valid input, when an Administrator creates a user, then the user is stored with one role, hashed initial password, and `mustChangePassword = true`; invalid fields are rejected and a duplicate email returns `409`.
- **AC-24:** Given an existing user, when an Administrator edits name, email, role, or active state, then changes persist; invalid role or duplicate email is rejected.
- **AC-25:** Given an Administrator sets a new initial password, then the user must use it and change it at the next login, and the previous password no longer works.
- **AC-26:** Given Administrator safety rules, then self-deactivation and deactivating or demoting the last active Administrator are rejected with `409`.
- **AC-27:** Given an IT Staff or Requester account, when attempting user management through the API or UI, then it is forbidden and the navigation entry is absent.
- **AC-28:** Given the Lab 2 database, when the migration and seed run (repeatedly), then all tickets, attachments, categories, systems, and ownership are preserved, existing Requesters can log in with the documented initial password and must change it, and no duplicates are created.
- **AC-29:** Given API, network, validation, conflict, or server failure, when a screen action fails, then safe feedback is shown, submit is disabled while busy, and entered values are preserved.
- **AC-30:** Given Desktop (≥992 px), Tablet (768–991 px), and Mobile (<768 px), then all new screens are usable with no horizontal page scroll or clipping, with labelled controls, visible focus, and text-based state indicators.
- **AC-31:** Given the new screens, then they reuse Zen Green tokens and components, with consistent badges for status, Requested/IT Priority, and role, and clear editable vs read-only styling.

## 10. Definition of Done

- [ ] FR-01 to FR-25 implemented; no excluded scope introduced.
- [ ] Prisma migration and idempotent seed run cleanly on a fresh database and on a Lab 2 database; Lab 2 data preserved.
- [ ] Passwords hashed (bcrypt cost 12); no password/hash in any response, log, or repository file; session secret read from environment, `.env.example` provided without a real secret.
- [ ] Every endpoint enforces authentication, the authorization matrix, ownership, and `mustChangePassword` on the backend, verified by direct API tests.
- [ ] Development Requester selector, `requesterId` parameters, and `/api/development-requesters` removed.
- [ ] Every AC-01 to AC-31 maps to at least one passing automated test or documented visual check in `tests.md`; all unit, API, UI component, UI style, security, migration/regression, and E2E tests pass with none skipped; Lab 2 tests updated and passing.
- [ ] Implementation complies with `ui-spec.md` and `api-spec.md`; screenshots at 1440×900, 768×1024, 375×812 stored under `artifacts/lab-03/screenshots/{authentication,staff-queue,staff-ticket-detail,user-management}/`.
- [ ] README documents setup, migration, seed accounts, and the local-lab initial password; `.gitignore` excludes `.env` and `server/uploads`.
- [ ] `reviewer.md` and `ai-use.md` completed; Issues in Done; work merged `feature/*` → `lab3-staging` → `main` via reviewed PRs, with specification committed before implementation PRs.

## 11. Assumptions and Decisions

- **D-01 Session cookies over JWT:** `express-session` (already a dependency) with HttpOnly cookie is simple for the course stack, keeps secrets server-side, and allows real logout invalidation. Store: in-memory for the local lab (sessions reset on restart; acceptable and documented); a persistent store is a production concern.
- **D-02 CSRF:** `SameSite=Lax` cookie, CORS restricted to the client origin with credentials, and mutating requests must carry `X-Requested-With: TokTickIT` (and JSON or multipart body); otherwise `403 CSRF_REJECTED`.
- **D-03 Initial passwords (local-lab behaviour):** the Administrator types the initial password (no email delivery); it is never shown again or returned. Migrated/seeded accounts use the documented `ChangeMe123` local default.
- **D-04 Password policy:** 8–72 chars (bcrypt's 72-byte limit), one letter and one digit; deliberately modest and testable.
- **D-05 Administrator ticket operations:** permitted by matrix (section 5.3) so Administrators can be Ticket Owners and read Internal Notes; IT Staff cannot manage users.
- **D-06 No lockout/rate limit:** account unlocking is excluded, so lockout would create an unrecoverable state; brute-force protection is noted as a production gap.
- **D-07 `404` for invisible resources:** hides the existence of other Requesters' tickets, attachments, and notes (handout 6.2); this changes Lab 2's `403`.
- **D-08 Queue visibility:** all tickets are visible to every IT Staff user (shared queue); no per-owner restriction on operations.
- **D-09 Priority values:** IT Priority reuses `LOW/MEDIUM/HIGH`.
- **D-10 Limits:** name 2–100; email ≤254; comment/note 1–2000 characters; queue page size 10/25/50.
- **D-11 No Resolved gating:** Lab 3 does not block resolution on Actions Taken (deferred to Lab 4).
- **D-12 Page restoration:** the client calls `GET /api/auth/me` on load; a `401` shows Login.
