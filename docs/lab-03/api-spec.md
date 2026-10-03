# Lab 3 REST API Specification

## 1. Conventions

- **Base path:** `/api`. JSON bodies, except attachment upload (multipart). Timestamps are ISO 8601 UTC.
- **Authentication:** server session in an HttpOnly, SameSite=Lax cookie (`tokticit.sid`). It expires after 30 minutes of inactivity, a new session id is created at login, and logout destroys it. The secret is read from `SESSION_SECRET` (environment only). The user is re-read from the database on every request. **CSRF:** SameSite=Lax stops the cookie being sent on cross-site POST requests, and CORS allows only the client origin with credentials; no extra token is used in this lab.
- **Password-change requirement:** while the user must change the initial password, every endpoint except `GET /auth/me`, `POST /auth/change-password`, and `POST /auth/logout` returns `403 PASSWORD_CHANGE_REQUIRED`.
- **Check order:** logged in → active user → password-change requirement → role → validation → resource visibility → business rules.
- **Statuses:** `NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED`. **Priorities:** `LOW, MEDIUM, HIGH`. **Roles:** `REQUESTER, IT_STAFF, ADMIN`.
- **Error format** (as Lab 2): `{ "error": { "code": "...", "message": "...", "fields": { "field": "message" } } }`; `fields` only for validation errors. Messages are generic and never include stack traces, SQL, or secrets.

| HTTP | Code | Used for |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid body or query value, missing confirmation |
| 401 | `UNAUTHENTICATED` / `INVALID_CREDENTIALS` | No valid session or inactive user / failed login |
| 403 | `FORBIDDEN` | Role not permitted |
| 403 | `ACCOUNT_INACTIVE` | Login to an inactive account with the correct password |
| 403 | `PASSWORD_CHANGE_REQUIRED` | Initial password not yet changed |
| 404 | `NOT_FOUND` | Missing, or not visible to the caller |
| 409 | `CONFLICT` | Business rule violated (message explains which) |
| 500 | `SERVER_ERROR` | Unexpected error, generic message |

**Current user object** (`Me`): `{ "id", "name", "email", "role", "mustChangePassword" }`. Passwords and hashes are never returned.

## 2. Authentication

| Endpoint | Behaviour |
|---|---|
| `POST /auth/login` (public) | Body `{ email, password }` (both required; email trimmed and lower-cased). Success `200 { user: Me }` and sets the cookie. Wrong password or unknown email → `401 INVALID_CREDENTIALS` ("Invalid email or password."), identical for both. Inactive user with correct password → `403 ACCOUNT_INACTIVE`. If `mustChangePassword` is true the login still succeeds and the client shows Change Password. |
| `POST /auth/logout` | `204`; session destroyed. |
| `GET /auth/me` | `200 { user: Me }`, or `401`. |
| `POST /auth/change-password` | Body `{ currentPassword, newPassword }`. `newPassword`: 8–72 characters, at least one letter and one digit, different from the current one. Success `200 { user: Me }` with `mustChangePassword: false`. Wrong current password or policy failure → `400` with `fields.currentPassword` or `fields.newPassword`. |

## 3. Requester and Shared Endpoints

`GET /categories` and `GET /related-systems` keep their Lab 2 shape and now require login (any role). `GET /development-requesters` is removed.

Lab 2 ticket endpoints are Requester-only and scoped to the logged-in user:

| Endpoint | Change from Lab 2 |
|---|---|
| `POST /tickets` | No `requesterId`; any supplied value is ignored. New ticket has no owner and `itPriority = requestedPriority`. |
| `GET /tickets`, `GET /tickets/:id` | Scoped to the session user (query `requesterId` ignored). Responses add `itPriority`, `owner` (`{ id, name }` or null), and `requesterMarkedResolved`. Internal Notes are never included. |
| `POST /tickets/:id/attachments`, `DELETE /attachments/:id` | Owning Requester only. |
| `GET /tickets/:id/attachments`, `GET /attachments/:id/download` | Owning Requester, or IT Staff/Administrator for any ticket. Removed attachments still return `410`. |

A ticket or attachment that belongs to another Requester returns `404 NOT_FOUND`, the same as a missing one.

**`POST /tickets/:id/appears-resolved`** (Requester, own ticket, no body): sets `requesterMarkedResolved = true` and returns `200 { id, requesterMarkedResolved: true, currentStatus }`. Repeating it is harmless. If the ticket is Resolved, Closed, or Cancelled → `409 CONFLICT`. Status is never changed.

## 4. Comments and Internal Notes

| Endpoint | Roles | Behaviour |
|---|---|---|
| `GET /tickets/:id/comments` | Owning Requester, IT Staff, Administrator | `200 { items: [ { id, body, createdAt, author: { id, name, role } } ] }`, oldest first. |
| `POST /tickets/:id/comments` | same | Body `{ body }`, trimmed, 1–2000 characters (`400` with `fields.body` otherwise). Author and time set by the backend. `201` returns the new comment. |
| `GET /tickets/:id/internal-notes` | IT Staff, Administrator | Same shape as comments. |
| `POST /tickets/:id/internal-notes` | IT Staff, Administrator | Same rules as comments. |

A Requester calling the internal-notes endpoints gets `403` with no note data. There is no edit or delete endpoint for comments or notes. Posting a comment or note updates the ticket's `updatedAt`.

## 5. IT Staff Endpoints (`IT_STAFF`, `ADMIN`; Requester → `403`)

**`GET /staff/tickets`** (queue). Query parameters, all optional; invalid or unknown values return `400`:

| Parameter | Values |
|---|---|
| `search` | Partial, case-insensitive match on ticket number, summary, or requester name |
| `status` | One status value |
| `itPriority` | `LOW`, `MEDIUM`, `HIGH` |
| `categoryId` | Existing category id |
| `ownerId` | User id, or `unassigned` |
| `sort`, `direction` | `sort`: `createdAt`, `updatedAt`, `itPriority`; `direction`: `asc` or `desc` |
| `page` | Integer ≥ 1 (default 1; page size fixed at 10) |

Default order: IT Priority high first, then oldest first. Response (same pagination fields as the Lab 2 ticket list):

```json
{
  "items": [{
    "id": 101, "ticketNumber": "TKT-2026-000101", "summary": "Laptop battery drains quickly",
    "category": { "id": 2, "name": "Hardware" }, "requester": { "id": 1, "name": "Jennifer Anderson" },
    "requestedPriority": "MEDIUM", "itPriority": "HIGH", "currentStatus": "OPEN",
    "owner": { "id": 7, "name": "Priya Nair" }, "requesterMarkedResolved": false,
    "createdAt": "2026-10-01T03:00:00.000Z", "updatedAt": "2026-10-02T07:30:00.000Z"
  }],
  "page": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5
}
```

**`GET /staff/tickets/:id`**: full ticket detail (Lab 2 fields plus requester name and email, `itPriority`, `owner`, `requesterMarkedResolved`). Unknown id → `404`.

**`PATCH /staff/tickets/:id`**: body may contain `ownerId` and/or `itPriority`.
- `ownerId`: a user id, or `null` to unassign. The user must exist and be an active `IT_STAFF` or `ADMIN`, otherwise `409`. Claiming is the caller sending their own id; assigning, reassigning, and unassigning are all done with this same call and are allowed at any time.
- `itPriority`: `LOW`, `MEDIUM`, or `HIGH`. `requestedPriority` is never changed.
- Empty body or invalid values → `400`. Returns `200` with the updated `owner`, `requestedPriority`, `itPriority`, and `updatedAt`.

**`POST /staff/tickets/:id/status`**: body `{ "status": "RESOLVED", "confirm": true }`.
- `status` must be a valid status (`400`).
- `confirm: true` is required for `RESOLVED`, `CLOSED`, and `CANCELLED` (`400` otherwise).
- The change must follow the transition matrix in `specification.md` §5 (BR-13), otherwise `409`; same-status requests are `409`.
- The ticket needs an Owner unless the target is `CANCELLED` (`409`).
- Moving to `REOPENED` clears `requesterMarkedResolved`.
- Returns `200 { id, currentStatus, updatedAt }`.

**`GET /staff/assignees`**: `200 { items: [ { id, name, role } ] }` of active IT Staff and Administrator users, ordered by name, for the Owner dropdown.

## 6. Administrator Endpoints (`ADMIN` only; others → `403`)

| Endpoint | Behaviour |
|---|---|
| `GET /admin/users` | Optional `search` (partial, case-insensitive on name or email) and `role` (invalid value → `400`). Ordered by name, no pagination. Items: `{ id, name, email, role, isActive }`. |
| `POST /admin/users` | Body `{ name, email, role, isActive, initialPassword }`. Name 2–100 characters; valid, unique email (lower-cased); valid role; password follows the password policy. `201` returns the user (not the password); `mustChangePassword` is true. Duplicate email → `409`. |
| `PATCH /admin/users/:id` | Any of `name`, `email`, `role`, `isActive`, with the same validation. Duplicate email → `409`. Deactivating yourself → `409`. Deactivating or changing the role of the last active Administrator → `409`. Unknown id → `404`. Returns the updated user. |
| `POST /admin/users/:id/initial-password` | Body `{ initialPassword }` (password policy). Stores a new hash and sets `mustChangePassword` to true; the old password stops working. `200 { id, mustChangePassword: true }`. |

There is no delete endpoint. Changes affect the user's next request.

## 7. Authorization Summary

| Endpoint group | Requester | IT Staff | Administrator |
|---|---|---|---|
| `/auth/*` | Yes | Yes | Yes |
| `/categories`, `/related-systems` | Yes | Yes | Yes |
| `/tickets` (create, list, detail), attachment upload/remove, `appears-resolved` | Own | `403` | `403` |
| Attachment list/download, comments | Own tickets | Yes | Yes |
| Internal notes, `/staff/*` | `403` | Yes | Yes |
| `/admin/*` | `403` | `403` | Yes |

Calls without a valid session always return `401`.
