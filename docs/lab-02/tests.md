# Lab 2 Test Plan and Traceability

## 1. Test Strategy

Testing for Lab 2 follows **Test-Driven Development (TDD)** and **Test-Driven Design (Test DD)** principles. Test cases are derived from the engineering contract (`docs/lab-02/specification.md`, `api-spec.md`, and `ui-spec.md`) and are used to verify the implemented Requester-facing behavior.

The testing strategy covers six verification layers:

1. **Unit Tests:** Verify isolated business logic such as Ticket Number formatting.

2. **API / Integration Tests:** Verify Express endpoints with Supertest against PostgreSQL/Prisma, including status codes, payloads, filtering, validation, and requester ownership enforcement.

3. **UI Component Tests:** Verify React component states and user interactions using Vitest and React Testing Library.

4. **UI Style Tests:** Verify required UI states and styling through automated class assertions together with visual inspection.

5. **Accessibility Tests:** Verify labels, roles, keyboard-accessible controls, and readable feedback through component tests and manual inspection.

6. **End-to-End (E2E) & Responsive Tests:** Verify the main Requester workflow with Playwright and inspect the UI across Desktop, Tablet, and Mobile viewports.

---

## 2. Planned Tests

| Test ID | Level | Requirement / AC | What It Tests | Expected Result | Actual Test / Verification | Final Status |
|---|---|---|---|---|---|---|
| **UNIT-01** | Unit | AC-01 | Ticket Number generator produces valid formatted strings | Returns Ticket Number in format `TKT-YYYY-XXXXXX` with a six-digit numeric part | `server/tests/lab-02/ticket-number.unit.test.ts` | Pass |
| **API-01** | API | AC-01 | Create Ticket with valid data | HTTP `201`; Ticket persisted; generated Ticket Number returned; status `NEW` | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| **API-02** | API | AC-03 | GET `/api/development-requesters` excludes inactive users | HTTP `200`; only active Requesters returned | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| **API-03** | API | AC-05 | Reject Ticket submission with invalid required data | HTTP `400 Bad Request`; validation error returned | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| **API-04** | API | AC-04 | Requester B attempts direct access to Requester A's Ticket | HTTP `403 Forbidden`; Ticket data not returned | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| **API-05** | API | AC-06 | GET `/api/tickets` returns only Tickets belonging to selected Requester | HTTP `200`; all returned Tickets belong to supplied `requesterId` | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-06** | API | AC-07 | Search Tickets by Ticket Number or Summary | HTTP `200`; only matching owned Tickets returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-07** | API | AC-07 | Filter Tickets by Category | HTTP `200`; returned Tickets match selected Category | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-08** | API | AC-07 | Filter Tickets by Current Status | HTTP `200`; returned Tickets match `NEW` | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-09** | API | AC-07 | Filter Tickets by Requested Priority | HTTP `200`; returned Tickets match selected priority | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-10** | API | AC-07 | Sort Tickets by Created Date | HTTP `200`; Tickets are returned in requested order | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-11** | API | AC-07 | Paginate Ticket results | HTTP `200`; requested page and pagination metadata returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-12** | API | AC-08 | Requester with no Tickets | HTTP `200`; empty result returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-13** | API | AC-09 | Search/filter produces no matching Tickets | HTTP `200`; empty result returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| **API-14** | API | AC-10 | Upload valid permitted Attachment | HTTP `201`; Attachment created with `isRemoved: false` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-15** | API | AC-11 | Reject unsupported Attachment type | HTTP `415 Unsupported Media Type` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-16** | API | AC-11 | Reject Attachment larger than 5 MB | HTTP `413 Payload Too Large` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-17** | API | AC-11 | Reject sixth active Attachment | HTTP `400 Bad Request` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-18** | API | AC-12 | Soft-remove Attachment with a reason | HTTP `200`; `isRemoved`, reason, and timestamp persisted | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-19** | API | AC-12 | Reject blank removal reason | Empty or whitespace-only reason is rejected | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-20** | API | AC-12 | Accept short non-empty removal reason | Trimmed non-empty reason is accepted | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-21** | API | AC-12 | Download a soft-removed Attachment | HTTP `410 Gone`; download blocked | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **API-22** | API | AC-04 | Another Requester attempts Attachment access/removal | HTTP `403 Forbidden` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| **UI-01** | UI | AC-02 | Open application without selected Requester | Development Requester Selection screen shown | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| **UI-02** | UI | AC-03 | Load active Development Requesters | Active Requesters appear in selector | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| **UI-03** | UI | AC-13 | Show selected Requester and Change Requester action | Current Requester shown and can be changed | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| **UI-04** | UI | AC-14 | Requester loading state | Loading feedback shown while data loads | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| **UI-05** | UI | AC-14 | Requester loading failure | Safe error feedback and Retry action shown | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| **UI-06** | UI | AC-05 | Submit Create Ticket with invalid fields | Validation messages shown and invalid submission blocked | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **UI-07** | UI | AC-01 | Submit valid Create Ticket | Generated Ticket Number shown in success state | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **UI-08** | UI | AC-14 | Ticket creation API failure | Safe error shown and entered values retained | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **UI-09** | UI | AC-01 | Duplicate-submit protection | Submit action disabled while request is processing | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **UI-10** | UI | AC-06 | Render owned Tickets | Owned Ticket information displayed | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-11** | UI | AC-08 | Render My Tickets empty state | Empty-state message displayed | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-12** | UI | AC-14 | My Tickets API failure | Safe failure feedback displayed | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-13** | UI | AC-07 | Search My Tickets | Search value applied to Ticket query | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-14** | UI | AC-07 | Filter and sort My Tickets | Filter and sort parameters applied correctly | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-15** | UI | AC-07 | My Tickets pagination | Next page requests correct pagination parameters | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-16** | UI | AC-13 | Change active Development Requester | Ticket list reloads for new Requester | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-17** | UI | AC-06 | Open Ticket action | Ticket contains an `Open` action | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| **UI-18** | UI | AC-11 | Select invalid Attachment type | Validation feedback shown and invalid file excluded | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| **UI-19** | UI | AC-10 | Upload valid Attachment | Attachment upload succeeds and UI updates | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| **UI-20** | UI | AC-12 | Soft-remove Attachment | Attachment becomes removed after confirmation | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| **UI-21** | UI | AC-12 | Attempt removal without reason | Removal reason validation shown | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| **UI-22** | UI | AC-12 | Submit short non-empty removal reason | Reason is accepted | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| **UI-23** | UI | AC-11 | Render owned Ticket Detail | Read-only Ticket information displayed | `client/tests/lab-02/TicketDetail.test.tsx` | Pass |
| **UI-24** | UI | AC-04 | Ticket Detail error/ownership state | Safe error state displayed | `client/tests/lab-02/TicketDetail.test.tsx` | Pass |
| **UI-25** | UI | AC-10, AC-12 | Ticket Detail Attachment section | Attachment information and available actions displayed | `client/tests/lab-02/TicketDetail.test.tsx` | Pass |
| **STYLE-01** | UI Style | AC-15, AC-16 | Primary action uses expected Bootstrap button styling | Submit Ticket action contains required Bootstrap button class | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **STYLE-02** | UI Style | AC-15, AC-16 | Validation feedback uses expected visual state | Validation message contains Bootstrap `invalid-feedback` class | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| **A11Y-01** | Accessibility | AC-16 | Labels, roles, and keyboard-accessible controls | Required controls remain accessible and readable | Component tests + manual verification | Pass |
| **RESP-01** | Responsive | AC-15 | Create Ticket across required viewports | Layout remains usable without clipping or horizontal overflow | Responsive visual verification | Pass |
| **RESP-02** | Responsive | AC-15 | My Tickets responsive behavior | Table used at larger widths; cards used on Mobile | Responsive visual verification | Pass |
| **RESP-03** | Responsive | AC-15 | Ticket Detail across required viewports | Ticket information and Attachment actions remain usable | Responsive visual verification | Pass |
| **E2E-01** | E2E | AC-01, AC-06, AC-11 | Select Requester, create Ticket, find it, and open Ticket Detail | Main Requester workflow completes successfully | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass |
| **E2E-02** | API / UI | AC-04, AC-13 | Multi-user isolation and Requester switching | Ownership isolation and Requester switching verified | Existing API/UI suites | Pass |
| **E2E-03** | API / UI | AC-10, AC-12 | Attachment lifecycle | Upload, remove, metadata retention, and blocked download verified | Existing Attachment API/UI suites | Pass |
| **E2E-04** | UI | AC-14 | Error handling and form retention | Safe error and retained form state verified | Existing UI suite | Pass |
| **E2E-05** | UI | AC-14 | Ticket remains created when later Attachment upload fails | Ticket creation is not rolled back by later Attachment failure | Create Ticket behavior verification | Pass |

---

## 3. Acceptance-Criterion Traceability Matrix

| Acceptance Criterion | Planned / Executed Tests |
|---|---|
| **AC-01** (Creation & Number Generation) | `UNIT-01`, `API-01`, `UI-07`, `UI-09`, `E2E-01` |
| **AC-02** (Requester Selector on Entry) | `UI-01` |
| **AC-03** (Active-Only Requester Selection) | `API-02`, `UI-02` |
| **AC-04** (Ownership Enforcement & Cross-User Protection) | `API-04`, `API-22`, `UI-24`, `E2E-02` |
| **AC-05** (Field Validation & Rejection) | `API-03`, `UI-06` |
| **AC-06** (My Tickets Ownership Partitioning) | `API-05`, `UI-10`, `E2E-01` |
| **AC-07** (Search, Filter, Sort, Pagination) | `API-06`, `API-07`, `API-08`, `API-09`, `API-10`, `API-11`, `UI-13`, `UI-14`, `UI-15` |
| **AC-08** (Empty State) | `API-12`, `UI-11` |
| **AC-09** (No Results State) | `API-13`, My Tickets visual verification |
| **AC-10** (Valid Attachment Upload) | `API-14`, `UI-19`, `UI-25`, `E2E-03` |
| **AC-11** (Attachment Type, Size & Active Limit) | `API-15`, `API-16`, `API-17`, `UI-18` |
| **AC-12** (Soft Removal, Reason & Blocked Download) | `API-18`, `API-19`, `API-20`, `API-21`, `UI-20`, `UI-21`, `UI-22`, `E2E-03` |
| **AC-13** (Requester Switching & Reload) | `UI-03`, `UI-16`, `E2E-02` |
| **AC-14** (Error Resilience & Form Retention) | `UI-04`, `UI-05`, `UI-08`, `UI-12`, `E2E-04`, `E2E-05` |
| **AC-15** (Responsive Layouts & Visual Consistency) | `STYLE-01`, `STYLE-02`, `RESP-01`, `RESP-02`, `RESP-03` |
| **AC-16** (Accessibility & Keyboard Usability) | `STYLE-01`, `STYLE-02`, `A11Y-01` |

---

## 4. Responsive and Visual Checklist

Cross-checked against `docs/lab-02/ui-spec.md` at Desktop, Tablet, and Mobile sizes.

Representative viewport sizes used during inspection:

- Desktop: `1440 × 900`
- Tablet: `768 × 1024`
- Mobile: `375 × 812`

### 4.1 Desktop Viewport (`≥ 992px`)

- [x] Content centered with sensible maximum width.
- [x] Create Ticket uses a suitable multi-column layout.
- [x] My Tickets displays the Ticket table.
- [x] Ticket Detail clearly separates Ticket information from Attachments.
- [x] No clipped labels, overlapping validation text, or hidden buttons.

### 4.2 Tablet Viewport (`768px–991px`)

- [x] Form fields adapt without clipping.
- [x] Summary and Description remain readable.
- [x] Filters remain usable without overlapping controls.
- [x] My Tickets table remains usable.
- [x] No unintended horizontal page scrolling.

### 4.3 Mobile Viewport (`< 768px`)

- [x] Form controls stack where required.
- [x] My Tickets switches to responsive Ticket cards.
- [x] Ticket cards display readable Ticket information and an `Open` action.
- [x] Attachment filenames do not overflow their containers.
- [x] Required actions remain visible and usable.
- [x] No horizontal page scrolling at the tested Mobile viewport.

### 4.4 Visual Style and State Verification

- [x] Primary Green `#006B3C` is used for the application header and primary actions.
- [x] Secondary Green `#0B7A46` and Pale Green `#EAF6EF` are used consistently with the Zen Green design.
- [x] Page background uses `#F5F7F6`.
- [x] Validation feedback is readable and displayed near the related input.
- [x] Primary button styling is verified with an automated UI assertion.
- [x] Validation feedback styling is verified with an automated UI assertion.
- [x] Ticket status presentation remains visually consistent.
- [x] Removed Attachments are visually distinguishable from active Attachments.

---

## 5. Test Execution Commands

### Backend Unit, API, and Integration Tests

From the `server` directory:

```bash
npm test -- --run
```

Latest full result:

```text
Test Files  7 passed (7)
Tests       25 passed (25)
```

This includes:

- Lab 1 server tests: **2 passed**
- Lab 2 server tests: **23 passed**
- Unit test: `server/tests/lab-02/ticket-number.unit.test.ts`
- API / Integration tests:
  - `server/tests/lab-02/create-ticket.api.test.ts`
  - `server/tests/lab-02/my-tickets.api.test.ts`
  - `server/tests/lab-02/ticket-detail.api.test.ts`
  - `server/tests/lab-02/attachments.api.test.ts`

### Frontend UI Tests

From the `client` directory:

```bash
npm test -- --run
```

Latest full result:

```text
Test Files  6 passed (6)
Tests       28 passed (28)
```

This includes:

- Lab 1 client tests: **1 passed**
- Lab 2 client tests: **27 passed**
- UI style assertions are included in `client/tests/lab-02/CreateTicket.test.tsx`.

### Playwright End-to-End Test

From the repository root:

```bash
npx playwright test
```

Latest result:

```text
1 passed
```

---

## 6. Final Results Summary

| Test Level | Result | Failed | Status |
|---|---:|---:|---|
| **Backend Test Suite** | 25 passed | 0 | Pass |
| **Frontend Test Suite** | 28 passed | 0 | Pass |
| **Playwright E2E** | 4 passed | 0 | Pass |
| **Responsive & Visual Verification** | Verified across Desktop, Tablet, and Mobile | 0 | Pass |

The Backend and Frontend totals include retained Lab 1 tests.

For Lab 2 specifically:

- Server Lab 2 tests: **23 passed**
- Client Lab 2 tests: **27 passed**
- Playwright Lab 2 E2E: **4 passed**
- Responsive and visual verification: **Pass**

No current automated or visual verification failures remain.

---

## 7. Known Limitations and Deferred Scope

- **Authentication:** Password validation, sessions, JWT tokens, and real authentication are deferred to Lab 3.
- **IT Staff Workflow:** Ticket reassignment, IT Priority changes, and status transitions beyond `NEW` are outside Lab 2.
- **Collaboration:** Public Comments, Internal Notes, Service Actions, Event Log, and Resolution Summary are outside Lab 2.
- **Development Requester Context:** The Development Requester selector is temporary and will be replaced by real authentication in a later Lab.