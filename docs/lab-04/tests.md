# Lab 4 Test Plan and Traceability

## 1. Test Strategy

| Level | Tools | Covers |
|---|---|---|
| Unit | Vitest | action status rules, action field rules, Ticket transition and gate rules, recent window |
| API / integration, authorization, workflow | Vitest + Supertest + PostgreSQL | action endpoints, roles, workflow, stale updates, dashboards, filters |
| Migration / regression | Vitest + Prisma + Supertest | migration, down-SQL, seed, Labs 1 to 3 features with login |
| Performance smoke | Vitest + Supertest | dashboard and action list endpoints |
| UI component and UI style | Vitest + React Testing Library | dashboards, navigation, Actions Taken, workflow feedback, labels and badges |
| Responsive and E2E | Playwright at 1440 × 900, 768 × 1024, 375 × 812, plus a manual checklist | full flows, layout, keyboard, screenshots |

**Test database.** Server tests and E2E use a separate database, `toktickit_test`, set in `server/.env.test`, so they never change the demo data. The Vitest global setup loads that file, runs `prisma migrate deploy`, and runs the seed. The Playwright config loads the same file for the server it starts. The dashboard test files reset and reseed the test database in `beforeAll`, because their expected values come from specification section 7.4. Other tests clean up what they create or use a unique marker text.

**Seed accounts.** Tests log in with the seeded accounts (`ChangeMe123`) and look up ids by email or Ticket Number.

**Unit tests** are in a `describe("unit")` block inside the matching server test file, so they stay next to the API tests for the same rule.

**TDD order for each Issue:** write the planned tests, run them and check that they fail for the expected reason, implement, then run all Lab 4 tests before opening the PR.

| Issue | Test files it owns |
|---|---|
| #1 Sprint 4 engineering contract | none (the four documents) |
| #2 Actions Taken foundation | `server/tests/lab-04/actions-taken.api.test.ts`, `server/tests/lab-04/migration.test.ts`, and the test database setup |
| #3 Actions Taken UI | `client/tests/lab-04/ActionsTaken.test.tsx`, `e2e/lab-04/actions-taken-flow.spec.ts` |
| #4 Ticket workflow | `server/tests/lab-04/ticket-workflow.api.test.ts`, `client/tests/lab-04/TicketWorkflow.test.tsx`, `e2e/lab-04/ticket-resolution.spec.ts` |
| #5 Role dashboards | `server/tests/lab-04/requester-dashboard.api.test.ts`, `server/tests/lab-04/staff-dashboard.api.test.ts`, `client/tests/lab-04/StaffDashboard.test.tsx`, `client/tests/lab-04/RequesterDashboard.test.tsx`, `e2e/lab-04/dashboards.spec.ts` |
| #6 Final hardening | `server/tests/lab-04/regression.api.test.ts`, `server/tests/lab-04/performance-smoke.test.ts`, the responsive checks and screenshots in the E2E files, the visual checklist, and release integration (merge `lab4-staging` into `main` and run all tests on `main`) |

## 2. Planned Tests

### 2.1 Unit

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-05 | Action status rule for every pair and every first status | Only the BR-07 changes are allowed; Cancelled is not a first status | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| UNIT-02 | Unit | AC-03 | Action field rule: description empty, 1, 1000, 1001 characters; Attachment Notes 500 and 501; follow-up on without and with a note | Valid only inside BR-03 and BR-04 | `actions-taken.api.test.ts` | Planned |
| UNIT-03 | Unit | AC-10, AC-11 | Ticket transition rule for every pair; gate with zero, open, and only finished actions | Only section 5.4 pairs; gate blocks only with an open action | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| UNIT-04 | Unit | AC-19 | Recent window at now, exactly 7 days ago, and 7 days plus 1 minute ago | First two inside, last outside | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |

### 2.2 API and Authorization: Actions Taken

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-01 | API | AC-01 | Create a valid Actions Taken without an assignee, with fake `createdById` and `performedById` | `201`; under the correct Ticket; creator and assignee are the caller; fake values ignored | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-02 | API | AC-01, AC-04 | Priya creates an action assigned to Marcus on an Elena-owned Ticket | `201`; assignee Marcus; Ticket Owner unchanged | `actions-taken.api.test.ts` | Planned |
| API-03 | API | AC-03 | Create with no description, no `actionAt`, too long text, and follow-up without a note, all at once | `400` with every field name; nothing saved | `actions-taken.api.test.ts` | Planned |
| API-04 | API | AC-04 | Create and reassign with Tom (inactive), Jennifer (Requester), and an unknown id | `409 CONFLICT` each time; action unchanged | `actions-taken.api.test.ts` | Planned |
| API-05 | API | AC-03 | Edit an open action (description, result, follow-up); then edit with an empty description | `200` with new values; then `400 fields.description` | `actions-taken.api.test.ts` | Planned |
| API-06 | API | AC-05 | Every allowed status change by PATCH | `200` with the new status | `actions-taken.api.test.ts` | Planned |
| API-07 | API | AC-05 | In Progress to Planned; same status; any change to a Completed or Cancelled action; `DELETE` | `409 CONFLICT`; no delete route (`404`); cancelled action still listed | `actions-taken.api.test.ts` | Planned |
| API-08 | API | AC-06 | Marcus completes an action assigned to him, sending a fake `performedById` | `performedBy` is Marcus; before completion it is null | `actions-taken.api.test.ts` | Planned |
| API-09 | API | AC-07 | List actions with two equal `actionAt` values | Ordered by `actionAt`, then `id`; assignee and performer included | `actions-taken.api.test.ts` | Planned |
| AUTHZ-01 | Authorization | AC-08 | Michael reads the actions of TKT-2026-900003; Jennifer reads the same | `200` with all fields; `404` for Jennifer | `actions-taken.api.test.ts` | Planned |
| AUTHZ-02 | Authorization | AC-08 | Requester POST and PATCH on action routes; staff on `/api/tickets/:id/actions`; no session | `403`; `403`; `401` | `actions-taken.api.test.ts` | Planned |
| AUTHZ-03 | Authorization | AC-01 | Administrator creates and updates an action | `201`, `200` | `actions-taken.api.test.ts` | Planned |

### 2.3 Workflow and Stale Updates

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| FLOW-01 | Workflow | AC-10 | Every status pair with the current version; no owner; no confirmation | Only section 5.4 pairs work, others `409`; no owner `409` except Cancelled; no confirmation `400` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| FLOW-02 | Workflow | AC-11 | Resolve with a Planned action, then complete it and resolve; resolve and close a Ticket with zero actions | `409 OPEN_ACTIONS_EXIST` and no change; then `200`; zero-action Ticket `200` both times | `ticket-workflow.api.test.ts` | Planned |
| FLOW-03 | Workflow | AC-11 | Add a Planned action to a Resolved Ticket, then close; cancel the action, then close | `409 OPEN_ACTIONS_EXIST`; then `200` | `ticket-workflow.api.test.ts` | Planned |
| FLOW-04 | Workflow | AC-12 | Resolve, close, and reopen a Ticket | `resolvedAt` set, kept, then cleared | `ticket-workflow.api.test.ts` | Planned |
| FLOW-05 | Workflow | AC-13 | 3 successful changes and 1 rejected change; read history as staff, owner, and another Requester; PATCH and DELETE on history | 3 rows in order with from, to, by, at; `200`, `200`, `404`; no edit or delete routes | `ticket-workflow.api.test.ts` | Planned |
| FLOW-06 | Workflow | AC-14 | Requester changes status; Requester marks "Problem Appears Resolved" | `403`; flag set and status unchanged | `ticket-workflow.api.test.ts` | Planned |
| FLOW-07 | Workflow | AC-16 | Two PATCH calls with the same version; a status change with an old version; no `expectedVersion`; a comment and an action between two reads | First `200` and `version` +1, second `409 STALE_UPDATE` with nothing saved; old version `409 STALE_UPDATE`; `400`; `version` unchanged by the comment and action | `ticket-workflow.api.test.ts` | Planned |

### 2.4 API: Dashboards and Filters

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-10 | API | AC-18 | Requester Dashboard for Jennifer, David, and Michael on a fresh seed | Values equal specification section 7.4 and the Prisma queries | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-11 | API | AC-02 | Jennifer calls with `?requesterId=<Michael's id>` | Same response as without it; only Jennifer's Tickets | `requester-dashboard.api.test.ts` | Planned |
| API-12 | API | AC-19, AC-24 | Tickets updated 8 days ago and 6 recent ones; a resolved then closed Ticket; a reopened Ticket; a Requester with no Tickets | Old row left out; at most 5, newest first; closed one included, reopened one not; `0` and `[]` with `200` | `requester-dashboard.api.test.ts` | Planned |
| API-13 | API | AC-20 | IT Staff Dashboard for Priya, Marcus, Elena, and Admin on a fresh seed | Cards and `countsByStatus` (all 8 keys, zeros included) equal section 7.4 and the Prisma queries | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-14 | API | AC-19, AC-20 | `myOpenActionsList` with 6 open actions, one Completed, one Cancelled; `recentlyUpdated` with 6 recent Tickets | At most 5 each; only open actions, oldest first; newest Tickets first | `staff-dashboard.api.test.ts` | Planned |
| API-15 | API | AC-21 | Administrator and IT Staff responses | Same keys; no user counts; no full Ticket lists | `staff-dashboard.api.test.ts` | Planned |
| AUTHZ-04 | Authorization | AC-21 | IT Staff and Admin on the Requester Dashboard; Requester on the IT Staff Dashboard; no session | `403`; `403`; `401` | `requester-dashboard.api.test.ts`, `staff-dashboard.api.test.ts` | Planned |
| API-16 | API | AC-22 | My Tickets and Ticket Queue with each card's drill-down parameters | `totalItems` equals each card value | `staff-dashboard.api.test.ts` | Planned |
| API-17 | API | AC-23 | `statusGroup=active`, `statusGroup=bad`, `status` plus `statusGroup`, and Lab 3 parameters only | Only active Tickets; `400 fields.statusGroup`; both must match; old results unchanged | `staff-dashboard.api.test.ts` | Planned |

### 2.5 Migration, Regression, and Performance

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| MIG-01 | Migration | AC-26 | Lab 3 schema with data, then the Lab 4 migration | User, Ticket, attachment, comment, and note counts unchanged; legacy Tickets have 0 actions, empty history, `resolvedAt` null, `version` 0 | `server/tests/lab-04/migration.test.ts` | Planned |
| MIG-02 | Migration | AC-26 | Run the down-SQL, then apply the migration again | Only Lab 4 objects removed; earlier data still there; migration works again | `migration.test.ts` | Planned |
| MIG-03 | Migration | AC-27 | Run the seed twice | No duplicate actions; Tickets with 0, 1, and 3 actions; all four action statuses; Elena 0 and Priya 1 open actions | `migration.test.ts` | Planned |
| REG-01 | Regression | AC-29 | Login for each role, forced password change, logout | Lab 3 responses | `server/tests/lab-04/regression.api.test.ts` | Planned |
| REG-02 | Regression | AC-29 | Health, categories, related systems, Create Ticket, My Tickets search and filters, another Requester's Ticket | Lab 1 and Lab 2 responses; `404` for another Requester | `regression.api.test.ts` | Planned |
| REG-03 | Regression | AC-29 | Attachment type and size limits, download, removal | Lab 2 limits; `410` after removal | `regression.api.test.ts` | Planned |
| REG-04 | Regression | AC-29 | Public Comments and Internal Notes for each role | Lab 3 rules; Requester `403` on notes | `regression.api.test.ts` | Planned |
| REG-05 | Regression | AC-29 | Ticket Queue filters; owner and IT Priority update with `expectedVersion` | Lab 3 results; update works | `regression.api.test.ts` | Planned |
| REG-06 | Regression | AC-29 | User management: create, edit, last Administrator rule | Lab 3 results; `409` for the last Administrator | `regression.api.test.ts` | Planned |
| REG-07 | Regression | AC-31 | Forced database error on each Lab 4 endpoint | `500 SERVER_ERROR` with a generic message | `regression.api.test.ts` | Planned |
| REG-08 | Regression | AC-28 | `DATABASE_URL` seen by the tests; development database row counts before and after a full run | Points to `toktickit_test`; development counts identical (manual compare, section 5) | `regression.api.test.ts` and manual | Planned |
| PERF-01 | Performance | AC-35 | `GET /api/dashboard/requester` and `GET /api/staff/dashboard` on the seeded test database | Each under 1000 ms | `server/tests/lab-04/performance-smoke.test.ts` | Planned |
| PERF-02 | Performance | AC-35 | `GET /api/staff/tickets/:id/actions` for TKT-2026-900003 | Under 1000 ms | `performance-smoke.test.ts` | Planned |

### 2.6 UI Component and UI Style

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UI-01 | UI | AC-20, AC-33 | IT Staff cards and Tickets by status block | 3 card buttons named like "Unassigned: 3"; 8 status rows including zeros | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-02 | UI | AC-19, AC-24 | My open actions and Recently updated lists with data and empty | Columns as ui-spec section 3; "You have no open actions."; "No tickets updated in the last 7 days." | `StaffDashboard.test.tsx` | Planned |
| UI-03 | UI | AC-22 | Click each card, status row, list row, and "View all" | Ticket Queue or Ticket Detail opens with the ui-spec section 3 filters; My open actions moves focus to its list | `StaffDashboard.test.tsx` | Planned |
| UI-04 | UI | AC-24 | Loading, forbidden, and failure | "Loading dashboard..."; forbidden message; "Unable to load the dashboard." and Retry loads again | `StaffDashboard.test.tsx` | Planned |
| UI-05 | UI | AC-25 | IT Staff and Administrator after login | Dashboard first, marked active; Ticket Queue and User Management still reachable | `StaffDashboard.test.tsx` | Planned |
| UI-06 | UI | AC-18, AC-19, AC-33 | Requester cards and lists | 2 cards named like "Open tickets: 3"; both lists and their empty texts | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-07 | UI | AC-02, AC-22 | Card and row clicks; the API call | My Tickets opens with the filters and the "Active tickets only" chip; `getRequesterDashboard()` has no parameters | `RequesterDashboard.test.tsx` | Planned |
| UI-08 | UI | AC-24, AC-25 | Requester states and navigation after login | Same states as UI-04; Dashboard first and active; My Tickets and Create Ticket reachable | `RequesterDashboard.test.tsx` | Planned |
| UI-09 | UI | AC-06, AC-07 | Actions list with data, empty, loading, failure | Columns as ui-spec 5.1; "Not yet performed"; empty, loading, and failure texts | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-10 | UI | AC-01, AC-09 | Create mode | Fields in order with defaults (now, Planned, me); Follow-up Note shown only when checked; correct `createAction` call | `ActionsTaken.test.tsx` | Planned |
| UI-11 | UI | AC-03, AC-04 | Server `400` with `fields`; server `409` for an inactive assignee | Messages under fields and first invalid field focused; alert at the top; values kept | `ActionsTaken.test.tsx` | Planned |
| UI-12 | UI | AC-05, AC-09 | View and edit mode for each action status; Cancel Action with Keep and confirm | Buttons as ui-spec 5.3; Keep sends nothing; final actions show only Close | `ActionsTaken.test.tsx` | Planned |
| UI-13 | UI | AC-30, AC-31 | Double click Save Action; then a `500` | One call; button disabled with "Saving..."; safe message; values kept | `ActionsTaken.test.tsx` | Planned |
| UI-14 | UI | AC-08 | Requester view | All fields shown; no Add, Edit, Start, Complete, or Cancel | `ActionsTaken.test.tsx` | Planned |
| UI-15 | UI | AC-15 | Status select for each current status | Only allowed targets listed | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-16 | UI | AC-15, AC-16 | Successful status change | Sends `expectedVersion`; reloads Ticket, actions, and timeline; "Changes saved." | `TicketWorkflow.test.tsx` | Planned |
| UI-17 | UI | AC-11 | `409 OPEN_ACTIONS_EXIST` from `changeStatus` | Gate message as `role="alert"`; status unchanged | `TicketWorkflow.test.tsx` | Planned |
| UI-18 | UI | AC-17 | `409 STALE_UPDATE`, then Reload | Stale message; selected values kept; Reload loads the latest Ticket | `TicketWorkflow.test.tsx` | Planned |
| UI-19 | UI | AC-13 | Status Timeline with rows and with none (staff and Requester) | Entries in order with from, to, by, time; "No status changes recorded yet." | `TicketWorkflow.test.tsx` | Planned |
| STYLE-01 | UI Style | AC-33, AC-34 | `ActionStatusBadge` and "Follow-up needed" label | Text for each status; same badge classes as `StatusBadge` | `ActionsTaken.test.tsx` | Planned |
| STYLE-02 | UI Style | AC-33 | Required markers and read-only fields in the action panel | `*` and `aria-required`; read-only fields use the Lab 3 read-only style | `ActionsTaken.test.tsx` | Planned |
| STYLE-03 | UI Style | AC-33, AC-34 | Dashboard cards and status rows | Real buttons with the Lab 2 and 3 card classes; StatusBadge text on each row | `StaffDashboard.test.tsx` | Planned |
| STYLE-04 | UI Style | AC-31 | Gate and stale messages | `role="alert"` with the Lab 3 warning alert style | `TicketWorkflow.test.tsx` | Planned |

### 2.7 Responsive and End-to-End

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| RESP-01 | Responsive | AC-32 | Both dashboards at the 3 viewports | No horizontal scroll; screenshots saved (ui-spec section 10) | `e2e/lab-04/dashboards.spec.ts` | Planned |
| RESP-02 | Responsive | AC-09, AC-32 | Actions Taken on TKT-2026-900003 at the 3 viewports | Table on desktop and tablet, cards on mobile; no scroll; screenshots saved | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| RESP-03 | Responsive | AC-32, AC-33, AC-34 | ui-spec section 11 checklist | Every row inspected and filled in | Manual | Planned |
| E2E-01 | E2E | AC-18, AC-22, AC-25 | Jennifer logs in and clicks Open tickets | Dashboard first; section 7.4 values; My Tickets shows the chip and the same total | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-02 | E2E | AC-20, AC-21, AC-22 | Priya clicks Unassigned and an open action row; Admin opens the dashboard; Requester calls `/api/staff/dashboard` | Queue total 3; the Ticket opens; Admin sees the same dashboard; `403` | `dashboards.spec.ts` | Planned |
| E2E-03 | E2E | AC-33 | Keyboard only on both dashboards | Tab reaches every card and link with visible focus; Enter opens the target | `dashboards.spec.ts` | Planned |
| E2E-04 | E2E | AC-01, AC-04, AC-06 | Priya adds an action for Marcus on Elena's Ticket; Marcus completes it | Action saved; Performed By Marcus; Ticket Owner still Elena | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-05 | E2E | AC-03, AC-05, AC-30 | Validation errors; double click Save Action; cancel an action | Field messages; one action created; cancelled action stays listed | `actions-taken-flow.spec.ts` | Planned |
| E2E-06 | E2E | AC-08 | The owning Requester opens the Ticket | Actions shown read-only with all fields | `actions-taken-flow.spec.ts` | Planned |
| E2E-07 | E2E | AC-11, AC-13, AC-15 | Resolve blocked by an open action; complete it; resolve | Gate message; then Resolved; summary status and timeline update; Requester sees the new status | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-08 | E2E | AC-16, AC-17 | Two staff browsers edit the same Ticket | Second sees the stale message with input kept; Reload shows the first change | `ticket-resolution.spec.ts` | Planned |
| E2E-09 | E2E | AC-29, AC-34 | Requester creates a Ticket with an attachment and a comment; staff adds an Internal Note; Admin opens User Management | All work; no console errors; no placeholder text | `ticket-resolution.spec.ts` | Planned |

**Planned total: 80 tests**

| UNIT | API | AUTHZ | FLOW | MIG | REG | PERF | UI | STYLE | RESP | E2E |
|---|---|---|---|---|---|---|---|---|---|---|
| 4 | 17 | 4 | 7 | 3 | 8 | 2 | 19 | 4 | 3 | 9 |

## 3. Acceptance Criterion Traceability

| AC | Tests | AC | Tests |
|---|---|---|---|
| AC-01 | API-01, API-02, AUTHZ-03, UI-10, E2E-04 | AC-19 | UNIT-04, API-12, API-14, UI-02, UI-06 |
| AC-02 | API-11, UI-07 | AC-20 | API-13, API-14, UI-01, E2E-02 |
| AC-03 | UNIT-02, API-03, API-05, UI-11, E2E-05 | AC-21 | API-15, AUTHZ-04, E2E-02 |
| AC-04 | API-02, API-04, UI-11, E2E-04 | AC-22 | API-16, UI-03, UI-07, E2E-01, E2E-02 |
| AC-05 | UNIT-01, API-06, API-07, UI-12, E2E-05 | AC-23 | API-17 |
| AC-06 | API-08, UI-09, E2E-04 | AC-24 | API-12, UI-02, UI-04, UI-08 |
| AC-07 | API-09, UI-09 | AC-25 | UI-05, UI-08, E2E-01 |
| AC-08 | AUTHZ-01, AUTHZ-02, UI-14, E2E-06 | AC-26 | MIG-01, MIG-02 |
| AC-09 | UI-10, UI-12, RESP-02 | AC-27 | MIG-03 |
| AC-10 | UNIT-03, FLOW-01 | AC-28 | REG-08 |
| AC-11 | UNIT-03, FLOW-02, FLOW-03, UI-17, E2E-07 | AC-29 | REG-01 to REG-06, E2E-09 |
| AC-12 | FLOW-04 | AC-30 | UI-13, E2E-05 |
| AC-13 | FLOW-05, UI-19, E2E-07 | AC-31 | REG-07, UI-13, STYLE-04 |
| AC-14 | FLOW-06 | AC-32 | RESP-01, RESP-02, RESP-03 |
| AC-15 | UI-15, UI-16, E2E-07 | AC-33 | UI-01, UI-06, STYLE-01 to STYLE-03, RESP-03, E2E-03 |
| AC-16 | FLOW-07, UI-16, E2E-08 | AC-34 | STYLE-01, STYLE-03, RESP-03, E2E-09 |
| AC-17 | UI-18, E2E-08 | AC-35 | PERF-01, PERF-02 |
| AC-18 | API-10, UI-06, E2E-01 | | |

Every AC from AC-01 to AC-35 has at least one test.

## 4. Responsive and Visual Checklist

The checklist is in ui-spec section 11 and the screenshot list in ui-spec section 10. RESP-01 and RESP-02 save the screenshots, and RESP-03 is the manual inspection.

## 5. Test Commands

Run these after Issue #2 sets up the test database.

```bash
cd server && npm test        # server/tests/lab-04 on toktickit_test
cd client && npm test        # client/tests/lab-04
npx playwright test          # e2e/lab-04, server started with server/.env.test
```

For REG-08, I count the rows in the development database before and after the three commands and compare them.

## 6. Final Results

I fill this in from `main` at the end of the sprint.

| Suite | Command | Total | Passed | Failed | Skipped | Date |
|---|---|---|---|---|---|---|
| Server | `cd server && npm test` | | | | | |
| Client | `cd client && npm test` | | | | | |
| E2E | `npx playwright test` | | | | | |
| Development database unchanged (REG-08) | manual | | | | | |
| Visual checklist (RESP-03) | manual | | | | | |

## 7. Known Limitations or Deferred Tests

- Actions have no stale detection, so there is no stale test for actions.
- Sessions are in memory, so restart behaviour is not tested.
- There are no idempotency keys; double submit is tested only through the UI (UI-13, E2E-05).
- Rate limiting does not exist, so it is not tested.
- Old Tickets have empty timelines and no `resolvedAt`; MIG-01 checks this, not real past times.
- The forbidden screen cannot be reached from the browser (screens are state-based); UI-04 and UI-08 test it at component level and AUTHZ-04 tests the `403`.
- PERF tests are a smoke check only.
