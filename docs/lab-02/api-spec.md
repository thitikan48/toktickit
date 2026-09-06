# Lab 2 REST API Specification

## 1. General API Conventions

- **Base Path:** `/api`
- **Content-Type:** `application/json` for standard requests and responses; `multipart/form-data` for Attachment file uploads.
- **Requester Context:** Requester-scoped endpoints use `requesterId` through the query string, request body, or multipart form data depending on the endpoint. This represents the selected Development Requester in Lab 2.
- **Backend Ownership Enforcement:** The backend independently verifies that the requested Ticket or Attachment belongs to the supplied `requesterId`. An existing record owned by another Requester is rejected with `403 Forbidden`.
- **Timestamps:** Returned in ISO 8601 UTC format, for example `2026-09-06T07:48:30.568Z`.
- **Standard Error Envelope:**

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

When an error is not field-specific, such as `FORBIDDEN`, `NOT_FOUND`, or a server error, the `fields` object may be omitted.

---

## 2. Reference Data Endpoints

### 2.1 GET `/api/development-requesters`

Returns active Development Requesters available for Lab 2 testing.

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

- **Rules:** Only records where `isActive = true` are returned. Inactive Requesters are excluded.

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

- **Rules:** Only Categories with `isActive = true` are returned.

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

- **Rules:** Only Related Systems with `isActive = true` are returned.

- **Error:** `500 Internal Server Error`

---

## 3. Ticket Endpoints

### 3.1 POST `/api/tickets`

Creates a new support Ticket for the selected Development Requester.

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

- `requesterId`: Required integer referencing an active `RequesterUser`.
- `categoryId`: Required integer referencing an active `Category`.
- `relatedSystemId`: Required integer referencing an active `RelatedSystem`.
- `summary`: Required string, trimmed, 5–120 characters.
- `description`: Required string, trimmed, 10–4000 characters.
- `requestedPriority`: Required value: `LOW`, `MEDIUM`, or `HIGH`.

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

Attachments selected during Ticket creation are uploaded after the Ticket receives a successful `201 Created` response using `POST /api/tickets/:id/attachments`.

If a later Attachment upload fails, the Ticket remains saved.

#### Errors

- `400 Bad Request` — Required fields are missing or invalid.
- `404 Not Found` — Referenced Requester, Category, or Related System cannot be used.
- `500 Internal Server Error` — Safe server failure.

---

### 3.2 GET `/api/tickets`

Retrieves a paginated list of Tickets owned by the specified Requester with search, filtering, and sorting.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `requesterId` | Integer | **Yes** | — | Selected Development Requester ID |
| `search` | String | No | — | Partial search matching Ticket Number or Summary |
| `categoryId` | Integer | No | — | Filter by Category ID |
| `status` | String | No | — | Filter by Current Status, currently `NEW` |
| `requestedPriority` | String | No | — | Filter by `LOW`, `MEDIUM`, or `HIGH` |
| `sort` | String | No | `createdAt_desc` | `createdAt_desc` or `createdAt_asc` |
| `page` | Integer | No | `1` | 1-based page index |
| `pageSize` | Integer | No | `10` | Number of Tickets requested per page |

#### Response: `200 OK`

```json
{
  "items": [
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
      "updatedAt": "2026-09-05T10:00:00.000Z",
      "category": {
        "id": 2,
        "name": "Hardware"
      }
    }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 1,
  "totalPages": 1
}
```

#### Rules

- Returned Tickets are restricted to the supplied `requesterId`.
- Search matches Ticket Number or Summary.
- Category, Status, and Requested Priority filters may be combined.
- Sorting supports newest-first and oldest-first Created Date order.
- If a Requester has no Tickets, `items` is empty and `totalItems` is `0`.
- If search or filters match no Tickets, `items` is empty.

#### Errors

- `400 Bad Request` — Missing `requesterId` or invalid query parameters.
- `404 Not Found` — Specified Requester does not exist.
- `500 Internal Server Error`

---

### 3.3 GET `/api/tickets/:id`

Retrieves full information for one Ticket and enforces Requester ownership.

#### Query Parameter

- `requesterId` (Integer, **Required**): Current Development Requester context.

#### Response: `200 OK`

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
  "updatedAt": "2026-09-05T10:00:00.000Z",
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
  }
}
```

`createdAt` is used as the Ticket Date shown by the Requester UI.

#### Errors

- `400 Bad Request` — Missing or invalid `requesterId`.
- `403 Forbidden` — Ticket exists but belongs to another Requester.
- `404 Not Found` — Ticket does not exist.
- `500 Internal Server Error`

---

## 4. Attachment Endpoints

### 4.1 GET `/api/tickets/:id/attachments`

Retrieves active and soft-removed Attachment metadata for a Ticket owned by the selected Requester.

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
    "removalReason": "Uploaded the wrong image",
    "removedAt": "2026-09-05T10:15:00.000Z",
    "createdAt": "2026-09-05T10:03:00.000Z"
  }
]
```

#### Rules

- Active and soft-removed Attachment metadata remain available.
- Removed Attachments have `isRemoved: true` with `removalReason` and `removedAt`.
- Removed Attachment files are not downloadable.

#### Errors

- `400 Bad Request` — Missing or invalid `requesterId`.
- `403 Forbidden` — Ticket belongs to another Requester.
- `404 Not Found` — Ticket does not exist.
- `500 Internal Server Error`

---

### 4.2 POST `/api/tickets/:id/attachments`

Uploads one permitted Attachment to an owned Ticket.

- **Content-Type:** `multipart/form-data`

#### Form Fields

- `requesterId`: Integer, required.
- `file`: Binary file, required.

#### Validation Rules

- Supported MIME types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `application/pdf`
- Maximum file size: 5 MB (`5,242,880` bytes).
- Maximum five active (`isRemoved = false`) Attachments per Ticket.
- The Ticket must belong to the supplied `requesterId`.

#### Response: `201 Created`

```json
{
  "id": 3,
  "ticketId": 101,
  "originalName": "screenshot-power-settings.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 854000,
  "isRemoved": false,
  "removalReason": null,
  "removedAt": null,
  "createdAt": "2026-09-05T10:05:00.000Z"
}
```

#### Errors

- `400 Bad Request` — Missing file, invalid Requester information, or maximum active Attachment count reached.
- `403 Forbidden` — Ticket belongs to another Requester.
- `404 Not Found` — Ticket does not exist.
- `413 Payload Too Large` — File exceeds 5 MB.
- `415 Unsupported Media Type` — File type is not permitted.
- `500 Internal Server Error`

---

### 4.3 GET `/api/attachments/:id/download`

Downloads an active Attachment belonging to an owned Ticket.

#### Query Parameter

- `requesterId` (Integer, **Required**)

#### Response: `200 OK`

Returns the binary file with appropriate headers, including:

- `Content-Type: <mimeType>`
- `Content-Disposition: attachment; filename*=UTF-8''<encodedOriginalName>`

The browser should treat this endpoint as a file download.

#### Errors

- `400 Bad Request` — Missing or invalid `requesterId`.
- `403 Forbidden` — Attachment belongs to another Requester's Ticket.
- `404 Not Found` — Attachment does not exist.
- `410 Gone` — Attachment has been soft-removed and can no longer be downloaded.
- `500 Internal Server Error`

---

### 4.4 DELETE `/api/attachments/:id`

Performs soft-removal of an Attachment belonging to an owned Ticket.

#### Request Body

```json
{
  "requesterId": 1,
  "removalReason": "Uploaded the wrong document"
}
```

#### Validation Constraints

- `requesterId`: Required integer.
- `removalReason`: Required string.
- `removalReason` is trimmed and must contain non-whitespace text.
- No additional Lab 2 minimum length is imposed on a non-empty removal reason.

#### Response: `200 OK`

```json
{
  "id": 1,
  "ticketId": 101,
  "originalName": "battery-diagnostics.pdf",
  "isRemoved": true,
  "removalReason": "Uploaded the wrong document",
  "removedAt": "2026-09-05T10:20:00.000Z"
}
```

#### Errors

- `400 Bad Request` — Missing or blank `removalReason`, or invalid Requester information.
- `403 Forbidden` — Attachment belongs to another Requester's Ticket.
- `404 Not Found` — Attachment does not exist.
- `409 Conflict` — Attachment is already soft-removed.
- `500 Internal Server Error`

---

## 5. Security and Ownership Matrix

| Endpoint | Ownership Rule | Failure Response |
|---|---|---|
| `GET /api/tickets` | Query is scoped by `requesterId` | Only the selected Requester's records are returned |
| `GET /api/tickets/:id` | `ticket.requesterId === requesterId` | `403 Forbidden` |
| `POST /api/tickets/:id/attachments` | `ticket.requesterId === requesterId` | `403 Forbidden` |
| `GET /api/tickets/:id/attachments` | `ticket.requesterId === requesterId` | `403 Forbidden` |
| `GET /api/attachments/:id/download` | `attachment.ticket.requesterId === requesterId` | `403 Forbidden` |
| `DELETE /api/attachments/:id` | `attachment.ticket.requesterId === requesterId` | `403 Forbidden` |

A forbidden request returns safe error information without exposing another Requester's Ticket or Attachment data.

Example:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not authorized to access this resource."
  }
}
```

Server errors must not expose internal stack traces, database credentials, or absolute upload storage paths to the client.