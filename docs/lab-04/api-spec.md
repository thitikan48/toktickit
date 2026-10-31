# Lab 4 REST API Specification

This extends [`docs/lab-03/api-spec.md`](../lab-03/api-spec.md). Everything in Lab 3 still holds unless this file says otherwise. FR, BR, and AC IDs refer to [`specification.md`](specification.md).

## 1. Conventions

- **Base path:** `/api`, JSON bodies. Login, the session cookie, and the password change rule are the same as Lab 3.
- **Authentication:** every endpoint needs a session. No session gives `401`. A user who must change the initial password gets `403 PASSWORD_CHANGE_REQUIRED`, as in Lab 3.
- **Health:** the one exception is `GET /api/health`, which still works as in Lab 1 without a session (it was already public in Lab 3; Lab 3 FR-05 did not list it).
- **Validation:** text is trimmed first. Validation errors of one request are returned together in `fields`.
- **Date-times** are ISO 8601 in UTC, for example `"2026-11-03T03:00:00.000Z"`. The UI shows them in Asia/Bangkok time.
- **Enums:** `TicketStatus` as Lab 3. `ActionStatus` is `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
- **Error shape** (as Lab 3): `{ "error": { "code": "...", "message": "...", "fields": { "field": "message" } } }`. `fields` is only for validation errors. Messages never contain stack traces, SQL, or secrets.

Examples use a freshly seeded test database. Ids are only examples; tests look users up by email and Tickets by Ticket Number.

## 2. Endpoint Overview

| Method | Path | Roles | New or changed |
|---|---|---|---|
| GET | `/staff/tickets/:id/actions` | IT_STAFF, ADMIN | new |
| POST | `/staff/tickets/:id/actions` | IT_STAFF, ADMIN | new |
| PATCH | `/staff/tickets/:id/actions/:actionId` | IT_STAFF, ADMIN | new |
| GET | `/tickets/:id/actions` | REQUESTER (own) | new |
| GET | `/staff/tickets/:id/history` | IT_STAFF, ADMIN | new |
| GET | `/tickets/:id/history` | REQUESTER (own) | new |
| GET | `/dashboard/requester` | REQUESTER | new |
| GET | `/staff/dashboard` | IT_STAFF, ADMIN | new |
| PATCH | `/staff/tickets/:id` | IT_STAFF, ADMIN | changed |
| POST | `/staff/tickets/:id/status` | IT_STAFF, ADMIN | changed |
| GET | `/staff/tickets/:id`, `/tickets/:id` | as Lab 3 | changed (new fields) |
| GET | `/staff/tickets`, `/tickets` | as Lab 3 | changed (`statusGroup`) |
| GET | `/staff/assignees` | IT_STAFF, ADMIN | reused from Lab 3 for the action Assignee list |

## 3. Actions Taken

**Action object** (staff and the owning Requester get the same object):

```json
{ "id": 4, "ticketId": 3, "actionAt": "2026-11-02T02:20:00.000Z",
  "description": "Reset the multi-factor enrolment for the mail account.", "result": null,
  "status": "IN_PROGRESS", "assignedTo": { "id": 7, "name": "Marcus Chen" }, "performedBy": null,
  "followUpRequired": false, "followUpNote": null, "attachmentNotes": null,
  "createdBy": { "id": 7, "name": "Marcus Chen" }, "updatedBy": { "id": 7, "name": "Marcus Chen" },
  "createdAt": "...", "updatedAt": "..." }
```

### 3.1 `GET /staff/tickets/:id/actions` (IT_STAFF, ADMIN)

Returns `200 { "items": [Action, ...] }`, ordered by `actionAt` and then `id` (BR-10). A Ticket with no actions returns `{ "items": [] }`.

Errors: `401`; `403` for a Requester; `404` for an unknown Ticket; `500`. (FR-03, AC-07)

### 3.2 `POST /staff/tickets/:id/actions` (IT_STAFF, ADMIN)

| Field | Type | Required | Rule |
|---|---|---|---|
| `actionAt` | date-time | yes | Action Date/Time |
| `description` | string | yes | 1 to 1000 characters |
| `status` | `PLANNED`, `IN_PROGRESS`, `COMPLETED` | no | default `PLANNED` (BR-07) |
| `result` | string | no | up to 1000 characters |
| `assignedToId` | integer | no | active IT_STAFF or ADMIN; default the caller (BR-06) |
| `followUpRequired` | boolean | no | default false |
| `followUpNote` | string | when `followUpRequired` is true | 1 to 1000 characters (BR-04) |
| `attachmentNotes` | string | no | up to 500 characters, text only |

The backend sets `createdById`, `updatedById`, and `performedById` (only when the status is `COMPLETED`). Values sent for these fields are ignored (BR-09).

```json
{ "actionAt": "2026-11-03T03:00:00.000Z", "description": "Cleaned the paper-path sensor.",
  "status": "COMPLETED", "result": "No paper-jam warning after cleaning.",
  "assignedToId": 6, "followUpRequired": true, "followUpNote": "Check again next Monday.",
  "attachmentNotes": "See printer-sensor.jpg in the ticket attachments." }
```

Returns `201` with the new Action.

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | missing or invalid field; `fields` has the field names |
| 401 | `UNAUTHENTICATED` | no session |
| 403 | `FORBIDDEN` | Requester |
| 404 | `NOT_FOUND` | unknown Ticket |
| 409 | `CONFLICT` | assignee is inactive, a Requester, or unknown |
| 500 | `SERVER_ERROR` | unexpected error |

(FR-01, FR-02, FR-06, AC-01, AC-03, AC-04)

### 3.3 `PATCH /staff/tickets/:id/actions/:actionId` (IT_STAFF, ADMIN)

The body has at least one of the section 3.2 fields. It is used for edit, reassign, start, complete, and cancel.

`status` may be `IN_PROGRESS`, `COMPLETED`, or `CANCELLED` (BR-07). The rules are checked on the merged action, so turning on follow-up needs a note. Completing sets `performedById` to the caller. Example body: `{ "status": "COMPLETED", "result": "MFA re-enrolled." }`. Returns `200` with the updated Action.

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | invalid value or empty body |
| 401 / 403 | | as section 3.2 |
| 404 | `NOT_FOUND` | unknown Ticket or action, or the action belongs to another Ticket |
| 409 | `CONFLICT` | action is Completed or Cancelled, status change not allowed, invalid assignee |
| 500 | `SERVER_ERROR` | unexpected error |

There is no `DELETE` route for actions. (FR-04, FR-05, AC-04, AC-05, AC-06)

### 3.4 `GET /tickets/:id/actions` (REQUESTER, own Ticket)

Same response as section 3.1, with all fields. Another Requester's Ticket gets `404`. IT Staff and Administrators get `403` (they use section 3.1). There are no Requester write routes. (FR-07, AC-08)

## 4. Status History

`GET /staff/tickets/:id/history` (IT_STAFF, ADMIN) and `GET /tickets/:id/history` (REQUESTER, own Ticket) return:

`{ "items": [ { "id": 1, "fromStatus": "OPEN", "toStatus": "IN_PROGRESS", "changedBy": { "id": 6, "name": "Priya Nair", "role": "IT_STAFF" }, "changedAt": "..." } ] }`

- Rows are ordered by `changedAt` and then `id`. A Ticket with no changes returns `[]`.
- Errors: `401`; `403` for the wrong role; `404` for an unknown Ticket or another Requester's Ticket; `500`.
- There are no update or delete routes. (FR-10, AC-13)

## 5. Ticket Handling (changed)

### 5.1 `GET /staff/tickets/:id` and `GET /tickets/:id`

Both return the Lab 3 response plus `resolvedAt` (date-time or null). The staff response also has `version`.

### 5.2 `PATCH /staff/tickets/:id`

| Field | Type | Required | Rule |
|---|---|---|---|
| `expectedVersion` | integer | yes (new) | must equal the Ticket `version` |
| `ownerId` | integer or null | at least one of the two | as Lab 3 |
| `itPriority` | `LOW`, `MEDIUM`, `HIGH` | at least one of the two | as Lab 3 |

Returns `200` with the Lab 3 fields plus the new `version`.

Errors: `400` (missing `expectedVersion` or invalid values); `401`; `403`; `404`; `409 STALE_UPDATE` (version does not match); `409 CONFLICT` (invalid owner, as Lab 3); `500`. (FR-13, AC-16)

### 5.3 `POST /staff/tickets/:id/status`

| Field | Type | Required | Rule |
|---|---|---|---|
| `status` | TicketStatus | yes | as Lab 3 |
| `confirm` | boolean | for Resolved, Closed, Cancelled | `true` |
| `expectedVersion` | integer | yes (new) | must equal the Ticket `version` |

Example body: `{ "status": "RESOLVED", "confirm": true, "expectedVersion": 2 }`.

The backend checks the transition matrix and owner as in Lab 3, then the resolution gate for Resolved and for Closed from Resolved (BR-13). On success it sets the status, increases `version`, sets or clears `resolvedAt` (BR-14), and writes one history row (BR-15).

`200 { "id": 2, "currentStatus": "RESOLVED", "updatedAt": "...", "resolvedAt": "...", "version": 3 }`

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | invalid status, no confirmation, missing `expectedVersion` |
| 401 / 403 / 404 | | as Lab 3 (a Requester gets `403`) |
| 409 | `STALE_UPDATE` | `expectedVersion` does not match |
| 409 | `CONFLICT` | transition not allowed, same status, no owner |
| 409 | `OPEN_ACTIONS_EXIST` | the Ticket still has a Planned or In Progress action |
| 500 | `SERVER_ERROR` | unexpected error |

Messages: `STALE_UPDATE` is "This ticket was changed by someone else. Reload to see the latest version." and `OPEN_ACTIONS_EXIST` is "Complete or cancel all open actions before resolving or closing." The same `STALE_UPDATE` body is returned by section 5.2.

(FR-08, FR-09, FR-10, FR-13, AC-10 to AC-13, AC-16)

## 6. List Filter

`GET /tickets` (My Tickets) and `GET /staff/tickets` (Ticket Queue) accept one new optional parameter:

| Parameter | Value | Meaning |
|---|---|---|
| `statusGroup` | `active` | status is New, Open, In Progress, Waiting for Requester, or Reopened |

- With `status`, both must match.
- Any other value gets `400` with `fields.statusGroup`.
- All other parameters and the response shape stay as Lab 3.
- Example: `GET /api/staff/tickets?ownerId=unassigned&statusGroup=active` gives `totalItems: 3`, and Jennifer's `GET /api/tickets?statusGroup=active` gives `totalItems: 3`. (FR-16, AC-22, AC-23)

## 7. Dashboards

### 7.1 `GET /dashboard/requester` (REQUESTER only)

There are no query parameters. A `requesterId` parameter is ignored (BR-20). Example for Jennifer:

```json
{ "openTickets": 3, "waitingForMe": 0,
  "recentlyUpdated": [ { "id": 13, "ticketNumber": "TKT-2026-900013", "summary": "Laptop keyboard key stuck", "currentStatus": "RESOLVED", "updatedAt": "..." } ],
  "recentlyResolved": [ { "id": 13, "ticketNumber": "TKT-2026-900013", "summary": "Laptop keyboard key stuck", "currentStatus": "RESOLVED", "resolvedAt": "..." } ] }
```

The lists are shortened here. David gets `waitingForMe: 0` and `recentlyResolved: []`.

Errors: `401`; `403` for IT Staff or Administrator; `500`. (FR-14, AC-02, AC-18, AC-19)

### 7.2 `GET /staff/dashboard` (IT_STAFF, ADMIN)

Both roles get the same shape with no user counts (BR-21). A Requester gets `403`. Example for Priya:

```json
{ "unassigned": 3, "myOpenTickets": 2, "myOpenActions": 1,
  "myOpenActionsList": [ { "actionId": 1, "ticketId": 2, "ticketNumber": "TKT-2026-900002", "description": "Clean the printer paper-path sensor.", "status": "PLANNED", "actionAt": "..." } ],
  "countsByStatus": { "NEW": 2, "OPEN": 3, "IN_PROGRESS": 2, "WAITING_FOR_REQUESTER": 1, "RESOLVED": 2, "CLOSED": 1, "REOPENED": 1, "CANCELLED": 1 },
  "recentlyUpdated": [ { "id": 13, "ticketNumber": "TKT-2026-900013", "summary": "Laptop keyboard key stuck", "currentStatus": "RESOLVED", "owner": { "id": 8, "name": "Elena Rossi" }, "updatedAt": "..." } ] }
```

For Elena, `myOpenActions` is `0` and `myOpenActionsList` is `[]`.

Errors: `401`; `403` for a Requester; `500`. (FR-15, AC-20, AC-21)

## 8. Dashboard Contract

- **Time zone and boundaries:** times are stored in UTC. "Recent" means from now minus 7 days up to now. The UI shows dates in Asia/Bangkok.
- **List size and order:** at most 5 rows, newest first, except `myOpenActionsList`, which is oldest Action Date/Time first.
- **Empty behaviour:** counts are `0` and lists are `[]` with `200`. The UI shows the empty text.
- **Calculation:** the backend runs the Prisma queries below. Tests run the same query and compare.

Names used: `ACTIVE = [NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED]`, `OPEN_ACTION = [PLANNED, IN_PROGRESS]`, `since = now minus 7 days`.

| Metric | Prisma query (short) | Drill-down |
|---|---|---|
| `openTickets` | `ticket.count({ where: { requesterId: me, currentStatus: { in: ACTIVE } } })` | My Tickets `statusGroup=active` |
| `waitingForMe` | `ticket.count({ where: { requesterId: me, currentStatus: "WAITING_FOR_REQUESTER" } })` | My Tickets `status=WAITING_FOR_REQUESTER` |
| Requester `recentlyUpdated` | `ticket.findMany({ where: { requesterId: me, updatedAt: { gte: since } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5 })` | Ticket Detail |
| `recentlyResolved` | `ticket.findMany({ where: { requesterId: me, resolvedAt: { gte: since } }, orderBy: [{ resolvedAt: "desc" }, { id: "desc" }], take: 5 })` | Ticket Detail |
| `unassigned` | `ticket.count({ where: { ownerId: null, currentStatus: { in: ACTIVE } } })` | Ticket Queue `ownerId=unassigned&statusGroup=active` |
| `myOpenTickets` | `ticket.count({ where: { ownerId: me, currentStatus: { in: ACTIVE } } })` | Ticket Queue `ownerId=<me>&statusGroup=active` |
| `myOpenActions` | `actionTaken.count({ where: { assignedToId: me, status: { in: OPEN_ACTION } } })` | none (the list is on the dashboard) |
| `myOpenActionsList` | `actionTaken.findMany({ where: <as myOpenActions>, orderBy: [{ actionAt: "asc" }, { id: "asc" }], take: 5 })` | Ticket Detail of the action's Ticket |
| `countsByStatus` | `ticket.groupBy({ by: ["currentStatus"], _count: true })`, missing statuses as `0` | Ticket Queue `status=<STATUS>` |
| Staff `recentlyUpdated` | as the Requester one without `requesterId` | Ticket Detail; "View all" Ticket Queue `sort=updatedAt&direction=desc` |

For every count with a drill-down, the target list's `totalItems` equals the count (BR-24).

## 9. Status Codes

| HTTP | Code | Used for |
|---|---|---|
| 200 | | successful read or update |
| 201 | | action created |
| 400 | `VALIDATION_ERROR` | invalid body or query value, missing confirmation or `expectedVersion` |
| 401 | `UNAUTHENTICATED` | no valid session |
| 403 | `FORBIDDEN` | role not allowed |
| 403 | `PASSWORD_CHANGE_REQUIRED` | initial password not changed yet (Lab 3) |
| 404 | `NOT_FOUND` | missing, or another Requester's Ticket |
| 409 | `CONFLICT` | business rule broken (message says which) |
| 409 | `OPEN_ACTIONS_EXIST` | **new**: resolution gate (BR-13) |
| 409 | `STALE_UPDATE` | **new**: `expectedVersion` does not match (BR-18) |
| 500 | `SERVER_ERROR` | unexpected error, generic message |
