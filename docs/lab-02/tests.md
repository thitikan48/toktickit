# Lab 2 Test Plan and Traceability

## 1. Test Strategy

Testing for Lab 2 adheres strictly to **Test-Driven Development (TDD)** and **Test-Driven Design (Test DD)** principles. Test cases are derived directly from the engineering contract (`docs/lab-02/specification.md`, `api-spec.md`, and `ui-spec.md`) prior to feature implementation.

The testing pyramid spans six distinct verification layers:
1. **Unit Tests:** Verify business logic isolation (e.g., ticket number format generation, validation constraints).
2. **API / Integration Tests:** Verify Express endpoints with Supertest against PostgreSQL/Prisma, validating status codes, payload shapes, filter logic, and ownership enforcement (`403 Forbidden`).
3. **UI Component Tests:** Verify React component states (loading, empty, validation, busy, error) and user interactions with Vitest and React Testing Library.
4. **UI Style Tests:** Verify CSS classes, Zen Green token compliance, focus states, badge colors, and layout hierarchies.
5. **Accessibility Tests:** Verify keyboard navigation, ARIA roles, and form labels.
6. **End-to-End (E2E) & Responsive Tests:** Run automated Playwright workflows across Desktop, Tablet, and Mobile viewports validating complete multi-requester user journeys.

---

## 2. Planned Tests

| Test ID | Level | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final Status |
|---|---|---|---|---|---|---|
| **UNIT-01** | Unit | AC-01 | Ticket Number generator produces valid formatted strings | Returns non-empty string in format `TKT-YYYY-XXXXXX` | `server/tests/lab-02/ticket-number.unit.test.ts` | Pending |
| **API-01** | API | AC-01 | Create ticket with valid data | HTTP `201`; record persisted; unique Ticket Number returned; status `NEW` | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| **API-02** | API | AC-03 | GET `/api/development-requesters` excludes inactive users | HTTP `200`; only records with `isActive = true` returned | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| **API-03** | API | AC-05 | Reject ticket submission with missing required fields or invalid lengths | HTTP `400 Bad Request`; structured error envelope returned; no record created | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| **API-04** | API | AC-04 | Requester B attempts direct access to Requester A's ticket | HTTP `403 Forbidden`; safe error envelope; zero ticket data leaked | `server/tests/lab-02/ticket-detail.api.test.ts` | Pending |
| **API-05** | API | AC-06 | GET `/api/tickets` returns only tickets belonging to active `requesterId` | HTTP `200`; all items belong strictly to requesting user | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| **API-06** | API | AC-07 | Search tickets by Number, Summary, or Description | HTTP `200`; returns only matching tickets owned by Requester | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| **API-07** | API | AC-07 | Filter tickets by Category ID | HTTP `200`; returns only owned tickets matching specified Category | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| **API-08** | API | AC-07 | Filter tickets by Current Status (`NEW`) | HTTP `200`; returns only owned tickets matching specified status | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| **API-09** | API | AC-07 | Filter tickets by Requested Priority (`LOW`, `MEDIUM`, `HIGH`) | HTTP `200`; returns only owned tickets matching specified priority | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| **API-10** | API | AC-07 | Sort tickets by Created Date (`asc` and `desc`) | HTTP `200`; results sorted chronologically as requested | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| **API-11** | API | AC-07 | Paginate ticket results (`page`, `pageSize`) | HTTP `200`; correct page items and accurate pagination metadata returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| **API-12** | API | AC-08 | Query tickets for a requester with zero tickets | HTTP `200`; `items: []`, `totalItems: 0` | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| **API-13** | API | AC-09 | Query tickets with filters that yield no matches | HTTP `200`; `items: []`, `totalItems: 0` | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| **API-14** | API | AC-10 | Upload valid permitted attachment (JPG/PNG/WEBP/PDF ≤ 5 MB) | HTTP `201`; attachment metadata created with `isRemoved: false` | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| **API-15** | API | AC-11 | Reject attachment with unsupported MIME type (e.g., .exe, .zip) | HTTP `415 Unsupported Media Type`; file not saved | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| **API-16** | API | AC-11 | Reject attachment exceeding 5 MB in size | HTTP `413 Payload Too Large`; file not saved | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| **API-17** | API | AC-11 | Reject upload when ticket already has 5 active attachments | HTTP `400 Bad Request`; file rejected due to active limit reached | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| **API-18** | API | AC-12 | Soft-remove attachment with mandatory removal reason | HTTP `200`; `isRemoved: true`, reason and timestamp persisted | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| **API-19** | API | AC-12 | Attempt download of a soft-removed attachment | HTTP `410 Gone`; file download blocked | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| **API-20** | API | AC-04 | Cross-requester attachment download or removal attempt | HTTP `403 Forbidden`; unauthorized action blocked | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| **UI-01** | UI | AC-02 | Access requester view when no requester identity is selected | Development Requester Selection screen is displayed | `client/tests/lab-02/RequesterSelection.test.tsx` | Pending |
| **UI-02** | UI | AC-03 | Requester selector displays loading and active-only accounts | Loading indicator appears; inactive account is absent from dropdown | `client/tests/lab-02/RequesterSelection.test.tsx` | Pending |
| **UI-03** | UI | AC-05 | Submit Create Ticket with invalid/empty fields | Field-level error messages display beneath inputs; submit blocked | `client/tests/lab-02/CreateTicket.test.tsx` | Pending |
| **UI-04** | UI | AC-01 | Submit valid Create Ticket form | Submit button enters busy state; success banner displays generated number | `client/tests/lab-02/CreateTicket.test.tsx` | Pending |
| **UI-05** | UI | AC-14 | Backend error during ticket creation | Error banner appears; user-entered form inputs are preserved | `client/tests/lab-02/CreateTicket.test.tsx` | Pending |
| **UI-06** | UI | AC-11 | User selects an oversized or invalid file in file picker | Validation warning renders immediately; file excluded from upload | `client/tests/lab-02/AttachmentSection.test.tsx` | Pending |
| **UI-07** | UI | AC-06 | Render My Tickets list | Displays only tickets matching the active Development Requester | `client/tests/lab-02/MyTickets.test.tsx` | Pending |
| **UI-08** | UI | AC-08 | Render My Tickets empty state | Displays empty-state illustration and `Create Ticket` action | `client/tests/lab-02/MyTickets.test.tsx` | Pending |
| **UI-09** | UI | AC-09 | Render My Tickets no-results state | Displays "No tickets match" message and `Clear Filters` button | `client/tests/lab-02/MyTickets.test.tsx` | Pending |
| **UI-10** | UI | AC-13 | Change active Development Requester via selector | Old ticket list unmounts; fresh ticket list loads for new requester | `client/tests/lab-02/MyTickets.test.tsx` | Pending |
| **UI-11** | UI | AC-12 | Soft-remove attachment via confirmation modal | Modal requires reason; on confirm, status updates to Removed and download disabled | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Pending |
| **UI-12** | UI | BR-17, AC-01 | Attempt another submission while the first request is processing | Submit remains disabled and only one creation request is sent | `client/tests/lab-02/CreateTicket.test.tsx` | Pending |
| **STYLE-01** | Style | AC-15, AC-16 | Zen Green design system conformance | Primary Green headers, read-only shading `#EEF3F0`, error red `#B42318` verified | `client/tests/lab-02/ui-style.test.tsx` | Pending |
| **STYLE-02** | Style | AC-15 | Badge consistency across screens | Priority and Status badges use identical tokens on list and detail views | `client/tests/lab-02/ui-style.test.tsx` | Pending |
| **A11Y-01** | A11y | AC-16 | Keyboard navigation and focus accessibility | All form inputs and buttons are focusable via Tab with visible focus ring | `client/tests/lab-02/accessibility.test.tsx` | Pending |
| **RESP-01** | Resp | AC-15 | Create Ticket responsiveness across viewports | Desktop (multi-column), Tablet (2-column), Mobile (single column stacked) verified | `e2e/lab-02/responsive.spec.ts` | Pending |
| **RESP-02** | Resp | AC-15 | My Tickets responsive table to cards transition | Desktop renders data table; Mobile (`< 768px`) switches to stacked cards without overflow | `e2e/lab-02/responsive.spec.ts` | Pending |
| **E2E-01** | E2E | AC-01, AC-06 | Complete user flow: select requester, create ticket, find in My Tickets | Ticket created with number and appears immediately in requester's ticket list | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |
| **E2E-02** | E2E | AC-04, AC-13 | Multi-user isolation: Requester switching and cross-user URL access | Requester A tickets invisible to Requester B; direct URL to Requester A ticket blocked | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |
| **E2E-03** | E2E | AC-10, AC-12 | Attachment lifecycle: add, download, soft-remove with reason, verify blocking | Active download succeeds; after soft-removal, download fails with 410 and reason shows | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |
| **E2E-04** | E2E | AC-14 | Backend resilience: simulated server failure preserves form inputs | Safe error shown; inputs remain intact upon server restart | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |
| **E2E-05** | E2E | BR-18, AC-14 | Attachment upload fails after Ticket creation succeeds | Ticket remains saved; failed attachment is absent; upload failure is shown | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |

---

## 3. Acceptance-Criterion Traceability Matrix

Every single Acceptance Criterion defined in `docs/lab-02/specification.md` is mapped to multiple verifying test cases:

| Acceptance Criterion | Planned Automated Tests |
|---|---|
| **AC-01** (Creation & Number Generation) | `UNIT-01`, `API-01`, `UI-04`, `UI-12`, `E2E-01` |
| **AC-02** (Selector Prompt on Entry) | `UI-01` |
| **AC-03** (Active-Only Requester Filter) | `API-02`, `UI-02` |
| **AC-04** (Ownership Enforcement & Cross-User Protection) | `API-04`, `API-20`, `E2E-02` |
| **AC-05** (Field Validation & Rejection) | `API-03`, `UI-03` |
| **AC-06** (My Tickets Ownership Partitioning) | `API-05`, `UI-07`, `E2E-01` |
| **AC-07** (Search, Filter, Sort, Pagination within Partition) | `API-06`, `API-07`, `API-08`, `API-09`, `API-10`, `API-11` |
| **AC-08** (Empty State) | `API-12`, `UI-08` |
| **AC-09** (No Results State) | `API-13`, `UI-09` |
| **AC-10** (Valid Attachment Upload) | `API-14`, `E2E-03` |
| **AC-11** (Attachment Validation: Type, Size, Limit) | `API-15`, `API-16`, `API-17`, `UI-06` |
| **AC-12** (Soft Removal, Reason, Blocked Download) | `API-18`, `API-19`, `UI-11`, `E2E-03` |
| **AC-13** (Requester Switching & State Reload) | `UI-10`, `E2E-02` |
| **AC-14** (Error Resilience & Form Retention) | `UI-05`, `E2E-04`, `E2E-05` |
| **AC-15** (Responsive Layouts & Visual Consistency) | `STYLE-01`, `STYLE-02`, `RESP-01`, `RESP-02` |
| **AC-16** (Accessibility & Keyboard Usability) | `STYLE-01`, `A11Y-01` |

---

## 4. Responsive and Visual Checklist

Cross-checked against `docs/lab-02/ui-spec.md` at Desktop (`1280px`), Tablet (`820px`), and Mobile (`375px`):

### 4.1 Desktop Viewport (`≥ 992px`)
- [ ] Content centered with max width 1200px.
- [ ] Create Ticket utilizes multi-column layout for classification fields.
- [ ] My Tickets displays full desktop data table with sortable headers.
- [ ] Ticket Detail clearly separates read-only metadata from attachments.
- [ ] Zero clipped labels, overlapping validation text, or misplaced buttons.

### 4.2 Tablet Viewport (`768px–991px`)
- [ ] Two-column layout cleanly adapts form fields without clipping.
- [ ] Summary and Description retain full card width.
- [ ] Filters toolbar stacks gracefully without overlapping controls.
- [ ] Zero unintended horizontal page scrolling.

### 4.3 Mobile Viewport (`< 768px`)
- [ ] Form controls stack vertically into a single column.
- [ ] My Tickets switches automatically from data table to responsive cards.
- [ ] Touch targets for all buttons, links, and dropdowns are ≥ 44px.
- [ ] Attachment filenames wrap gracefully without overflowing container bounds.
- [ ] Zero horizontal page scrolling at `375px` width.

### 4.4 Visual Style and Token Compliance
- [ ] Primary Green `#006B3C` applied to app header and primary actions.
- [ ] Secondary Green `#0B7A46` applied to active nav indicators and focus rings.
- [ ] Read-only fields styled with distinct `#EEF3F0` shading.
- [ ] Invalid fields show red borders with messages placed immediately below.
- [ ] Priority badges (`LOW`, `MEDIUM`, `HIGH`) and Status badge (`NEW`) are visually consistent.

---

## 5. Test Execution Commands

Run all test suites from their respective directories:

### Backend API and Unit Tests
```bash
cd server
npm test
```

### Frontend UI Component and Style Tests
```bash
cd client
npm test
```

### End-to-End and Responsive Playwright Tests
```bash
npx playwright test e2e/lab-02
```

---

## 6. Final Results Summary

*(Updated upon full integration and execution on `main`)*

| Test Level | Total Planned | Passed | Failed | Skipped | Status |
|---|---|---|---|---|---|
| **Unit Tests** | 1 | 0 | 0 | 0 | Pending Implementation |
| **API Integration Tests** | 20 | 0 | 0 | 0 | Pending Implementation |
| **UI Component Tests** | 12 | 0 | 0 | 0 | Pending Implementation |
| **UI Style & A11y Tests** | 3 | 0 | 0 | 0 | Pending Implementation |
| **Responsive & E2E Tests** | 7 | 0 | 0 | 0 | Pending Implementation |
| **Total** | **43** | **0** | **0** | **0** | **Pending** |

---

## 7. Known Limitations and Deferred Scope

- **Authentication:** Password validation, sessions, and JWT tokens are deferred to Lab 3.
- **IT Staff Queues:** Ticket reassignment, IT priority updates, and status transitions beyond `NEW` are excluded.
- **Collaboration:** Public Comments, Internal Notes, and Actions Taken will be introduced in later labs.
- **Test Status:** All test items are formally planned and will transition to `Pass` during the feature implementation phase.
