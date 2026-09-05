# Lab 2 REST API Specification

## 1. General API Conventions

- **Base Path:** `/api`
- **Content-Type:** `application/json` for standard requests and responses; `multipart/form-data` exclusively for attachment file uploads.
- **Requester Context:** All requester-scoped endpoints require identification via the query parameter or body property `requesterId` (simulating active user session in Lab 2).
- **Backend Ownership Enforcement:** The backend must independently verify that the requested ticket or attachment belongs to the provided `requesterId`. The server responds with `403 Forbidden` if ownership does not match.
- **Timestamps:** Returned in ISO 8601 UTC format (e.g., `2026-09-05T10:00:00.000Z`).
- **Standardized Error Envelope:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid or missing data.",
    "fields": {
      "summary": "Summary must be between 5 and 120 characters."
    }
  }
}
```

When an error is not field-specific (e.g., `FORBIDDEN`, `NOT_FOUND`, `SERVER_ERROR`), the `fields` object is omitted.

---

## 2. Reference Data Endpoints

### 2.1 GET `/api/development-requesters`
Returns all active Development Requesters available for testing.

#### Response: `200 OK`
```json
[
  {
    "id": 1,
    "name": "Jennifer Anderson",
    "email": "jennifer.anderson@example.com"
  },
  {
    "id": 2,
    "name": "Michael Brown",
    "email": "michael.brown@example.com"
  }
]
```
- **Rules:** Only records where `isActive = true` are returned. Inactive records must be excluded.
- **Error:** `500 Internal Server Error`

---

### 2.2 GET `/api/categories`
Returns active Ticket Categories.

#### Response: `200 OK`
```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```
- **Rules:** Only categories with `isActive = true` are returned.
- **Error:** `500 Internal Server Error`

---

### 2.3 GET `/api/related-systems`
Returns active Related Systems.

#### Response: `200 OK`
```json
[
  { "id": 1, "name": "Email" },
  { "id": 2, "name": "Campus Wi-Fi" },
  { "id": 3, "name": "VPN" },
  { "id": 4, "name": "LEB2 App" },
  { "id": 5, "name": "Grade Submission App" },
  { "id": 6, "name": "Printer" },
  { "id": 7, "name": "Corporate Laptop" }
]
```
- **Rules:** Only related systems with `isActive = true` are returned.
- **Error:** `500 Internal Server Error`

---

## 3. Ticket Endpoints

### 3.1 POST `/api/tickets`
Creates a new support ticket under the active Development Requester.

#### Request Body
```json
{
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 7,
  "summary": "Laptop battery drains quickly",
  "description": "The laptop battery loses charge within 90 minutes even under light workload.",
  "requestedPriority": "MEDIUM"
}
```

#### Validation Constraints
- `requesterId`: Mandatory integer, must reference an existing active `RequesterUser`.
- `categoryId`: Mandatory integer, must reference an existing active `Category`.
- `relatedSystemId`: Mandatory integer, must reference an existing active `RelatedSystem`.
- `summary`: Mandatory string, trimmed, 5–120 characters.
- `description`: Mandatory string, trimmed, 10–4000 characters.
- `requestedPriority`: Mandatory enum, exactly one of `LOW`, `MEDIUM`, `HIGH`.

#### Response: `201 Created`
```json
{
  "id": 101,
  "ticketNumber": "TKT-2026-000101",
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 7,
  "summary": "Laptop battery drains quickly",
  "description": "The laptop battery loses charge within 90 minutes even under light workload.",
  "requestedPriority": "MEDIUM",
  "currentStatus": "NEW",
  "createdAt": "2026-09-05T10:00:00.000Z",
  "updatedAt": "2026-09-05T10:00:00.000Z"
}
```

#### Architectural Note on Attachments
Attachments selected during ticket creation are uploaded sequentially via `POST /api/tickets/:id/attachments` immediately after receiving the `201 Created` response. If an attachment upload fails, the ticket remains saved (BR-18).

#### Errors
- `400 Bad Request` — Validation failure (missing fields or invalid lengths).
- `404 Not Found` — Referenced `requesterId`, `categoryId`, or `relatedSystemId` does not exist or is inactive.
- `500 Internal Server Error` — Safe server failure.

---

### 3.2 GET `/api/tickets`
Retrieves a paginated list of tickets owned exclusively by the specified Requester, supporting search, filtering, and sorting.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `requesterId` | Integer | **Yes** | — | Active Development Requester ID |
| `search` | String | No | — | Partial search matching `ticketNumber`, `summary`, or `description` |
| `categoryId` | Integer | No | — | Filter by Category ID |
| `status` | String | No | — | Filter by `currentStatus` (e.g., `NEW`) |
| `priority` | String | No | — | Filter by `requestedPriority` (`LOW`, `MEDIUM`, `HIGH`) |
| `sortBy` | String | No | `createdAt` | Sort field (Lab 2 supports `createdAt`) |
| `sortDir` | String | No | `desc` | Sort direction (`asc` or `desc`) |
| `page` | Integer | No | `1` | 1-based page index |
| `pageSize` | Integer | No | `10` | Items per page (allowed: 5, 10, 25, 50) |

#### Response: `200 OK`
```json
{
  "items": [
    {
      "id": 101,
      "ticketNumber": "TKT-2026-000101",
      "summary": "Laptop battery drains quickly",
      "category": {
        "id": 2,
        "name": "Hardware"
      },
      "relatedSystem": {
        "id": 7,
        "name": "Corporate Laptop"
      },
      "requestedPriority": "MEDIUM",
      "currentStatus": "NEW",
      "createdAt": "2026-09-05T10:00:00.000Z",
      "updatedAt": "2026-09-05T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

#### Rules
- Results strictly contain tickets where `ticket.requesterId == query.requesterId`.
- If the requester has no tickets, `items` returns `[]` with `totalItems: 0`.
- If filters/search match no tickets, `items` returns `[]`.

#### Errors
- `400 Bad Request` — Missing `requesterId` or invalid query parameters.
- `404 Not Found` — Specified `requesterId` does not exist.
- `500 Internal Server Error`

---

### 3.3 GET `/api/tickets/:id`
Retrieves full details of a single ticket. Enforces requester ownership.

#### Query Parameter
- `requesterId` (Integer, **Required**): Current active requester context.

#### Response: `200 OK`
```json
{
  "id": 101,
  "ticketNumber": "TKT-2026-000101",
  "ticketDate": "2026-09-05T10:00:00.000Z",
  "requester": {
    "id": 1,
    "name": "Jennifer Anderson",
    "email": "jennifer.anderson@example.com"
  },
  "category": {
    "id": 2,
    "name": "Hardware"
  },
  "relatedSystem": {
    "id": 7,
    "name": "Corporate Laptop"
  },
  "summary": "Laptop battery drains quickly",
  "description": "The laptop battery loses charge within 90 minutes even under light workload.",
  "requestedPriority": "MEDIUM",
  "currentStatus": "NEW",
  "createdAt": "2026-09-05T10:00:00.000Z",
  "updatedAt": "2026-09-05T10:00:00.000Z"
}
```

#### Errors
- `400 Bad Request` — Missing `requesterId` parameter.
- `403 Forbidden` — Ticket exists but belongs to a different Requester.
- `404 Not Found` — Ticket does not exist.
- `500 Internal Server Error`

---

## 4. Attachment Endpoints

### 4.1 GET `/api/tickets/:id/attachments`
Retrieves attachment metadata for a ticket owned by the active Requester.

#### Query Parameter
- `requesterId` (Integer, **Required**)

#### Response: `200 OK`
```json
[
  {
    "id": 1,
    "ticketId": 101,
    "originalName": "battery-diagnostics.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 345200,
    "isRemoved": false,
    "removalReason": null,
    "removedAt": null,
    "createdAt": "2026-09-05T10:02:00.000Z"
  },
  {
    "id": 2,
    "ticketId": 101,
    "originalName": "battery-photo.png",
    "mimeType": "image/png",
    "sizeBytes": 1205000,
    "isRemoved": true,
    "removalReason": "Uploaded blurry photo by mistake",
    "removedAt": "2026-09-05T10:15:00.000Z",
    "createdAt": "2026-09-05T10:03:00.000Z"
  }
]
```

#### Rules
- Both active and soft-removed attachment metadata are returned to preserve the audit trail.
- Removed attachments show `isRemoved: true`, `removalReason`, and `removedAt`.

#### Errors
- `403 Forbidden` — Ticket belongs to another Requester.
- `404 Not Found` — Ticket does not exist.
- `500 Internal Server Error`

---

### 4.2 POST `/api/tickets/:id/attachments`
Uploads a single permitted file attachment to an owned ticket.

- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `requesterId`: Integer (Required)
  - `file`: Binary file stream (Required)

#### Validation Rules
- Supported MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- Maximum file size: 5 MB (5,242,880 bytes).
- Active limit: Maximum 5 active (`isRemoved = false`) attachments per ticket. Attempting to upload a 6th active attachment is rejected.
- Ticket ownership: Ticket must belong to `requesterId`.

#### Response: `201 Created`
```json
{
  "id": 3,
  "ticketId": 101,
  "originalName": "screenshot-power-settings.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 854000,
  "isRemoved": false,
  "createdAt": "2026-09-05T10:05:00.000Z"
}
```

#### Errors
- `400 Bad Request` — Missing file, active attachment limit (5) reached, or invalid requester ID.
- `403 Forbidden` — Ticket belongs to a different Requester.
- `404 Not Found` — Ticket does not exist.
- `413 Payload Too Large` — File size exceeds 5 MB.
- `415 Unsupported Media Type` — File format not in permitted list (JPG, PNG, WEBP, PDF).
- `500 Internal Server Error`

---

### 4.3 GET `/api/attachments/:id/download`
Downloads or previews an active attachment.

#### Query Parameter
- `requesterId` (Integer, **Required**)

#### Response: `200 OK`
- Returns binary stream with headers:
  - `Content-Type: <mimeType>`
  - `Content-Disposition: inline; filename="<originalName>"` (or `attachment` depending on client trigger)
  - `Content-Length: <sizeBytes>`

#### Errors
- `403 Forbidden` — Attachment belongs to a ticket owned by another Requester.
- `404 Not Found` — Attachment does not exist.
- `410 Gone` — Attachment has been soft-removed. Removed files cannot be downloaded or previewed.
- `500 Internal Server Error`

---

### 4.4 DELETE `/api/attachments/:id`
Performs a soft-removal on an attachment belonging to an owned ticket.

#### Request Body
```json
{
  "requesterId": 1,
  "removalReason": "The document contained obsolete battery serial numbers."
}
```

#### Validation Constraints
- `requesterId`: Mandatory integer.
- `removalReason`: Mandatory string, trimmed, 5–255 characters.

#### Response: `200 OK`
```json
{
  "id": 1,
  "ticketId": 101,
  "originalName": "battery-diagnostics.pdf",
  "isRemoved": true,
  "removalReason": "The document contained obsolete battery serial numbers.",
  "removedAt": "2026-09-05T10:20:00.000Z"
}
```

#### Errors
- `400 Bad Request` — Missing or empty `removalReason`.
- `403 Forbidden` — Attachment belongs to another Requester's ticket.
- `404 Not Found` — Attachment does not exist.
- `409 Conflict` — Attachment is already soft-removed.
- `500 Internal Server Error`

---

## 5. Security and Ownership Matrix

| Endpoint | Authorization Rule | Failure Response |
|---|---|---|
| `GET /api/tickets` | Partitioned strictly by `where: { requesterId }` | Empty array (zero cross-user leakage) |
| `GET /api/tickets/:id` | `ticket.requesterId === requesterId` | `403 Forbidden` |
| `POST /api/tickets/:id/attachments` | `ticket.requesterId === requesterId` | `403 Forbidden` |
| `GET /api/tickets/:id/attachments` | `ticket.requesterId === requesterId` | `403 Forbidden` |
| `GET /api/attachments/:id/download` | `attachment.ticket.requesterId === requesterId` | `403 Forbidden` |
| `DELETE /api/attachments/:id` | `attachment.ticket.requesterId === requesterId` | `403 Forbidden` |

All unauthorized attempts return a generic, safe response:
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not authorized to access this resource."
  }
}
```
Internal server stack traces, database table schemas, and absolute file-system storage paths are strictly withheld from all error responses.
