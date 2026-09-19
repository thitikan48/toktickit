# TokTickIT — Lab 3 API Specification

---

## 1. Authentication

### 1.1 Login
* **Method:** `POST`
* **Path:** `/api/auth/login`
* **Authentication:** None
* **Description:** Authenticates a user using email and password. The server creates a server-side session and sets the session identifier using an HTTP-only, SameSite cookie.

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

#### Response — 200 OK
```json
{
  "user": {
    "id": "user-id",
    "name": "Example User",
    "email": "user@example.com",
    "role": "REQUESTER",
    "isActive": true,
    "mustChangePassword": true
  }
}
```

#### Errors
* **400 Bad Request** — Invalid or missing input.
* **401 Unauthorized** — Invalid credentials or inactive user.

---

### 1.2 Logout
* **Method:** `POST`
* **Path:** `/api/auth/logout`
* **Authentication:** Authenticated user
* **Description:** Invalidates the current server-side session.

#### Response — 204 No Content
*No response body.*

#### Errors
* **401 Unauthorized** — No valid session.

---

### 1.3 Current User
* **Method:** `GET`
* **Path:** `/api/auth/me`
* **Authentication:** Authenticated user
* **Description:** Returns the user represented by the current authenticated session.

#### Response — 200 OK
```json
{
  "id": "user-id",
  "name": "Example User",
  "email": "user@example.com",
  "role": "REQUESTER",
  "isActive": true,
  "mustChangePassword": false
}
```

#### Errors
* **401 Unauthorized** — No valid session.

---

### 1.4 Change Password
* **Method:** `POST`
* **Path:** `/api/auth/change-password`
* **Authentication:** Authenticated user
* **Description:** Changes the password of the current user. A successful change sets `mustChangePassword` to `false`.

#### Request Body
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

#### Response — 200 OK
```json
{
  "user": {
    "id": "user-id",
    "name": "Example User",
    "email": "user@example.com",
    "role": "REQUESTER",
    "isActive": true,
    "mustChangePassword": false
  }
}
```

#### Errors
* **400 Bad Request** — Invalid input.
* **401 Unauthorized** — No valid session or current password is incorrect.

---

## 2. Requester Ticket APIs

> The existing Lab 2 Ticket and Attachment APIs are preserved. Lab 3 adds authentication and backend authorization.  
> The Requester identity is derived from the authenticated session and must not be supplied by the client as the authority for ownership.

### 2.1 List Tickets
* **Method:** `GET`
* **Path:** `/api/tickets`
* **Authentication:** Requester
* **Description:** Returns Tickets belonging to the authenticated Requester. Existing Lab 2 query parameters and response format are preserved.

#### Response — 200 OK
```json
[
  {
    "id": "ticket-id",
    "title": "Cannot connect to Wi-Fi",
    "description": "The laptop cannot connect to the office Wi-Fi.",
    "status": "NEW"
  }
]
```

#### Errors
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — User is not allowed to perform the operation.

---

### 2.2 Get Ticket
* **Method:** `GET`
* **Path:** `/api/tickets/{ticketId}`
* **Authentication:** Authenticated user
* **Description:** Returns Ticket Detail according to authorization rules. Requesters may view their own Tickets. IT Staff may view Ticket Detail as part of the IT Staff workflow. Administrators may access Ticket Detail only for explicit actions (changing IT Priority and adding Internal Notes).
  * Internal Notes are returned only when authorized.
  * The response must not expose actions or data outside the user's permissions.

#### Response — 200 OK
```json
{
  "id": "ticket-id",
  "title": "Cannot connect to Wi-Fi",
  "description": "The laptop cannot connect to the office Wi-Fi.",
  "status": "OPEN",
  "requestedPriority": "HIGH",
  "itPriority": "HIGH",
  "requester": {
    "id": "requester-id",
    "name": "Example Requester"
  },
  "owner": null,
  "attachments": [],
  "comments": []
}
```

#### Errors
* **401 Unauthorized** — No valid session.
* **404 Not Found** — Ticket does not exist or is not accessible to the authenticated user.

---

### 2.3 Create Ticket
* **Method:** `POST`
* **Path:** `/api/tickets`
* **Authentication:** Requester
* **Description:** Creates a Ticket for the authenticated Requester. Follows the existing Lab 2 API format. Identity is obtained from the authenticated session.

#### Response — 201 Created
Returns the created Ticket.

#### Errors
* **400 Bad Request** — Invalid input.
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — User is not allowed to create a Ticket.

---

### 2.4 Update Ticket
* **Method:** `PUT`
* **Path:** `/api/tickets/{ticketId}`
* **Authentication:** Requester
* **Description:** Updates an owned Ticket according to existing Lab 2 API behavior.

#### Response — 200 OK
Returns the updated Ticket.

#### Errors
* **400 Bad Request** — Invalid input.
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — Ticket is not owned by the authenticated Requester.
* **404 Not Found** — Ticket does not exist or is not accessible.

---

### 2.5 Attachments
* Existing Lab 2 Attachment endpoints are preserved (paths, request, and response formats remain unchanged).
* All Attachment operations require authentication and server-side ownership/authorization checks.
* No new Attachment behavior is introduced by Lab 3.

#### Errors
* **400 Bad Request** — Invalid request.
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — Not authorized.
* **404 Not Found** — Resource does not exist or is not accessible.

---

## 3. Comments and Problem Resolution

### 3.1 Add Public Comment
* **Method:** `POST`
* **Path:** `/api/tickets/{ticketId}/comments`
* **Authentication:** Requester or IT Staff
* **Description:** Adds a Public Comment to a Ticket. `authorId` and `createdAt` are generated by the server.

#### Request Body
```json
{
  "content": "I have tried restarting the device."
}
```

#### Response — 201 Created
```json
{
  "id": "comment-id",
  "ticketId": "ticket-id",
  "authorId": "user-id",
  "type": "PUBLIC",
  "content": "I have tried restarting the device.",
  "createdAt": "2026-01-01T10:00:00Z"
}
```

#### Validation
* `content` is required.
* Whitespace-only content is rejected.
* Maximum length: 1,000 characters.
* Content is plain text.

#### Errors
* **400 Bad Request** — Invalid content.
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — User is not allowed to comment.
* **404 Not Found** — Ticket does not exist or is not accessible.

---

### 3.2 Problem Appears Resolved
* **Method:** `POST`
* **Path:** `/api/tickets/{ticketId}/problem-resolved`
* **Authentication:** Requester
* **Description:** Records that the Requester indicates the problem appears to be resolved. This action does **not** directly change the Ticket status to `RESOLVED` or `CLOSED`.

#### Request Body
*No request body.*

#### Response — 200 OK
Returns the updated or recorded problem-resolution state according to the implementation.

#### Errors
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — User does not own the Ticket.
* **404 Not Found** — Ticket does not exist or is not accessible.

---

## 4. IT Staff APIs

### 4.1 Ticket Queue
* **Method:** `GET`
* **Path:** `/api/tickets/queue`
* **Authentication:** IT Staff
* **Description:** Returns the shared IT Ticket Queue.

#### Query Parameters (All optional)
* `search`
* `status`
* `priority`
* `ownerId`
* `sortBy`
* `sortOrder`
* `page`
* `pageSize`

#### Example
`GET /api/tickets/queue?search=wifi&status=OPEN&sortBy=createdAt&sortOrder=desc&page=1&pageSize=20`

#### Response — 200 OK
```json
{
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "items": [
    {
      "id": "ticket-id",
      "title": "Cannot connect to Wi-Fi",
      "status": "OPEN",
      "requestedPriority": "HIGH",
      "itPriority": "HIGH",
      "owner": null
    }
  ]
}
```

#### Errors
* **400 Bad Request** — Invalid query parameter.
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — User is not IT Staff.

---

### 4.2 Claim / Assign / Reassign Ticket
* **Method:** `PATCH`
* **Path:** `/api/tickets/{ticketId}/owner`
* **Authentication:** IT Staff
* **Description:** Assigns or reassigns the primary Owner of a Ticket. The selected Owner must be an active IT Staff or Administrator. Only IT Staff may perform this operation.

#### Request Body
```json
{
  "ownerId": "user-id"
}
```

#### Response — 200 OK
Returns the updated Ticket.

#### Errors
* **400 Bad Request** — Invalid owner or request.
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — User is not IT Staff.
* **404 Not Found** — Ticket does not exist or is not accessible.

---

### 4.3 Change IT Priority
* **Method:** `PATCH`
* **Path:** `/api/tickets/{ticketId}/it-priority`
* **Authentication:** IT Staff or Administrator
* **Description:** Changes the IT Priority of a Ticket. The Requested Priority remains unchanged.

#### Request Body
```json
{
  "itPriority": "HIGH"
}
```

#### Response — 200 OK
```json
{
  "id": "ticket-id",
  "requestedPriority": "HIGH",
  "itPriority": "HIGH"
}
```

#### Errors
* **400 Bad Request** — Invalid priority.
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — User is not authorized.
* **404 Not Found** — Ticket does not exist or is not accessible.

---

### 4.4 Change Ticket Status
* **Method:** `PATCH`
* **Path:** `/api/tickets/{ticketId}/status`
* **Authentication:** IT Staff
* **Description:** Changes a Ticket's status according to the transition rules in `specification.md`.

#### Allowed Status Values
`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`

#### Request Body
```json
{
  "status": "IN_PROGRESS"
}
```

#### Response — 200 OK
Returns the updated Ticket.

#### Errors
* **400 Bad Request** — Invalid status or invalid transition.
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — User is not IT Staff.
* **404 Not Found** — Ticket does not exist or is not accessible.

---

### 4.5 Add Internal Note
* **Method:** `POST`
* **Path:** `/api/tickets/{ticketId}/notes`
* **Authentication:** IT Staff or Administrator
* **Description:** Adds an Internal Note to a Ticket. `authorId` and `createdAt` are generated by the server.

#### Request Body
```json
{
  "content": "Checked the network configuration."
}
```

#### Response — 201 Created
```json
{
  "id": "note-id",
  "ticketId": "ticket-id",
  "authorId": "user-id",
  "content": "Checked the network configuration.",
  "createdAt": "2026-01-01T10:00:00Z"
}
```

#### Validation
* `content` is required.
* Whitespace-only content is rejected.
* Maximum length: 1,000 characters.
* Content is plain text.

#### Errors
* **400 Bad Request** — Invalid content.
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — User is not authorized.
* **404 Not Found** — Ticket does not exist or is not accessible.

---

## 5. Administrator APIs

### 5.1 List Users
* **Method:** `GET`
* **Path:** `/api/users`
* **Authentication:** Administrator
* **Description:** Returns Users for the User Management screen. `search` searches by name or email. `role` is an optional filter.
* *Note:* Pagination, multi-column sorting, and multiple simultaneous filters are not required for Lab 3.

#### Response — 200 OK
```json
{
  "users": [
    {
      "id": "user-id",
      "name": "Alice Example",
      "email": "alice@example.com",
      "role": "REQUESTER",
      "isActive": true,
      "mustChangePassword": true
    }
  ]
}
```

#### Errors
* **400 Bad Request** — Invalid query parameter.
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — User is not Administrator.

---

### 5.2 Create User
* **Method:** `POST`
* **Path:** `/api/users`
* **Authentication:** Administrator
* **Description:** Creates a User with exactly one role. The password is stored as a secure hash and is never returned.

#### Allowed Roles
`REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`

#### Request Body
```json
{
  "name": "Alice Example",
  "email": "alice@example.com",
  "role": "REQUESTER",
  "isActive": true,
  "initialPassword": "local-password"
}
```

#### Response — 201 Created
```json
{
  "id": "user-id",
  "name": "Alice Example",
  "email": "alice@example.com",
  "role": "REQUESTER",
  "isActive": true,
  "mustChangePassword": true
}
```

#### Errors
* **400 Bad Request** — Invalid input.
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — User is not Administrator.
* **409 Conflict** — Email already exists.

---

### 5.3 Update User
* **Method:** `PATCH`
* **Path:** `/api/users/{userId}`
* **Authentication:** Administrator
* **Description:** Updates a user's name, email, role, or activation state.

#### Request Body
```json
{
  "name": "Alice Example",
  "email": "alice@example.com",
  "role": "IT_STAFF",
  "isActive": true
}
```

#### Response — 200 OK
```json
{
  "id": "user-id",
  "name": "Alice Example",
  "email": "alice@example.com",
  "role": "IT_STAFF",
  "isActive": true,
  "mustChangePassword": false
}
```

#### Errors
* **400 Bad Request** — Invalid input.
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — User is not Administrator or operation violates protection rules.
* **404 Not Found** — User does not exist.
* **409 Conflict** — Email already exists.

---

### 5.4 Set Initial Password
* **Method:** `POST`
* **Path:** `/api/users/{userId}/initial-password`
* **Authentication:** Administrator
* **Description:** Sets a new initial password for a User. The password is stored as a secure hash and is never returned.

#### Request Body
```json
{
  "initialPassword": "new-local-password"
}
```

#### Response — 200 OK
```json
{
  "id": "user-id",
  "mustChangePassword": true
}
```

#### Errors
* **400 Bad Request** — Invalid password.
* **401 Unauthorized** — No valid session.
* **403 Forbidden** — User is not Administrator.
* **404 Not Found** — User does not exist.

---

## 6. Common API Rules

### 6.1 Authentication
* Protected endpoints require a valid server-side session.
* The session identifier is stored using an **HTTP-only, SameSite cookie**.
* Authentication tokens **must not** be stored in browser `localStorage`.

### 6.2 Authorization
* Authorization is enforced by the backend for every protected operation.
* The backend derives the current User from the authenticated session.
* Client-provided identity values **must not** override the authenticated User.
* Ownership, role, and permission checks are performed server-side.

### 6.3 Passwords
* Passwords must never be stored or returned as plaintext.
* Password storage uses a secure password hashing mechanism.

### 6.4 Comment and Note Content
Public Comments and Internal Notes:
* Must not be empty.
* Must not contain only whitespace.
* Maximum length: 1,000 characters.
* Stored as plain text.
* Rendered as plain text rather than HTML.

### 6.5 Error Response
API errors should use a consistent safe structure:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid."
  }
}
```
*The API must not expose passwords, password hashes, stack traces, or unnecessary protected-resource information.*

### 6.6 Common HTTP Status Codes

| Code | Status | Meaning |
| :--- | :--- | :--- |
| **200** | OK | Successful operation |
| **201** | Created | Resource created |
| **204** | No Content | Successful operation with no response body |
| **400** | Bad Request | Invalid input or validation failure |
| **401** | Unauthorized | Missing or invalid authentication |
| **403** | Forbidden | Authenticated but not authorized |
| **404** | Not Found | Resource not found or not accessible |
| **409** | Conflict | Resource conflict, such as duplicate email |
| **500** | Internal Server Error | Unexpected server error |

---

## 7. Lab 2 Compatibility
* Lab 2 Ticket and Attachment APIs remain available unless explicitly changed by this specification.
* Lab 3 changes the identity source from the temporary Development Requester selector to the authenticated User.
* Existing Ticket and Attachment data must remain accessible after migration.
* Retain exact Lab 2 Attachment endpoint paths and response formats rather than introducing new behavior.