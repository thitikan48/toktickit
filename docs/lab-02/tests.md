# Lab 2 Test Plan and Traceability

## 1. Test Strategy

Testing for Lab 2 adheres to **Test-Driven Development (TDD)** and **Test-Driven Design (Test DD)** principles. Test cases are derived directly from the engineering contract (`docs/lab-02/specification.md`, `api-spec.md`, and `ui-spec.md`) prior to and during feature implementation.

The testing pyramid spans six verification layers:

1. **Unit Tests:** Verify business logic such as Ticket Number format and validation behavior. Where no standalone unit file exists, the related behavior is verified through API tests.

2. **API / Integration Tests:** Verify Express endpoints with Supertest against PostgreSQL/Prisma, validating status codes, payload shapes, filter logic, and ownership enforcement (`403 Forbidden`).

3. **UI Component Tests:** Verify React component states (loading, empty, validation, busy, error) and user interactions with Vitest and React Testing Library.

4. **UI Style Tests:** Verify Zen Green styling, layout hierarchy, readable states, and responsive behavior through component assertions and visual inspection.

5. **Accessibility Tests:** Verify form labels, roles, keyboard-accessible controls, and readable feedback through component tests and manual inspection.

6. **End-to-End (E2E) & Responsive Tests:** Use Playwright for the main Requester workflow and visual inspection across Desktop, Tablet, and Mobile viewports.

---

## 2. Planned Tests

| Test ID | Level | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| **UNIT-01** | Unit / API | AC-01 | Ticket Number generator produces valid formatted strings | Returns non-empty string in format `TKT-YYYY-XXXXXX` | Covered by `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| **API-01** | API | AC-01 | Create ticket with valid data | HTTP `201`; record persisted; unique Ticket Number returned; status `NEW` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| **API-02** | API | AC-03 | GET `/api/development-requesters` excludes inactive users | HTTP `200`; only records with `isActive = true` returned | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| **API-03** | API | AC-05 | Reject ticket submission with missing required fields or invalid lengths | HTTP `400 Bad Request`; structured error envelope returned | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| **API-04** | API | AC-04 | Requester B attempts direct access to Requester A's ticket | HTTP `403 Forbidden`; ticket data not returned | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| **API-05** | API | AC-06 | GET `/api/tickets` returns only tickets belonging to active `requesterId` | HTTP `200`; all items belong strictly to requesting user | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-06** | API | AC-07 | Search tickets by Ticket Number or Summary | HTTP `200`; returns only matching tickets owned by Requester | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-07** | API | AC-07 | Filter tickets by Category ID | HTTP `200`; returns only owned tickets matching specified Category | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-08** | API | AC-07 | Filter tickets by Current Status (`NEW`) | HTTP `200`; returns only owned tickets matching specified status | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-09** | API | AC-07 | Filter tickets by Requested Priority (`LOW`, `MEDIUM`, `HIGH`) | HTTP `200`; returns only owned tickets matching specified priority | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-10** | API | AC-07 | Sort tickets by Created Date (`asc` and `desc`) | HTTP `200`; results sorted chronologically as requested | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-11** | API | AC-07 | Paginate ticket results (`page`, `pageSize`) | HTTP `200`; correct page items and pagination metadata returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-12** | API | AC-08 | Query tickets for a requester with zero tickets | HTTP `200`; empty ticket result returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-13** | API | AC-09 | Query tickets with filters that yield no matches | HTTP `200`; empty result returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-14** | API | AC-10 | Upload valid permitted attachment (JPG/PNG/WEBP/PDF ≤ 5 MB) | HTTP `201`; attachment metadata created with `isRemoved: false` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-15** | API | AC-11 | Reject attachment with unsupported MIME type | HTTP `415 Unsupported Media Type`; file rejected | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-16** | API | AC-11 | Reject attachment exceeding 5 MB in size | HTTP `413 Payload Too Large`; file rejected | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-17** | API | AC-11 | Reject upload when ticket already has 5 active attachments | HTTP `400 Bad Request`; sixth active file rejected | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-18** | API | AC-12 | Soft-remove attachment with mandatory removal reason | HTTP `200`; `isRemoved: true`, reason and timestamp persisted | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-19** | API | AC-12 | Reject blank removal reason | Empty or whitespace-only reason is rejected | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-20** | API | AC-12 | Accept short non-empty removal reason | Non-empty trimmed reason is accepted | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-21** | API | AC-12 | Attempt download of a soft-removed attachment | HTTP `410 Gone`; file download blocked | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-22** | API | AC-04 | Cross-requester attachment access attempt | HTTP `403 Forbidden`; unauthorized action blocked | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **UI-01** | UI | AC-02 | Access requester view when no requester identity is selected | Development Requester Selection screen is displayed | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| **UI-02** | UI | AC-03 | Requester selector loads active Development Requesters | Active Requesters are available in the selector | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| **UI-03** | UI | AC-13 | Show selected Requester and allow changing Requester | Selected Requester is shown and Change Requester returns to selection | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| **UI-04** | UI | AC-14 | Show Requester loading state | Loading indicator appears while Requester data is loading | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| **UI-05** | UI | AC-14 | Show safe Requester-loading error state | Error feedback and Retry action are displayed | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| **UI-06** | UI | AC-05 | Submit Create Ticket with invalid/empty fields | Field-level error messages display and invalid submission is blocked | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **UI-07** | UI | AC-01 | Submit valid Create Ticket form | Success state displays generated Ticket Number | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **UI-08** | UI | AC-14 | Backend error during Ticket creation | Error feedback appears and entered form values are preserved | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **UI-09** | UI | BR-17, AC-01 | Ticket submission state and duplicate-submit protection | Submit action is disabled while request is processing | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **UI-10** | UI | AC-06 | Render My Tickets list | Owned Ticket information is displayed | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-11** | UI | AC-08 | Render My Tickets empty state | Empty-state message is displayed | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-12** | UI | AC-14 | My Tickets API failure | Safe failure feedback is displayed | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-13** | UI | AC-07 | Search My Tickets | Search value is included in the Ticket query | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-14** | UI | AC-07 | Filter and sort My Tickets | Category, Status, Priority, and Sort parameters are applied | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-15** | UI | AC-07 | My Tickets pagination | Next page requests correct pagination parameters | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-16** | UI | AC-13 | Change active Development Requester | Ticket data reloads using the new Requester | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-17** | UI | AC-06 | Provide Open action for Ticket | Ticket result includes an Open action | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-18** | UI | AC-11 | User selects an invalid Attachment type | Validation feedback appears and invalid file is excluded | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| **UI-19** | UI | AC-10 | Upload a valid Attachment | Attachment upload succeeds and UI state updates | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| **UI-20** | UI | AC-12 | Soft-remove Attachment via confirmation | Attachment becomes removed after confirmation with a reason | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| **UI-21** | UI | AC-12 | Attempt removal without reason | Validation message requires a removal reason | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| **UI-22** | UI | AC-12 | Use a short non-empty removal reason | Short non-empty reason is accepted | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| **UI-23** | UI | AC-11 | Render owned Ticket Detail | Read-only Ticket information is displayed | `client/tests/lab-02/TicketDetail.test.tsx` | Pass |
| **UI-24** | UI | AC-04 | Ticket Detail forbidden/not-found behavior | Safe ownership/error state is displayed | `client/tests/lab-02/TicketDetail.test.tsx` | Pass |
| **UI-25** | UI | AC-10, AC-12 | Ticket Detail Attachment section | Attachment metadata and available actions are displayed | `client/tests/lab-02/TicketDetail.test.tsx` | Pass |
| **STYLE-01** | Style / Visual | AC-15, AC-16 | Zen Green design system conformance | Required Zen Green colors, readable states, and layout hierarchy verified | Visual inspection | Pass |
| **STYLE-02** | Style / Visual | AC-15 | Visual consistency across screens | Status and Attachment states remain visually consistent | Visual inspection | Pass |
| **A11Y-01** | A11y | AC-16 | Keyboard navigation, labels, and roles | Controls remain labeled and keyboard accessible | Component tests + manual verification | Pass |
| **RESP-01** | Responsive | AC-15 | Create Ticket responsiveness across viewports | Desktop, Tablet, and Mobile remain usable without horizontal overflow | Responsive visual verification | Pass |
| **RESP-02** | Responsive | AC-15 | My Tickets responsive table-to-card transition | Desktop/Tablet show table; Mobile (`< 768px`) shows stacked cards | Responsive visual verification | Pass |
| **RESP-03** | Responsive | AC-15 | Ticket Detail responsiveness across viewports | Read-only information and Attachment controls remain usable | Responsive visual verification | Pass |
| **E2E-01** | E2E | AC-01, AC-06, AC-11 | Complete user flow: select requester, create ticket, find it, and open Ticket Detail | Ticket is created with number, appears in My Tickets, and opens successfully | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| **E2E-02** | E2E / API / UI | AC-04, AC-13 | Multi-user isolation and requester switching | Covered by ownership API tests and Requester-switching UI tests | Existing API/UI suites | Pass |
| **E2E-03** | E2E / API / UI | AC-10, AC-12 | Attachment lifecycle | Upload, soft removal, reason retention, and blocked removed download are verified | Existing Attachment API/UI suites | Pass |
| **E2E-04** | E2E / UI | AC-14 | Backend error handling and form retention | Safe error handling and input retention are verified | Existing UI tests | Pass |
| **E2E-05** | E2E / UI | BR-18, AC-14 | Attachment upload fails after Ticket creation succeeds | Ticket remains saved and Attachment failure is reported | Existing Create Ticket UI behavior | Pass |

---

## 3. Acceptance-Criterion Traceability Matrix

Every Acceptance Criterion defined in `docs/lab-02/specification.md` is mapped to one or more verification items:

| Acceptance Criterion | Planned / Executed Tests |
|---|---|
| **AC-01** (Creation & Number Generation) | `UNIT-01`, `API-01`, `UI-07`, `UI-09`, `E2E-01` |
| **AC-02** (Selector Prompt on Entry) | `UI-01` |
| **AC-03** (Active-Only Requester Filter) | `API-02`, `UI-02` |
| **AC-04** (Ownership Enforcement & Cross-User Protection) | `API-04`, `API-22`, `UI-24`, `E2E-02` |
| **AC-05** (Field Validation & Rejection) | `API-03`, `UI-06` |
| **AC-06** (My Tickets Ownership Partitioning) | `API-05`, `UI-10`, `E2E-01` |
| **AC-07** (Search, Filter, Sort, Pagination within Partition) | `API-06`, `API-07`, `API-08`, `API-09`, `API-10`, `API-11`, `UI-13`, `UI-14`, `UI-15` |
| **AC-08** (Empty State) | `API-12`, `UI-11` |
| **AC-09** (No Results State) | `API-13`, My Tickets visual verification |
| **AC-10** (Valid Attachment Upload) | `API-14`, `UI-19`, `UI-25`, `E2E-03` |
| **AC-11** (Attachment Validation: Type, Size, Limit) | `API-15`, `API-16`, `API-17`, `UI-18` |
| **AC-12** (Soft Removal, Reason, Blocked Download) | `API-18`, `API-19`, `API-20`, `API-21`, `UI-20`, `UI-21`, `UI-22`, `E2E-03` |
| **AC-13** (Requester Switching & State Reload) | `UI-03`, `UI-16`, `E2E-02` |
| **AC-14** (Error Resilience & Form Retention) | `UI-04`, `UI-05`, `UI-08`, `UI-12`, `E2E-04`, `E2E-05` |
| **AC-15** (Responsive Layouts & Visual Consistency) | `STYLE-01`, `STYLE-02`, `RESP-01`, `RESP-02`, `RESP-03` |
| **AC-16** (Accessibility & Keyboard Usability) | `A11Y-01`, component-level labels and roles |

---

## 4. Responsive and Visual Checklist

Cross-checked against `docs/lab-02/ui-spec.md` at Desktop, Tablet, and Mobile sizes.

Representative inspection sizes:

- Desktop: `1440 × 900`
- Tablet: `768 × 1024`
- Mobile: `375 × 812`

### 4.1 Desktop Viewport (`≥ 992px`)

- [x] Content centered with sensible maximum width.
- [x] Create Ticket uses multi-column layout for classification fields.
- [x] My Tickets displays the desktop Ticket table.
- [x] Ticket Detail clearly separates read-only metadata from Attachments.
- [x] Zero clipped labels, overlapping validation text, or hidden buttons.

### 4.2 Tablet Viewport (`768px–991px`)

- [x] Form fields adapt without clipping.
- [x] Summary and Description remain readable.
- [x] Filters adapt without overlapping controls.
- [x] My Tickets table remains usable.
- [x] Zero unintended horizontal page scrolling.

### 4.3 Mobile Viewport (`< 768px`)

- [x] Form controls stack vertically where required.
- [x] My Tickets switches from the data table to responsive Ticket cards.
- [x] Ticket cards show readable Ticket information and an `Open` action.
- [x] Attachment filenames wrap without overflowing container bounds.
- [x] Required actions remain visible and usable.
- [x] Zero horizontal page scrolling at `375px` width.

### 4.4 Visual Style and Token Compliance

- [x] Primary Green `#006B3C` applied to app header and primary actions.
- [x] Secondary Green `#0B7A46` and Pale Green `#EAF6EF` used consistently with the Zen Green design.
- [x] Page background uses `#F5F7F6`.
- [x] Validation feedback is readable and placed near the related input.
- [x] Ticket status indicators remain visually consistent.
- [x] Removed Attachments are visually distinguishable from active Attachments.

---

## 5. Test Execution Commands

Run all test suites from their respective directories.

### Backend API and Integration Tests

```bash
cd server
npm test -- --run
```

Latest full result:

- 6 test files passed
- 23 tests passed
- 0 failed

### Frontend UI Component Tests

```bash
cd client
npm test -- --run
```

Latest full result:

- 6 test files passed
- 28 tests passed
- 0 failed

### End-to-End Playwright Test

From the repository root:

```bash
npx playwright test
```

Latest result:

- 1 test passed
- 0 failed

---

## 6. Final Results Summary

| Test Level | Result | Failed | Status |
|---|---:|---:|---|
| **Backend Test Suite** | 23 passed | 0 | Pass |
| **Frontend Test Suite** | 28 passed | 0 | Pass |
| **Playwright E2E** | 1 passed | 0 | Pass |
| **Responsive & Visual Verification** | Verified across Desktop, Tablet, and Mobile | 0 | Pass |

The Backend and Frontend totals include retained Lab 1 tests.

For Lab 2 specifically:

- Server Lab 2 tests: **21 passed**
- Client Lab 2 tests: **27 passed**
- Playwright Lab 2 E2E: **1 passed**
- Responsive and visual verification: **Pass**

No current automated or visual verification failures remain.

---

## 7. Known Limitations and Deferred Scope

- **Authentication:** Password validation, sessions, JWT tokens, and real authentication are deferred to Lab 3.
- **IT Staff Queues:** Ticket reassignment, IT Priority updates, and status transitions beyond `NEW` are excluded.
- **Collaboration:** Public Comments, Internal Notes, Service Actions, Event Log, and Resolution Summary are outside the Lab 2 scope.
- **Separate Test Files:** Standalone `ticket-number.unit.test.ts`, `ui-style.test.tsx`, `accessibility.test.tsx`, and `responsive.spec.ts` files were not added. Their related verification is covered by the implemented API/UI suites, Playwright workflow, and completed manual visual/responsive verification.