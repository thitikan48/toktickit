# Lab 4 Sprint Engineering Specification

## 1. Sprint Goal

This sprint completes the TokTickIT service desk workflow. IT Staff and Administrators record the work done on a Ticket as Actions Taken, and each action can be assigned to a staff member who is not the Ticket Owner. The backend enforces the final status rules, including a resolution gate and an append-only status history, and it detects stale updates. Requesters and IT Staff get short dashboards that link to the existing detail screens. Finally, I harden the whole application so that all Lab 1 to 3 features keep working under the Zen Green design.

## 2. Stakeholder Request Interpretation

The service desk can receive Tickets and talk to Requesters, but it cannot show what work was done. So each Ticket gets a list of Actions Taken. An action records when the work happened, what was done, the result, who performed it (set by the system), whether follow-up is needed, a follow-up note, and a note about which file or image to look at. The Ticket Owner still coordinates the Ticket, but other IT Staff can do the actions. When a Requester says the problem appears resolved, it is only a hint; IT Staff must review the work and change the status. Each role gets a short dashboard that links to the detailed screens. Everything from earlier labs must keep working.

## 3. Scope

### Included

Actions Taken (create, list, view, edit, assign, start, complete, cancel) for IT Staff and Administrators, read-only for the owning Requester; the final Ticket transition matrix with the resolution gate, `resolvedAt`, and an append-only status history; stale update detection on Ticket handling; Requester Dashboard and IT Staff Dashboard with drill-down; additive migration, recovery script, and seed data; a separate test database; regression tests for Labs 1 to 3; final hardening and Zen Green polish.

### Excluded

Excluded by the course: SLA clocks, escalation, on-call scheduling, and breach notifications; email, SMS, LINE, push, or other notifications; inventory, spare parts, purchasing, or cost accounting; time-sheet billing, payroll, or labour cost; multi-level approvals and electronic signatures; advanced BI tools, report builders, or export warehouses; multi-tenant organisations and production-scale cloud operations; any feature not approved here.

Also not included: deleting actions (Cancel is used instead), file upload on actions, Requester status changes, user account counts on the dashboard, and a URL router.

## 4. Functional Requirements

**Actions Taken**
- **FR-01:** IT Staff and Administrators can create an Action Taken on a Ticket with Action Date/Time, Action Description, Result, Follow-Up Required, Follow-up Note, and Attachment Notes.
- **FR-02:** An action is assigned to an active IT Staff member or Administrator, who may be different from the Ticket Owner.
- **FR-03:** Staff Ticket Detail shows the actions of a Ticket as a list in a stable order.
- **FR-04:** IT Staff and Administrators can view an action and edit an open action.
- **FR-05:** IT Staff and Administrators can start, complete, and cancel an action.
- **FR-06:** Performed By is set by the backend.
- **FR-07:** A Requester sees all Actions Taken on their own Tickets, read-only.

**Ticket Workflow**
- **FR-08:** IT Staff and Administrators change Ticket status only through the final transition matrix in section 5.4.
- **FR-09:** The backend rejects Resolved, and Resolved to Closed, while the Ticket has an open action, also for direct API calls.
- **FR-10:** Every status change is saved in an append-only history and shown as a Status Timeline.
- **FR-11:** "Problem Appears Resolved" from a Requester stays advisory and does not change the status.
- **FR-12:** The status control shows only allowed targets and refreshes the Ticket summary after a successful change.
- **FR-13:** Ticket handling detects stale updates, so one user does not overwrite another user's recent change without knowing.

**Dashboards**
- **FR-14:** A Requester sees a Requester Dashboard built only from their own Tickets.
- **FR-15:** IT Staff see an IT Staff Dashboard, and Administrators reuse it.
- **FR-16:** Every card, count row, and list row opens My Tickets, the Ticket Queue, or Ticket Detail with the right filters.
- **FR-17:** Every role has a Dashboard navigation item with a clear active page.
- **FR-18:** Dashboards show loading, empty, forbidden, and safe failure feedback.

**Data, Testing, and Hardening**
- **FR-19:** The migration keeps all earlier data, has a tested recovery script, and the seed adds Lab 4 demo data.
- **FR-20:** Lab 4 regression tests check the Labs 1 to 3 features with login.
- **FR-21:** Tests run on a separate test database.
- **FR-22:** Feedback states are consistent, repeated clicks do not create duplicates, and forms keep typed data after a recoverable failure.
- **FR-23:** Leftover UI from earlier labs, console errors, broken links, placeholder text, or unfinished controls are removed, and the README is current.
- **FR-24:** Lab 4 screens use the Zen Green design of Labs 2 and 3 and are responsive and accessible.
- **FR-25:** A performance smoke test checks the dashboard and action list endpoints.

## 5. Business Rules

### 5.1 Actions Taken Rules

| BR ID | Business Rule |
|---|---|
| BR-01 | Action Taken belongs to exactly one Ticket. |
| BR-02 | The Ticket Owner coordinates the Ticket, but an Action Taken may be by a different IT Staff member. |
| BR-03 | Action Date/Time and Action Description are required. Text is trimmed. Description, Result, and Follow-up Note are at most 1000 characters, and Attachment Notes at most 500 (`400` with `fields`). |
| BR-04 | Follow-up Note is required when Follow-Up Required is true. When it is false, the note is saved as empty. |
| BR-05 | Result and Attachment Notes are optional. Attachment Notes is plain text that names a file or image to look at; it is not an upload. |
| BR-06 | The assignee must be an active `IT_STAFF` or `ADMIN` user. It defaults to the creator. An inactive, Requester, or unknown user gets `409 CONFLICT`, the same as an invalid Ticket Owner in Lab 3. |
| BR-07 | Action statuses are Planned, In Progress, Completed, and Cancelled. A new action starts as Planned, In Progress, or Completed. Allowed changes: Planned to In Progress, Completed, or Cancelled; In Progress to Completed or Cancelled. Any other change gets `409 CONFLICT`. |
| BR-08 | Completed and Cancelled actions cannot be changed (`409 CONFLICT`). There is no delete; a cancelled action stays in the list. |
| BR-09 | The backend sets Performed By to the user who completes the action (or creates it as Completed). Before that it is empty. Creator and last updater also come from the session. Values sent by the client are ignored. |
| BR-10 | Actions are listed by Action Date/Time, oldest first, then by id. |
| BR-11 | Only IT Staff and Administrators create and update actions, on any Ticket. A Requester can only read the actions of their own Tickets; another Requester's Ticket gets `404`. |

### 5.2 Ticket Workflow and Stale Update Rules

| BR ID | Business Rule |
|---|---|
| BR-12 | The eight statuses and the Lab 3 transition pairs stay. An owner is needed for every change except Cancelled, and Resolved, Closed, and Cancelled need a confirmation. Only IT Staff and Administrators change status. |
| BR-13 | **Resolution gate.** Resolved, and Resolved to Closed, get `409 OPEN_ACTIONS_EXIST` while the Ticket has a Planned or In Progress action. A Ticket with zero actions can be resolved and closed. |
| BR-14 | Resolved sets `resolvedAt`. Closed keeps it. Reopened clears it. |
| BR-15 | Every successful status change writes one history row (from, to, changed by, changed at). Rejected changes write nothing. There is no edit or delete. IT Staff, Administrators, and the owning Requester can read it; another Requester gets `404`. |
| BR-16 | "Problem Appears Resolved" only sets the Lab 3 flag. It never changes the status. |
| BR-17 | A Ticket has a `version` that goes up by 1 on every successful owner or IT Priority update and status change. Other activity (comments, notes, attachments, actions) does not change it. |
| BR-18 | The owner or IT Priority update and the status change must send `expectedVersion` (missing: `400`). If it does not match, the backend returns `409 STALE_UPDATE` and saves nothing. |

### 5.3 Authorization Matrix

| Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| All Lab 3 operations | as Lab 3 | as Lab 3 | as Lab 3 |
| List and view actions | own Tickets, read-only | any Ticket | any Ticket |
| Create, edit, assign, start, complete, cancel action | no (`403`) | any Ticket | any Ticket |
| Delete action, edit or delete history | no endpoint | no endpoint | no endpoint |
| Be an action assignee | no | yes (active) | yes (active) |
| Change Ticket status | no (`403`) | yes | yes |
| View Status Timeline | own Tickets | any Ticket | any Ticket |
| Requester Dashboard | own data | `403` | `403` |
| IT Staff Dashboard | `403` | yes | yes (same dashboard) |

A call without a session gets `401`. Hiding a button is never the only protection; the backend checks every write.

### 5.4 Final Ticket Transition Matrix

Only IT Staff and Administrators make these changes. Every change sends `expectedVersion` and writes one history row.

| From | Allowed to | Lab 4 rule |
|---|---|---|
| New | Open, In Progress, Cancelled | |
| Open | In Progress, Waiting for Requester, Resolved, Cancelled | gate on Resolved |
| In Progress | Open, Waiting for Requester, Resolved, Cancelled | gate on Resolved |
| Waiting for Requester | Open, In Progress, Resolved, Cancelled | gate on Resolved |
| Resolved | Closed, Reopened | gate on Closed; Reopened clears `resolvedAt` |
| Closed | Reopened | Reopened clears `resolvedAt` |
| Reopened | In Progress, Waiting for Requester, Resolved, Cancelled | gate on Resolved |
| Cancelled | none | final |

Any other pair, and the same status, gets `409 CONFLICT`.

### 5.5 Dashboard Rules and Calculations

| BR ID | Business Rule |
|---|---|
| BR-19 | Active statuses are New, Open, In Progress, Waiting for Requester, and Reopened. "Recent" means the last 7 days up to now. Dates are shown in Asia/Bangkok time. Lists have at most 5 rows, newest first. |
| BR-20 | The Requester Dashboard only uses the session user's Tickets. A `requesterId` sent by the client is ignored. |
| BR-21 | Administrators get the same IT Staff Dashboard, with no user account counts. |
| BR-22 | Metrics are calculated by the backend from the database. The endpoints return counts and short lists only, not full Ticket collections. |
| BR-23 | No matching data gives `0` or an empty list, never an error. |
| BR-24 | A drill-down opens the target screen with the filters below, and its total equals the card value. The only new filter is `statusGroup=active` on My Tickets and the Ticket Queue. An invalid value gets `400`. |

**Requester Dashboard** (only Tickets where `requesterId` is me):

| Metric | Calculation | Empty | Drill-down |
|---|---|---|---|
| `openTickets` | count of Tickets with an active status | `0` | My Tickets `statusGroup=active` |
| `waitingForMe` | count of Tickets in Waiting for Requester | `0` | My Tickets `status=WAITING_FOR_REQUESTER` |
| `recentlyUpdated` | up to 5 Tickets with `updatedAt` in the last 7 days | "No tickets updated in the last 7 days." | row opens Ticket Detail |
| `recentlyResolved` | up to 5 Tickets with `resolvedAt` in the last 7 days | "No tickets resolved in the last 7 days." | row opens Ticket Detail |

**IT Staff Dashboard:**

| Metric | Calculation | Empty | Drill-down |
|---|---|---|---|
| `unassigned` | count of active Tickets with no owner | `0` | Ticket Queue `ownerId=unassigned&statusGroup=active` |
| `myOpenTickets` | count of active Tickets where the owner is me | `0` | Ticket Queue `ownerId=<my id>&statusGroup=active` |
| `myOpenActions` | count of Planned or In Progress actions assigned to me, plus `myOpenActionsList`, up to 5 of those actions (oldest Action Date/Time first) | `0`, "You have no open actions." | no page; each list row opens its Ticket |
| `countsByStatus` | count of Tickets per status, all 8 statuses | all `0` | Ticket Queue `status=<STATUS>` |
| `recentlyUpdated` | up to 5 Tickets with `updatedAt` in the last 7 days | "No tickets updated in the last 7 days." | row opens Ticket Detail; "View all" opens Ticket Queue `sort=updatedAt&direction=desc` |

### 5.6 Data, Testing, and General Rules

| BR ID | Business Rule |
|---|---|
| BR-25 | The migration is additive and keeps all earlier data. Legacy Tickets have zero actions (so the gate never blocks them), an empty timeline, `resolvedAt` null (so they are not in "recently resolved"), and `version` 0. |
| BR-26 | The seed is idempotent and adds Tickets with zero, one, and several actions, every action status, and zero and non-zero dashboard values. |
| BR-27 | Server and E2E tests use the `toktickit_test` database from `server/.env.test`, never the development database. |
| BR-28 | Errors use safe messages (`500 SERVER_ERROR` for unexpected errors). Submit buttons are disabled while saving, and typed values are kept after a failure. The client does not resend a POST or PATCH by itself after a network error; the user presses the button again, so no duplicate is created. |
| BR-29 | All approved Lab 1 to 3 behaviour keeps working, except the changes listed in section 11. |
| BR-30 | Every role has a Dashboard navigation item, and the Dashboard is the first screen after login. |

## 6. UI Specification Summary

Details are in [`ui-spec.md`](ui-spec.md). Navigation becomes Requester: Dashboard, My Tickets, Create Ticket; IT Staff: Dashboard, Ticket Queue; Administrator: Dashboard, Ticket Queue, User Management.

- **Requester Dashboard:** two count cards (Open tickets, Waiting for me) and two short lists (Recently updated, Recently resolved).
- **IT Staff Dashboard:** three count cards (Unassigned, My open tickets, My open actions), a Tickets by status block, a My open actions list, and a Recently updated list.
- **Staff Ticket Detail:** a new Actions Taken area with a list (table on desktop and tablet, cards on mobile), a create mode, and a view/edit mode; the existing status control with the gate message; a Status Timeline. Requester Ticket Detail shows the same list and timeline read-only.
- **Stale update:** a message that the Ticket was changed by someone else, the user's input kept, and a Reload button.
- **Design:** the Zen Green colours and components from Labs 2 and 3, the three viewports from Lab 2 (1440 × 900, 768 × 1024, 375 × 812), no horizontal scroll.

## 7. Data Changes

### 7.1 Models and fields

`enum ActionStatus { PLANNED IN_PROGRESS COMPLETED CANCELLED }`

| ActionTaken field | Type | Notes |
|---|---|---|
| `id`, `ticketId` | Int | primary key; FK to Ticket (BR-01) |
| `actionAt` | DateTime | Action Date/Time |
| `description` | VarChar(1000) | required |
| `result`, `followUpNote` | VarChar(1000)? | BR-04, BR-05 |
| `attachmentNotes` | VarChar(500)? | text only |
| `followUpRequired` | Boolean | default false |
| `status` | ActionStatus | BR-07 |
| `assignedToId`, `performedById` | Int, Int? | FK to User (BR-06, BR-09) |
| `createdById`, `updatedById`, `createdAt`, `updatedAt` | Int, DateTime | set by the backend |

`TicketStatusHistory` has `id`, `ticketId` (FK to Ticket), `fromStatus` and `toStatus` (TicketStatus), `changedById` (FK to User), and `changedAt` (default now).

New columns on `Ticket`: `resolvedAt` DateTime? (BR-14) and `version` Int default 0 (BR-17). Nothing is dropped or renamed.

A Ticket has many Actions Taken and many history rows. Both new tables cascade when a Ticket is deleted, like comments and notes. Indexes: `ActionTaken(ticketId, actionAt)` for the list order and the gate check; `ActionTaken(assignedToId, status)` for `myOpenActions`; `TicketStatusHistory(ticketId, changedAt)` for the timeline; `Ticket(resolvedAt)` for "recently resolved".

### 7.2 Design decisions

- **D-01 Version number for stale updates.** An integer `version` with a conditional update (`WHERE id = ? AND version = ?`) is simple and exact. Comparing `updatedAt` does not work, because comments also change it.
- **D-02 Separate history table.** One row per change is easy to query in order and stays append-only because there is no update or delete endpoint. A text log inside Ticket would be hard to query.
- **D-03 Separate ActionStatus enum.** Actions and Tickets have different statuses, so they need different enums.

### 7.3 Migration and recovery

- One additive Prisma migration creates the enum, the two tables, the two Ticket columns, and the indexes.
- Legacy Tickets follow BR-25. No old data is changed.
- Recovery: a down-SQL script removes only the Lab 4 objects and the migration row. A migration test runs it on the test database, checks that earlier data is still there, and applies the migration again.

### 7.4 Seed

The existing Lab 3 seed already has Tickets in every status, every priority, and both with and without an owner. The seed finds each action by Ticket Number and description and only creates missing ones. Seeded Completed actions have Performed By set to their assignee. The seed sets `resolvedAt` on TKT-2026-900013 when it is null, so the Requester Dashboard has one recently resolved Ticket.

| Ticket | Owner | Status | Seeded actions |
|---|---|---|---|
| TKT-2026-900001 | none | New | 0 |
| TKT-2026-900002 | Priya | Open | 1 Planned, assigned to Priya |
| TKT-2026-900003 | Marcus | In Progress | 3: Completed, In Progress (Marcus), Cancelled |
| TKT-2026-900004 | Elena | Waiting for Requester | 1 Completed with a follow-up note |
| TKT-2026-900006 | Priya | Resolved | 2: Completed, Cancelled |
| TKT-2026-900007 | Elena | In Progress | 1 Planned, assigned to Marcus (BR-02) |
| TKT-2026-900013 | Elena | Resolved | 1 Completed with Attachment Notes |
| others | as Lab 3 | as Lab 3 | 0 |

Expected values on a freshly seeded test database:

| Dashboard | Values |
|---|---|
| Jennifer | openTickets 3, waitingForMe 0, recentlyUpdated 4 rows, recentlyResolved 1 row (TKT-2026-900013) |
| David | openTickets 2, waitingForMe 0, recentlyUpdated 3 rows, recentlyResolved empty |
| Michael | openTickets 2, waitingForMe 1, recentlyUpdated 3 rows, recentlyResolved empty |
| IT Staff (shared) | unassigned 3; countsByStatus NEW 2, OPEN 3, IN_PROGRESS 2, WAITING_FOR_REQUESTER 1, RESOLVED 2, CLOSED 1, REOPENED 1, CANCELLED 1; recentlyUpdated 5 rows |
| Priya / Marcus / Elena / Admin | myOpenTickets 2 / 2 / 2 / 0; myOpenActions 1 / 2 / 0 / 0 |

TKT-2026-900005 is Open without an owner (Lab 3 data), so it counts as `unassigned`.

## 8. API Contract Summary

Same conventions as Lab 3: session cookie and `{ error: { code, message, fields? } }`. New `409` codes are `OPEN_ACTIONS_EXIST` and `STALE_UPDATE`. Full shapes are in [`api-spec.md`](api-spec.md).

| Method | Path | Roles | Purpose | Main statuses |
|---|---|---|---|---|
| GET, POST | `/api/staff/tickets/:id/actions` | IT_STAFF, ADMIN | list and create actions | GET 200, 401, 403, 404, 500; POST 201, 400, 401, 403, 404, 409, 500 |
| PATCH | `/api/staff/tickets/:id/actions/:actionId` | IT_STAFF, ADMIN | edit, assign, or change action status | 200, 400, 401, 403, 404, 409, 500 |
| GET | `/api/tickets/:id/actions` | REQUESTER (own) | read actions | 200, 401, 403, 404, 500 |
| GET | `/api/staff/tickets/:id/history`, `/api/tickets/:id/history` | staff; REQUESTER (own) | Status Timeline | 200, 401, 403, 404, 500 |
| GET | `/api/dashboard/requester` | REQUESTER | Requester Dashboard | 200, 401, 403, 500 |
| GET | `/api/staff/dashboard` | IT_STAFF, ADMIN | IT Staff Dashboard | 200, 401, 403, 500 |
| PATCH | `/api/staff/tickets/:id` | IT_STAFF, ADMIN | changed: needs `expectedVersion` | 200, 400, 401, 403, 404, 409, 500 |
| POST | `/api/staff/tickets/:id/status` | IT_STAFF, ADMIN | changed: `expectedVersion`, gate, `resolvedAt`, history row | 200, 400, 401, 403, 404, 409, 500 |
| GET | `/api/staff/tickets/:id`, `/api/tickets/:id` | as Lab 3 | changed: adds `resolvedAt`; staff also `version` | as Lab 3 |
| GET | `/api/staff/tickets`, `/api/tickets` | as Lab 3 | changed: accepts `statusGroup=active` | as Lab 3, plus 400 for an invalid `statusGroup` |

## 9. Acceptance Criteria

**Actions Taken**
- **AC-01:** Given a permitted IT Staff user and valid data, when an Actions Taken is created, then it is saved under the correct Ticket with the authenticated creator and approved assignee (the creator when no assignee is chosen).
- **AC-02:** Given an authenticated Requester, when dashboard data is retrieved, then only metrics and recent Tickets owned by that Requester are returned, even if a `requesterId` is sent.
- **AC-03:** Given an empty Action Description, no Action Date/Time, a text over its limit, or Follow-Up Required without a Follow-up Note, when an action is saved, then it gets `400` with the field names and nothing is saved.
- **AC-04:** Given an inactive user, a Requester, or an unknown user as assignee, when an action is created or reassigned, then it gets `409 CONFLICT`; an active IT Staff member who is not the Ticket Owner is accepted.
- **AC-05:** Given an action, when its status changes, then only the BR-07 changes work, any change to a Completed or Cancelled action gets `409`, there is no delete, and a cancelled action stays listed.
- **AC-06:** Given user X completes an action, then Performed By is X whatever the client sends; before that the UI shows "Not yet performed".
- **AC-07:** Given several actions on one Ticket, when they are listed, then they are ordered by Action Date/Time and then id, and each row shows the assignee and Performed By.
- **AC-08:** Given a Requester, when they open their own Ticket, then all actions and fields are shown with no edit controls; another Requester's Ticket gets `404`; every action write gets `403`.
- **AC-09:** Given Staff Ticket Detail, then the Actions Taken area has a list (table on desktop and tablet, cards on mobile), a create mode, and a view/edit mode where Start, Complete, and Cancel appear only when allowed, and Cancel asks for confirmation.

**Ticket Workflow**
- **AC-10:** Given every status pair, when staff change status with the current version, then only the section 5.4 pairs work; other pairs and a missing owner (except Cancelled) get `409`; Resolved, Closed, and Cancelled need confirmation.
- **AC-11:** Given a Ticket with a Planned or In Progress action, when Resolved, or Closed from Resolved, is requested by a direct API call, then it gets `409 OPEN_ACTIONS_EXIST` and nothing changes; after the action is completed or cancelled, or with zero actions, it works.
- **AC-12:** Given a Ticket, when it is resolved, closed, and reopened, then `resolvedAt` is set on Resolved, kept on Closed, and cleared on Reopened.
- **AC-13:** Given several status changes, then exactly one history row is written for each success and none for a rejected change; the timeline is shown in order to staff and the owning Requester; another Requester gets `404`; there is no edit or delete.
- **AC-14:** Given a Requester, when they try to change status, then it gets `403`; "Problem Appears Resolved" sets only the flag and the status does not change.
- **AC-15:** Given the status control, then only allowed targets are listed, and after a successful change the Ticket summary status, actions, and timeline are refreshed.
- **AC-16:** Given two staff users with the same Ticket version, when both save, then the first save works and increases `version` by 1, and the second gets `409 STALE_UPDATE` and saves nothing; a missing `expectedVersion` gets `400`; comments and actions do not change `version`.
- **AC-17:** Given a stale update on screen, then the message "This ticket was changed by someone else. Reload to see the latest version." is shown, the user's input is kept, and Reload loads the latest Ticket.

**Dashboards**
- **AC-18:** Given the freshly seeded test database, when Jennifer, David, and Michael open the Requester Dashboard, then the values equal section 7.4.
- **AC-19:** Given Tickets and actions inside and outside the last 7 days, then each dashboard list has only matching rows, at most 5, in the documented order.
- **AC-20:** Given the freshly seeded test database, when Priya, Marcus, Elena, and Admin open the IT Staff Dashboard, then the cards and `countsByStatus` (all 8 statuses) equal section 7.4 and direct database queries.
- **AC-21:** Given an Administrator, then the IT Staff Dashboard has the same shape with no user counts; the wrong role gets `403` and no session gets `401`; no full Ticket collections are returned.
- **AC-22:** Given a dashboard card or status row, when it is clicked, then My Tickets or the Ticket Queue opens with the section 5.5 filters and its total equals the card; list rows open Ticket Detail.
- **AC-23:** Given `statusGroup=active` on My Tickets and the Ticket Queue, then only active Tickets are returned; an invalid value gets `400`; the earlier parameters work as before.
- **AC-24:** Given no data, loading, a forbidden role, or an API failure, then the dashboard shows `0` and the empty text, a loading state, the forbidden message, or a safe message with Retry.
- **AC-25:** Given each role, when the user logs in, then the Dashboard opens first and is marked active in the navigation, and all earlier screens are still reachable.

**Data and Hardening**
- **AC-26:** Given a Lab 3 database, when the migration runs, then all earlier data stays and legacy Tickets follow BR-25; when the down-SQL runs, then only the Lab 4 objects are removed and the migration can be applied again.
- **AC-27:** Given the seed run twice, then there are no duplicate actions, and there are Tickets with zero, one, and several actions, every action status, and zero and non-zero dashboard values.
- **AC-28:** Given the server and E2E test runs, then they use `toktickit_test` and the development database does not change.
- **AC-29:** Given logged-in users, then the Labs 1 to 3 features still work: login and roles, Create Ticket, My Tickets, Ticket Detail ownership, attachments, Public Comments, Internal Notes, the Ticket Queue, and user management.
- **AC-30:** Given repeated clicks on Save Action or Save Changes, then only one request is sent, and typed values stay after a recoverable failure.
- **AC-31:** Given an unexpected error on a Lab 4 endpoint, then it returns `500 SERVER_ERROR` with a generic message and the UI shows a safe message.
- **AC-32:** Given desktop, tablet, and mobile viewports, then the dashboards and Actions Taken have no horizontal scroll, clipping, or overlap.
- **AC-33:** Given keyboard-only use, then every new control can be reached with visible focus and a label, metric cards have names like "Open tickets: 3", and statuses show text, not only colour.
- **AC-34:** Given the final app, then Lab 4 screens use the Zen Green colours and components of Labs 2 and 3, and there are no console errors, broken links, placeholder text, or unfinished controls.
- **AC-35:** Given the seeded test database, when the two dashboard endpoints and the action list are called, then each responds in under 1000 ms.

## 10. Definition of Done

- [x] FR-01 to FR-25 are implemented, and nothing from the excluded scope is added.
- [x] Every action and workflow write is checked by the backend (role, ownership, gate, version) and tested by direct API calls; dashboard metrics match section 5.5 and direct database queries.
- [x] The migration keeps earlier data, the down-SQL is tested, and the seed gives the section 7.4 values.
- [x] Tests use `toktickit_test`, and the development database is unchanged after a test run.
- [x] Every AC maps to a passing test in `tests.md`; all Lab 4 tests pass with none skipped, including the regression tests.
- [x] The UI follows `ui-spec.md`, the screenshots are under `artifacts/lab-04/screenshots/`, and the visual checklist is filled in.
- [x] The README covers `server/.env.test`, migration, the down-SQL recovery, seed accounts, test commands, and the demo.
- [x] No secret, password, or hash appears in the repository, logs, or responses.
- [x] The four Lab 4 documents are merged before the main implementation PRs.
- [x] GitHub Issues #1 to #6 are Done; work is merged from feature branches into `lab4-staging` and then `main` through reviewed PRs; `reviewer.md` and `ai-use.md` are complete.

## 11. Assumptions and Decisions

- **A-01 Assignee and status on actions:** staff need to assign actions, move them through statuses, complete or cancel them, and reject inactive assignees, so I add an assignee and four statuses to the required fields.
- **A-02 Performed By:** it is the user who completes the action, because the assignee and the person who does the work can differ.
- **A-03 Stale updates on Ticket only:** the version is on Ticket handling and status changes, where two staff members are most likely to clash. Actions have no version.
- **A-04 Recent window:** a rolling 7 days up to now; times are stored in UTC and shown in Asia/Bangkok.
- **A-05 Dashboard as first screen:** the IT Staff Dashboard is meant as the starting point for daily work, so every role starts there.
- **A-06 Test database:** a separate database keeps the demo data and the expected values stable.
- **A-07 Seed `resolvedAt`:** the seed sets it on one Ticket so "recently resolved" has a non-zero example.

### Changed from Lab 3

- `PATCH /api/staff/tickets/:id` and `POST /api/staff/tickets/:id/status` need `expectedVersion`.
- Resolved, and Resolved to Closed, are blocked while open actions exist.
- `409` can now be `OPEN_ACTIONS_EXIST` or `STALE_UPDATE` as well as `CONFLICT`.
- Status changes set or clear `resolvedAt` and write a history row.
- The Dashboard is the first screen after login for every role.

### Known Limitations

- Old Tickets have an empty timeline and no `resolvedAt`, so they never appear in "recently resolved".
- Actions have no stale detection; the last save wins.
- Double-submit protection relies on disabled buttons; there are no idempotency keys.

## Traceability Summary

| FR | BR | AC |
|---|---|---|
| FR-01, FR-02 | BR-01 to BR-06 | AC-01, AC-03, AC-04 |
| FR-03 to FR-05 | BR-03, BR-06 to BR-08, BR-10 | AC-03 to AC-05, AC-07, AC-09 |
| FR-06, FR-07 | BR-09, BR-11 | AC-06, AC-08 |
| FR-08, FR-09, FR-12 | BR-12, BR-13 | AC-10, AC-11, AC-15 |
| FR-10, FR-11 | BR-14 to BR-16 | AC-12 to AC-14 |
| FR-13 | BR-17, BR-18 | AC-16, AC-17 |
| FR-14, FR-15 | BR-19 to BR-23 | AC-02, AC-18 to AC-21 |
| FR-16 | BR-24 | AC-22, AC-23 |
| FR-17, FR-18 | BR-23, BR-28, BR-30 | AC-24, AC-25 |
| FR-19 | BR-25, BR-26 | AC-26, AC-27 |
| FR-20, FR-21 | BR-27, BR-29 | AC-28, AC-29 |
| FR-22, FR-23 | BR-28 | AC-30, AC-31, AC-34 |
| FR-24 | BR-29 | AC-32 to AC-34 |
| FR-25 | BR-22 | AC-35 |
