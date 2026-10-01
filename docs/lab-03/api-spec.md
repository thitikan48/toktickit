# Lab 3 REST API Specification

> Implements `specification.md` (FR/BR/AC IDs referenced). Extends `docs/lab-02/api-spec.md`; only changes and additions are detailed, unchanged Lab 2 payload shapes are noted.

## 1. General Conventions

- **Base path:** `/api`. JSON bodies (`application/json`), except attachment upload (`multipart/form-data`). Timestamps are ISO 8601 UTC.
- **Authentication:** server session in an HttpOnly cookie `tokticit.sid` (`SameSite=Lax`, `Secure` in production, 30-minute rolling idle expiry, id regenerated at login). Session secret comes from `SESSION_SECRET` (environment only, never committed or sent to the client). The user is reloaded from the database on every request (BR-08).
- **CSRF (D-02):** all `POST/PATCH/PUT/DELETE` requests must send header `X-Requested-With: TokTickIT`; otherwise `403 CSRF_REJECTED`. CORS allows only the configured client origin with credentials.
- **Password-change gate (BR-02):** while `mustChangePassword = true`, every endpoint except `GET /auth/me`, `POST /auth/change-password`, `POST /auth/logout` returns `403 PASSWORD_CHANGE_REQUIRED`.
- **Check order on protected endpoints:** CSRF header → authenticated (`401`) → active user (`401`) → password-change gate (`403`) → role (`403`) → input validation (`400`) → resource visibility (`404`) → state rules (`409`).
- **Enums:** `role`: `REQUESTER | IT_STAFF | ADMIN`; `priority`: `LOW | MEDIUM | HIGH`; `status`: `NEW | OPEN | IN_PROGRESS | WAITING_FOR_REQUESTER | RESOLVED | CLOSED | REOPENED | CANCELLED`.
- **Error envelope** (unchanged from Lab 2):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "The request contains invalid or missing data.", "fields": { "email": "Enter a valid email address." } } }
```

`fields` appears only for `VALIDATION_ERROR`. Messages are generic and never include stack traces, SQL, file paths, or secrets.

### Status codes and error codes

| HTTP | `error.code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid/missing body field or query parameter; missing `confirm` |
| 401 | `UNAUTHENTICATED` | No/expired/invalid session, or user now inactive |
| 401 | `INVALID_CREDENTIALS` | Login failed (generic) |
| 403 | `ACCOUNT_INACTIVE` | Login with correct password on inactive account |
| 403 | `PASSWORD_CHANGE_REQUIRED` | Initial password not yet changed |
| 403 | `FORBIDDEN` | Authenticated but role not permitted |
| 403 | `CSRF_REJECTED` | Missing `X-Requested-With` header |
| 404 | `NOT_FOUND` | Missing **or not visible to caller** |
| 409 | `CONFLICT_*` codes below | State/safety rule violated |
| 410 | `ATTACHMENT_REMOVED` | Removed attachment download |
| 413 / 415 | `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE` | Attachment rules (Lab 2) |
| 500 | `INTERNAL_ERROR` | Unexpected failure; message "Something went wrong. Please try again." |

Conflict codes (HTTP 409): `INVALID_TRANSITION`, `OWNER_REQUIRED`, `ALREADY_OWNED`, `INVALID_ASSIGNEE`, `NOT_RESOLVABLE`, `EMAIL_TAKEN`, `CANNOT_DEACTIVATE_SELF`, `LAST_ADMIN_REQUIRED`, `TICKET_CLOSED_FOR_COMMENTS`.

### Shared response shapes

```jsonc
// UserSummary
{ "id": 7, "name": "Priya Nair", "role": "IT_STAFF", "isActive": true }
// Me
{ "id": 7, "name": "Priya Nair", "email": "priya.nair@example.com", "role": "IT_STAFF", "mustChangePassword": false }
```

`passwordHash` and passwords are never present in any response.

---

## 2. Authentication

### 2.1 `POST /api/auth/login` (public; CSRF header required)

Request: `{ "email": "priya.nair@example.com", "password": "ChangeMe123" }`

Validation: `email` non-empty string; `password` non-empty string (no policy check at login). Email is trimmed and lower-cased before lookup.

| Result | Response |
|---|---|
| Success (BR-01, AC-01) | `200` `{ "user": Me }` + `Set-Cookie: tokticit.sid`; session id regenerated; `lastLoginAt` updated |
| Missing fields | `400 VALIDATION_ERROR` |
| Unknown email or wrong password (BR-06) | `401 INVALID_CREDENTIALS`, message `Invalid email or password.` (dummy bcrypt compare for unknown email) |
| Inactive + correct password | `403 ACCOUNT_INACTIVE`, message `This account is inactive. Contact an administrator.`; no session |

If `mustChangePassword` is true the response is still `200` with `"mustChangePassword": true`; the client must then show Change Password.

### 2.2 `POST /api/auth/logout` (authenticated, allowed during password-change gate)

Destroys the session, clears the cookie. `204 No Content`. Without a session: `401 UNAUTHENTICATED`.

### 2.3 `GET /api/auth/me` (authenticated, allowed during gate)

`200` `{ "user": Me }`; otherwise `401 UNAUTHENTICATED`. Used by the client on load (D-12).

### 2.4 `POST /api/auth/change-password` (authenticated, allowed during gate)

Request: `{ "currentPassword": "ChangeMe123", "newPassword": "Sunrise2026" }`

Validation (BR-07): `currentPassword` must match; `newPassword` 8–72 characters, ≥1 letter and ≥1 digit, must differ from current. The confirmation field is checked in the client only.

| Result | Response |
|---|---|
| Success (AC-05) | `200` `{ "user": Me }` with `mustChangePassword: false`; new bcrypt hash stored; session id regenerated |
| Wrong current password | `400 VALIDATION_ERROR` `fields.currentPassword = "Current password is incorrect."` |
| Policy or same-as-current | `400 VALIDATION_ERROR` `fields.newPassword` |

---

## 3. Reference Data

`GET /api/categories`, `GET /api/related-systems`: shapes unchanged from Lab 2 (active entries only); now require authentication (any role). `GET /api/development-requesters` is **removed** (`404`).

---

## 4. Requester Ticket and Attachment Endpoints (Lab 2, now session-scoped)

Role: `REQUESTER` only, except where the table below says staff may also read (others get `403 FORBIDDEN`). Ownership comes from the session; a supplied `requesterId` in query, body, or form is ignored (BR-03, AC-08). A ticket or attachment owned by someone else returns `404 NOT_FOUND` (BR-11, AC-09).

| Method | Path | Change from Lab 2 |
|---|---|---|
| `POST` | `/api/tickets` | Body no longer has `requesterId`. Sets `ownerId = null`, `itPriority = requestedPriority`, `currentStatus = NEW`. `201` shape adds `itPriority`, `ownerId`, `requesterMarkedResolved`. |
| `GET` | `/api/tickets` | Same query (`search, categoryId, status, requestedPriority, sort, page, pageSize`); `status` now accepts all eight values; scoped to session user. Items add `itPriority`. |
| `GET` | `/api/tickets/:id` | Adds `itPriority`, `owner: UserSummary \| null`, `requesterMarkedResolved`, `requesterMarkedResolvedAt`. **Never** includes internal notes. |
| `GET` | `/api/tickets/:id/attachments` | Also allowed for `IT_STAFF`/`ADMIN` on any ticket. |
| `POST` | `/api/tickets/:id/attachments` | Owning Requester only; staff/admin `403`. |
| `GET` | `/api/attachments/:id/download` | Owning Requester, or `IT_STAFF`/`ADMIN` for any active attachment; removed → `410`. |
| `DELETE` | `/api/attachments/:id` | Owning Requester only (`reason` required, trimmed non-empty); staff/admin `403`. |

### 4.1 `POST /api/tickets/:id/appears-resolved` (Requester, owner)

No body. Allowed when status is `OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED` (BR-19).

`200` `{ "ticketId": 101, "requesterMarkedResolved": true, "requesterMarkedResolvedAt": "2026-10-02T08:00:00.000Z", "currentStatus": "OPEN" }` (idempotent: repeated call returns the same, timestamp not changed). Other status → `409 NOT_RESOLVABLE`. Never changes `currentStatus`.

---

## 5. Public Comments and Internal Notes

### 5.1 `GET /api/tickets/:id/comments`

Roles: owning `REQUESTER`, `IT_STAFF`, `ADMIN`. Returns `200`:

```json
{ "items": [ { "id": 31, "ticketId": 101, "body": "Please restart and retry.", "createdAt": "2026-10-02T07:30:00.000Z",
               "author": { "id": 7, "name": "Priya Nair", "role": "IT_STAFF" } } ] }
```

Ordered oldest first. Not-owned/unknown ticket for a Requester → `404`.

### 5.2 `POST /api/tickets/:id/comments`

Roles as above. Body `{ "body": "text" }`: trimmed, 1–2000 characters (`400 VALIDATION_ERROR` with `fields.body`). Author and `createdAt` come from the backend. A Requester posting on a `CLOSED` or `CANCELLED` ticket → `409 TICKET_CLOSED_FOR_COMMENTS`. `201` returns the created comment (shape above) and updates `Ticket.updatedAt`. No `PUT/PATCH/DELETE` exist (append-only, BR-20).

### 5.3 `GET /api/tickets/:id/internal-notes` and 5.4 `POST /api/tickets/:id/internal-notes`

Roles: `IT_STAFF`, `ADMIN` only. A `REQUESTER` receives `403 FORBIDDEN` with no note data, regardless of ticket (BR-21, AC-20). Shapes and validation identical to Public Comments (`body` 1–2000, oldest first, `201` on create). Unknown ticket → `404`.

---

## 6. IT Staff Ticket Operations

Roles for every `/api/staff/*` endpoint: `IT_STAFF`, `ADMIN`; `REQUESTER` → `403`.

### 6.1 `GET /api/staff/tickets` (Queue)

Query parameters (all optional; unknown or invalid values → `400 VALIDATION_ERROR` with `fields`, BR-24):

| Param | Values / behaviour |
|---|---|
| `search` | Trimmed, ≤100 chars; case-insensitive partial match on `ticketNumber`, `summary`, requester name |
| `status` | One status value |
| `itPriority` | `LOW\|MEDIUM\|HIGH` |
| `categoryId` | Positive integer of an existing category |
| `ownerId` | Positive integer, `unassigned`, or `me` |
| `sort` | `createdAt \| updatedAt \| itPriority \| ticketNumber \| currentStatus` |
| `direction` | `asc \| desc` (default `desc`; ignored when `sort` is absent) |
| `page` | Integer ≥1, default 1 (page beyond range returns empty `items`) |
| `pageSize` | `10 \| 25 \| 50`, default 10 |

Default order (no `sort`): `itPriority` desc, then `createdAt` asc. Ties broken by `id`.

`200`:

```json
{
  "items": [ {
    "id": 101, "ticketNumber": "TKT-2026-000101", "summary": "Laptop battery drains quickly",
    "category": { "id": 2, "name": "Hardware" }, "requester": { "id": 1, "name": "Jennifer Anderson" },
    "requestedPriority": "MEDIUM", "itPriority": "HIGH", "currentStatus": "OPEN",
    "owner": { "id": 7, "name": "Priya Nair", "role": "IT_STAFF", "isActive": true },
    "requesterMarkedResolved": false,
    "createdAt": "2026-10-01T03:00:00.000Z", "updatedAt": "2026-10-02T07:30:00.000Z" } ],
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5 },
  "counts": { "active": 30, "unassigned": 8, "assignedToMe": 6 }
}
```

`counts` are unfiltered simple queue counts (`active` = status not in `CLOSED, CANCELLED`).

### 6.2 `GET /api/staff/tickets/:id`

`200` returns all Lab 2 detail fields plus `requester: { id, name, email }`, `category`, `relatedSystem`, `requestedPriority`, `itPriority`, `currentStatus`, `owner`, `requesterMarkedResolved(+At)`, `allowedTransitions: Status[]` (computed from BR-16 for the current status), `createdAt`, `updatedAt`. Comments, notes, and attachments are fetched through their own endpoints. Unknown id → `404`.

### 6.3 `POST /api/staff/tickets/:id/claim`

No body. Unassigned → sets owner to caller. `200` `{ "id": 101, "owner": UserSummary, "updatedAt": "…" }`. Already owned (even by caller) → `409 ALREADY_OWNED`.

### 6.4 `PATCH /api/staff/tickets/:id/owner`

Body `{ "ownerId": 8 }` or `{ "ownerId": null }` (unassign). `ownerId` must be an integer or `null` (`400`). Target must exist, be active, and have role `IT_STAFF` or `ADMIN` (else `409 INVALID_ASSIGNEE`). Same owner as current → `200` unchanged. `200` same shape as claim (`owner` may be `null`).

### 6.5 `PATCH /api/staff/tickets/:id/it-priority`

Body `{ "itPriority": "HIGH" }` (enum, `400` otherwise). `200` `{ "id", "requestedPriority", "itPriority", "updatedAt" }`. `requestedPriority` is never modified.

### 6.6 `POST /api/staff/tickets/:id/status`

Body `{ "status": "RESOLVED", "confirm": true }`.

- `status` must be a valid enum value (`400`).
- `confirm: true` is required when `status` is `RESOLVED`, `CLOSED`, or `CANCELLED` (`400` with `fields.confirm`).
- Transition must be allowed by BR-16, else `409 INVALID_TRANSITION` (message includes current and requested status labels; includes same-status requests).
- Ticket must have an owner unless the target is `CANCELLED` (`409 OWNER_REQUIRED`).
- Moving to `REOPENED` clears `requesterMarkedResolved`.

`200` `{ "id": 101, "currentStatus": "RESOLVED", "allowedTransitions": ["CLOSED","REOPENED"], "updatedAt": "…" }`.

### 6.7 `GET /api/staff/assignees`

`200` `{ "items": [ UserSummary ] }`: active users with role `IT_STAFF` or `ADMIN`, ordered by name; used for the Owner dropdown.

---

## 7. Administrator User Management

Role: `ADMIN` only for all `/api/admin/*`; other roles `403 FORBIDDEN` (AC-27).

### 7.1 `GET /api/admin/users`

Query: `search` (trimmed, ≤100; case-insensitive partial on name or email), `role` (optional, one role; invalid value → `400`). No pagination (spec §3.2). Ordered by name then id.

`200` `{ "items": [ { "id": 1, "name": "Jennifer Anderson", "email": "jennifer.anderson@example.com", "role": "REQUESTER", "isActive": true, "mustChangePassword": false, "createdAt": "…" } ] }`

### 7.2 `POST /api/admin/users`

Body `{ "name": "New Person", "email": "new.person@example.com", "role": "IT_STAFF", "isActive": true, "initialPassword": "Temp1234" }`

Validation: name 2–100 (trimmed); email valid, ≤254, trimmed + lower-cased; `role` in enum; `isActive` boolean (default `true` if omitted); `initialPassword` meets the password policy. Duplicate email → `409 EMAIL_TAKEN` (`fields.email`). `201` returns the user object of 7.1 with `mustChangePassword: true`; the password is not echoed.

### 7.3 `PATCH /api/admin/users/:id`

Body: any subset of `name`, `email`, `role`, `isActive` (same validation; empty body → `400`; unknown keys → `400`). Rules:

- Duplicate email (other user) → `409 EMAIL_TAKEN`.
- `isActive: false` on the caller's own id → `409 CANNOT_DEACTIVATE_SELF`.
- Deactivating or changing the role away from `ADMIN` for the last active Administrator → `409 LAST_ADMIN_REQUIRED`.
- Unknown id → `404`.

`200` returns the updated user. Changes apply to the user's next request (BR-08, BR-32).

### 7.4 `POST /api/admin/users/:id/initial-password`

Body `{ "initialPassword": "Another1234" }` (password policy). Stores a new bcrypt hash, sets `mustChangePassword = true`. `200` `{ "id": 5, "mustChangePassword": true }`. Unknown id → `404`. Works for any user including the caller (the caller is then gated on their next request).

There is no user delete endpoint (`DELETE /api/admin/users/:id` → `404`).

---

## 8. Authorization Summary by Endpoint

| Endpoint group | Requester | IT Staff | Admin | Unauthenticated |
|---|---|---|---|---|
| `/auth/login` | public | public | public | allowed |
| `/auth/logout`, `/auth/me`, `/auth/change-password` | ✓ | ✓ | ✓ | 401 |
| `/categories`, `/related-systems` | ✓ | ✓ | ✓ | 401 |
| `/tickets` (create, list, detail), attachment upload/delete | own | 403 | 403 | 401 |
| `/tickets/:id/attachments` (list), `/attachments/:id/download` | own | ✓ | ✓ | 401 |
| `/tickets/:id/comments` | own | ✓ | ✓ | 401 |
| `/tickets/:id/appears-resolved` | own | 403 | 403 | 401 |
| `/tickets/:id/internal-notes` | 403 | ✓ | ✓ | 401 |
| `/staff/*` | 403 | ✓ | ✓ | 401 |
| `/admin/*` | 403 | 403 | ✓ | 401 |

## 9. Requirement Traceability

Auth: FR-01–05 / AC-01–07 · Requester: FR-07–11 / AC-08–10, 12 · Queue and ticket operations: FR-12–18 / AC-13–21 · Admin: FR-19–23 / AC-22–27 · Failure behaviour: FR-24 / AC-29.
