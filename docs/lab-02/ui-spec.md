# Lab 2 UI Specification

## 1. Visual Design System (Zen Green)

TokTickIT implements the **Zen Green Design System**, maintaining visual harmony and consistent component behavior across all screens.

### 1.1 Color Tokens

| Token Name | Hex Code | Purpose / Intended Usage |
|---|---|---|
| **Primary Green** | `#006B3C` | Application header, primary action buttons, brand accents, strong emphasis |
| **Secondary Green** | `#0B7A46` | Active navigation indicators, interactive accents, button hover states |
| **Pale Green** | `#EAF6EF` | Soft highlights, status badges, success-related backgrounds |
| **Page Background** | `#F5F7F6` | Main viewport canvas background |
| **Surface / Cards** | `#FFFFFF` | Form containers, modal dialogs, data table cards |
| **Border Neutral** | `#D6E0DA` | Input control borders, card dividers, table horizontal lines |
| **Main Text** | `#1F3328` | Primary typography, headers, table row content |
| **Muted Text** | `#66756D` | Subtitles, field hints, helper text, timestamps |
| **Read-only Shading** | `#EEF3F0` | Non-editable and system-generated field backgrounds |
| **Error** | `#B42318` | Validation messages, invalid input borders, destructive feedback |
| **Error Background** | `#FEF3F2` | Form-level error alert banners |
| **Warning** | `#B54708` | Warning indicators and informational warning badges |
| **Warning Background** | `#FFFAEB` | Warning alert callout panels |
| **Success** | `#067647` | Success text and confirmation indicators |
| **Success Background** | `#ECFDF3` | Success confirmation alert banners |

*Accessibility Rule:* Color is not used as the only indicator of state or meaning. Important states also include text labels or messages.

### 1.2 Typography

- **Font Family:** Clean sans-serif stack (`system-ui`, `-apple-system`, `Segoe UI`, `sans-serif`).
- **Hierarchy:**
  - Page Title: approximately `28px` / bold
  - Section Title: approximately `20px` / semi-bold
  - Card Header / Subheading: approximately `16px` / semi-bold
  - Body Text: approximately `14px–16px`
  - Captions / Metadata / Badge: approximately `12px–13px`

### 1.3 Spacing and Elevation

- **Spacing Scale:** Uses consistent Bootstrap spacing based on approximately `8px`, `16px`, `24px`, and `32px`.
- **Card Surfaces:** White background, neutral border, rounded corners, and light shadow.
- **Max Content Width:** Main requester screens use a centered container with a sensible maximum width of approximately `1200px`.

---

## 2. Component System and Form Controls

### 2.1 Form Controls

- **Labels:** Positioned above the related input control and visually emphasized.
- **Required Fields:** Marked with a red asterisk (`*`). Validation messages are still shown when input is invalid.
- **Editable Controls:** White background with a clear border and readable text.
- **Read-only Controls:** Visually distinguishable from editable fields and cannot be modified by the Requester.
- **Validation Error State:** Invalid fields display nearby validation feedback.
- **Focus Indicator:** Interactive controls retain a visible browser or Bootstrap focus state.

### 2.2 Button Hierarchy

- **Primary Button:** Primary Green (`#006B3C`) with white text. Used for major actions such as `Continue` and `Submit Ticket`.
- **Secondary Button:** Light or outlined style. Used for actions such as `Cancel`, `Back to My Tickets`, `Retry`, and `Change Requester`.
- **Destructive Button:** Visually distinct removal action used for Attachment soft-removal.
- **Busy State:** While Ticket submission is processing, the submit action is disabled and visible feedback indicates that the request is in progress.

---

## 3. Application Shell

The application shell provides top navigation across Requester screens.

### Desktop and Tablet (`≥ 768px`)

- **Top Header Bar:** Primary Green (`#006B3C`) with white text.
- **Brand:** `TokTickIT`.
- **Navigation:**
  - `My Tickets`
  - `Create Ticket`
- The active page is visually indicated.
- The selected Development Requester and `Change Requester` action remain visible.

### Mobile (`< 768px`)

- Header content wraps into multiple rows when required.
- `TokTickIT`, `My Tickets`, and `Create Ticket` remain directly accessible.
- Selected Requester identity and `Change Requester` remain visible.
- Header content must not overlap or cause horizontal page scrolling.

---

## 4. Screen Specifications

### 4.1 Development Requester Selection Screen

Development-only identity selector used for Lab 2 testing.

- **Layout:** Centered white card over the `#F5F7F6` page background.
- **Title:** `Select Development Requester`.
- **Testing Context:** The screen explains that the selector is for Lab 2 testing and is not a real login screen.
- **Form Controls:**
  - Dropdown: `Development Requester *`
  - Primary `Continue` button

- **States:**
  - **Initial:** No Requester selected; `Continue` disabled.
  - **Loading:** Displays `Loading Requesters...`.
  - **Ready:** Displays active Development Requesters.
  - **Empty:** Displays `No active Development Requesters are available.`
  - **Failure:** Displays safe error feedback and a `Retry` action.

---

### 4.2 Create Ticket Screen

- **Layout:** Centered Ticket form using responsive Bootstrap grid behavior.

- **System-Assigned Information:**
  - Ticket Number: displays `Assigned after submission`.
  - Ticket Date: displays the current Ticket date as read-only information.
  - Requester: displays the selected Development Requester's name.

- **Classification:**
  - Category
  - Related System
  - Requested Priority (`Low`, `Medium`, `High`)

- **Problem Details:**
  - Ticket Summary: required text input, `5–120` characters.
  - Description: required multiline input, `10–4000` characters.

- **Attachments:**
  - File picker for optional Attachments.
  - Allowed types: JPG/JPEG, PNG, WEBP, PDF.
  - Maximum size: 5 MB per file.
  - Maximum: 5 active Attachments.
  - Selected files are shown before submission and can be removed from the selection.

- **Actions:**
  - Primary `Submit Ticket` button.

- **States:**
  - **Validation Failure:** Related field feedback is displayed and entered values remain available.
  - **Submitting:** Submit action is disabled while the request is processing.
  - **Success:** Success message displays the generated official Ticket Number and provides a `Create Another Ticket` action.
  - **API Failure:** Safe error feedback is displayed and entered form values remain available.
  - **Partial Attachment Failure:** If the Ticket is created but a later Attachment upload fails, Ticket creation remains successful and the Attachment failure is reported.

---

### 4.3 My Tickets Screen

- **Top Filter Toolbar:**
  - Page Heading: `My Tickets`
  - Search input: Ticket Number or Summary
  - Category filter
  - Status filter (`New`)
  - Requested Priority filter (`Low`, `Medium`, `High`)
  - Sort: `Newest first` / `Oldest first`

- **Desktop and Tablet Table (`≥ 768px`):**
  - Columns:
    - Ticket Number
    - Summary
    - Category
    - Status
    - Priority
    - Created
    - Open action
  - Each Ticket row provides an `Open` button.

- **Mobile Card View (`< 768px`):**
  - Tickets are displayed as stacked cards.
  - Each card displays:
    - Ticket Number
    - Current Status
    - Summary
    - Category
    - Priority
    - Created Date
    - Full-width `Open` button

- **Pagination:**
  - Uses 10 Tickets per page in the current implementation.
  - `Previous` and `Next` navigation is shown when multiple pages exist.
  - Page changes retain the active ownership, search, filter, and sort context.

- **States:**
  - **Loading:** Centered loading indicator.
  - **Empty:** Displays an empty state when the selected Requester has no Tickets.
  - **No Results:** Displays a no-results message when search or filters match no owned Tickets.
  - **Failure:** Displays safe Ticket-loading error feedback.

---

### 4.4 Requester Ticket Detail Screen (View Mode)

- **Navigation:**
  - Provides a `Back to My Tickets` action.

- **Header:**
  - Displays the official Ticket Number.
  - Displays Current Status.

- **Ticket Information:**
  - Ticket Date
  - Requester
  - Category
  - Related System
  - Requested Priority
  - Current Status
  - Ticket Summary
  - Description

All Ticket information is read-only.

- **Attachments Section:**
  - Displays active Attachment count (`X/5`).
  - Provides `+ Add Attachment` when another active Attachment may be added.
  - Active Attachments show:
    - Filename
    - File size
    - Upload timestamp
    - `Download`
    - `Remove`
  - Removed Attachments show:
    - Filename and retained metadata
    - `Removed` state
    - Removal timestamp
    - Removal reason
  - Removed Attachments do not provide a Download action.
  - An empty state is displayed when no Attachments exist.

- **Soft-Removal Confirmation Dialog:**
  - Shows the Attachment filename being removed.
  - Includes required `Removal Reason *` textarea.
  - Removal Reason is trimmed and must not be empty.
  - Actions:
    - `Cancel`
    - `Confirm Removal`

- **Scope Exclusion Note:**
  - Public Comments, Internal Notes, Service Actions, Event Log, IT Staff controls, and Resolution Summary are not implemented in Lab 2.

---

## 5. Status and Priority Presentation

### 5.1 Requested Priority

Requested Priority is displayed using readable text values:

- `LOW` → Low
- `MEDIUM` → Medium
- `HIGH` → High

Where visual indicators are used, the text value remains visible.

### 5.2 Current Status

- `NEW` is displayed as `New`.
- Pale Green (`#EAF6EF`) and Primary Green (`#006B3C`) are used for the current New status indicator.

---

## 6. Responsive Breakpoints and Layout Matrix

| Viewport | Breakpoint | Layout Adaptations |
|---|---|---|
| **Desktop** | `≥ 992px` | Centered content; multi-column forms; full My Tickets data table. |
| **Tablet** | `768px–991px` | Fields adapt using available columns; My Tickets remains a table where practical; no clipping. |
| **Mobile** | `< 768px` | Form fields stack where required; My Tickets switches to stacked Ticket cards; no horizontal page scrolling. |

---

## 7. Accessibility (A11y) Rules

1. **Keyboard Accessibility:** Native buttons, links, inputs, selects, and textareas remain keyboard focusable in logical order.

2. **Focus Visibility:** Interactive elements retain a clear visible focus state.

3. **Form Association:** Form controls use associated labels through `htmlFor` / `id` where applicable.

4. **ARIA and State Feedback:** Loading and error states use appropriate accessible attributes or roles such as `aria-busy` and `role="alert"` where implemented.

5. **Text Labels:** Important states such as New, Removed, errors, and validation feedback are communicated with readable text rather than color alone.

---

## 8. Visual Checklist and Screenshot Evidence Paths

### 8.1 Visual Inspection Checklist

Before declaring the UI implementation complete, verify the Requester-facing screens across Desktop (`≥ 992px`), Tablet (`768–991px`), and Mobile (`< 768px`):

- [x] **Color Tokens Compliance:** Primary Green (`#006B3C`), Secondary Green (`#0B7A46`), Pale Green (`#EAF6EF`), and Page Background (`#F5F7F6`) are used consistently.
- [x] **Editable vs. Read-Only Fields:** System-generated or Requester context fields are clearly distinguishable from editable inputs.
- [x] **Validation Placement:** Required inputs display understandable validation feedback near the related field.
- [x] **Button Hierarchy & Busy States:** Primary, secondary, and removal actions are distinguishable; submission cannot be triggered repeatedly while processing.
- [x] **Text Clipping & Label Wrapping:** No clipped labels, unreadable text, or overflowing Attachment filenames.
- [x] **Control & Element Overlap:** No overlapping controls, validation messages, or dialogs.
- [x] **Horizontal Overflow:** No horizontal page scrolling on Desktop, Tablet, or Mobile.
- [x] **Responsive My Tickets:** My Tickets uses a table from Tablet upward and stacked Ticket cards below `768px`.
- [x] **Mobile Actions:** Required buttons and controls remain visible and usable on Mobile.
- [x] **Attachment States:** Active and Removed Attachments are clearly distinguishable, and removed files do not expose Download.

### 8.2 Screenshot Evidence Paths

Screenshot evidence is stored under:

- `artifacts/lab-02/screenshots/create-ticket/`
- `artifacts/lab-02/screenshots/my-tickets/`
- `artifacts/lab-02/screenshots/ticket-detail/`

For final responsive evidence, capture at least:

- Desktop (`1440 × 900`)
- Tablet (`768 × 1024`)
- Mobile (`375 × 812`)

Additional screenshots are captured as needed for required validation, success, failure, empty, no-results, and Attachment lifecycle evidence.