# Lab 3 UI Specification

## 1. Visual Design System (Zen Green)

TokTickIT implements the **Zen Green Design System**, maintaining visual harmony and consistent component behavior across all screens.

### 1.1 Color Tokens

The application uses custom hex colors for core branding, while relying on standard Bootstrap utility classes for common states like success, warning, and error.

**Verified Custom Tokens :**
| Token Name | Hex Code | Purpose / Intended Usage |
|---|---|---|
| **Primary Green** | `#006B3C` | Application header, primary action buttons, brand accents, strong emphasis |
| **Pale Green** | `#EAF6EF` | Soft highlights, New status badges, success-related backgrounds, read-only info banners |
| **Page Background** | `#F5F7F6` | Main viewport canvas background |
| **Border Neutral** | `#D6E0DA` | Input control borders, card dividers, table horizontal lines |
| **Read-only Shading** | `#EEF3F0` | Non-editable and system-generated field backgrounds |

**State Colors (Bootstrap-based):**
- **Success:** Uses standard Bootstrap success utilities (e.g., `text-success`, `alert-success`, `btn-success`, `btn-outline-success`).
- **Error/Destructive:** Uses standard Bootstrap danger utilities (e.g., `text-danger`, `alert-danger`, `btn-outline-danger`).
- **Warning:** Uses standard Bootstrap warning utilities.

*Accessibility Rule:* Color is not used as the only indicator of state or meaning. Important states also include text labels or messages.

### 1.2 Typography and Spacing

- **Font Family:** Clean sans-serif stack (`system-ui`, `-apple-system`, `Segoe UI`, `sans-serif`).
- **Hierarchy:**
  - Page Title: approximately `28px` / bold
  - Section Title: approximately `20px` / semi-bold
  - Card Header / Subheading: approximately `16px` / semi-bold
  - Body Text: approximately `14px–16px`
  - Captions / Metadata / Badge: approximately `12px–13px`
- **Spacing Scale:** Uses consistent Bootstrap spacing based on approximately `8px`, `16px`, `24px`, and `32px`.
- **Card Surfaces:** White background, neutral border, rounded corners, and light shadow.
- **Max Content Width:** Main screens use a centered container with a verified maximum width of `1200px` for queues/lists, `1000px` for details/forms, and `680px` for authentication cards.

---

## 2. Component System and Form Controls

### 2.1 Form Controls and States

- **Labels:** Positioned above the related input control and visually emphasized.
- **Required Fields:** Marked with a red asterisk (`*`). Validation messages are still shown when input is invalid.
- **Editable Controls:** White background with a clear border and readable text.
- **Read-only Controls:** Visually distinguishable from editable fields (using Read-only Shading `#EEF3F0`) and cannot be modified.
- **Disabled State:** Controls are dimmed and non-interactive (e.g., during submission or lack of permission).
- **Validation Error State:** Invalid fields display a red border (e.g., Bootstrap `is-invalid`) and nearby validation feedback text.
- **Focus Indicator:** Interactive controls retain a visible browser or Bootstrap focus state.
- **Loading/Busy State:** Forms display a spinner or change button text to indicate processing.
- **Success/Failure States:** Form-level or API successes/failures display clear banner alerts.

### 2.2 Button Hierarchy and Busy States

- **Primary Button:** Primary Green (`#006B3C`) with white text. Used for major actions such as `Login`, `Submit Ticket`, and `Save`.
- **Secondary Button:** Light or outlined style. Used for actions such as `Cancel`, `Back`, `Clear filters`, and `Open`.
- **Destructive Button:** Visually distinct removal action (e.g., `btn-outline-danger`) used for Attachment soft-removal or deactivating a user.
- **Busy State:** While an action is processing, the submit action is disabled, and visible feedback (e.g., "Submitting...", "Uploading...", "Logging in...") indicates progress.

---

## 3. Application Shell and Active Navigation

The application shell provides top navigation that adapts to the authenticated user's role.

### Desktop and Tablet (`≥ 768px`)

- **Top Header Bar:** Primary Green (`#006B3C`) with white text.
- **Brand:** `TokTickIT`.
- **Navigation (Role-Aware):**
  - **Requester:** `My Tickets`, `Create Ticket`
  - **IT Staff:** `Ticket Queue`
  - **Administrator:** `User Management`
- The active page is visually indicated with bold text and a bottom border.
- **User Identity:** The authenticated user's name, role (e.g., `Requester`, `IT Staff`, `Admin`), and a `Logout` action are visible on the right.

### Mobile (`< 768px`)

- Header content wraps into multiple rows when required.
- Brand and navigation links remain accessible.
- User identity and `Logout` wrap cleanly and must not overlap or cause horizontal page scrolling.

---

## 4. Screen Specifications

### 4.1 Authentication Screens

#### Login
- **Layout:** Centered card, max width `680px`.
- **Fields:** `Email Address`, `Password`.
- **Actions:** Primary `Login` button.
- **Feedback:** Safe error response for invalid credentials or inactive users.

#### Mandatory Password Change
- Displayed when a user logs in with `mustChangePassword = true`.
- **Fields:** `Current Password`, `New Password`, `Confirm Password`.
- **Actions:** Primary `Change Password` button. The user cannot navigate elsewhere until completed.

---

### 4.2 Requester Screens

#### Create Ticket
- **Layout:** Centered Ticket form (`max-width: 1000px`).
- **Fields:** Category, Related System, Requested Priority, Ticket Summary, Description.
- **System-Assigned Info:** Ticket Number (Assigned after submission), Ticket Date, Requester (authenticated user, read-only).
- **Attachments (Verified Lab 2 Behavior):** File picker, max 5MB (5,242,880 bytes) per file, max 5 active attachments. Allowed types: JPG, PNG, WEBP, PDF.
- **Feedback:** Validation failures, submitting state, success message with Ticket Number and `Create Another Ticket` action, or API failure alert.

#### My Tickets
- **Toolbar (Verified Lab 2 Behavior):** Search (Number/Summary), Category filter, Status filter (`New`), Priority filter, Sort (`Newest first`/`Oldest first`), `Clear filters`.
- **List/Table:** Desktop/Tablet uses a data table. Mobile uses stacked cards.
- **Empty State:** "No tickets yet".
- **No Results State:** "No matching tickets" when filters match nothing.
- **Pagination (Verified Lab 2 Behavior):** 10 tickets per page.

#### Requester Ticket Detail (View Mode)
- **Header:** Ticket Number, Current Status badge.
- **Actions:** `Back to My Tickets`, `Indicate Problem Appears Resolved` (if applicable).
- **Read-Only Info:** Ticket Date, Category, Related System, Requested Priority, Summary, Description.
- **Attachments (Verified Lab 2 Behavior):** Display active and removed. Download available for active. Soft-removal requires a reason dialog.
- **Public Comments:** Displayed chronologically. Includes a form to add a new comment (max 1,000 chars). Cannot be edited/deleted.

---

### 4.3 IT Staff Screens

#### Ticket Queue
- **Toolbar:** Search (Number/Summary/Requester), Status filter, IT Priority filter, Owner filter (Unassigned/Me/All), Sort (`Newest first`/`Oldest first`), `Clear filters`.
- **Desktop/Tablet Table Columns:** Ticket Number, Summary, Requester, Status, IT Priority, Owner, Created, `Open` action. *(Note: This specific column selection is a practical UI design decision rather than a stakeholder-mandated list).*
- **Mobile Card View:** Displays Ticket Number, Status, Summary, Requester, IT Priority, Owner, Created Date, and `Open` button.
- **Pagination:** Uses the existing 10 tickets per page behavior.

#### IT Staff Ticket Detail
- **Header:** Ticket Number, Current Status.
- **Actions:** `Back to Ticket Queue`, Claim/Reassign Ticket.
- **Editable Controls:**
  - `IT Priority` (dropdown).
  - `Status` (dropdown limited to permitted transitions).
- **Read-Only Info:** Original Requested Priority, Ticket Date, Requester, Category, Related System, Summary, Description.
- **Attachments:** Can view and download.
- **Comments and Notes:**
  - **Public Comments:** Visually distinct section. Form to add.
  - **Internal Notes:** Visually distinct section clearly marked as "Internal Only". Form to add.

---

### 4.4 Administrator Screens

#### User Management
- **Toolbar:** Page Heading, Search (Name/Email), Role filter (All/Requester/IT Staff/Admin).
- **Desktop/Tablet Table Columns:** Name, Email, Role, Status (Active/Inactive), Edit action.
- **Mobile Card View:** Displays Name, Email, Role, Status, Edit action.
- **Actions:** `Create User` button opening a modal/form.
- **User Form (Create/Edit):** Name, Email, Role (Dropdown), Status (Checkbox/Toggle). Initial Password setting (if creating or resetting).
- **Feedback:** Clear errors for duplicate emails, self-deactivation prevention, or zero-admin prevention.

#### Admin Ticket Detail (Limited Access)
- **Permitted Actions:** Change IT Priority, Add Internal Notes.
- **Disabled/Hidden Features:** Cannot change Status, cannot Claim/Reassign, and no IT Staff Ticket Queue access.
- *(Note: Since Administrators do not have a Ticket Queue, the UI navigation/access path to open a specific Ticket Detail is an implementation decision left to the developer).*

---

## 5. Priority and Status Badges

- **Priority:** Displayed as text (`Low`, `Medium`, `High`).
- **Status:** 
| Status Label | API Value | Background Color | Text Color | Visual Example |
| :--- | :--- | :--- | :--- | :--- |
| **New** | `NEW` | `#EAF6EF` | `#006B3C` | <span style="background-color: #EAF6EF; color: #006B3C; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 12px;">New</span> |
| **Open** | `OPEN` | `#EFF6FF` | `#1D4ED8` | <span style="background-color: #EFF6FF; color: #1D4ED8; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 12px;">Open</span> |
| **In Progress** | `IN_PROGRESS` | `#EFF6FF` | `#1D4ED8` | <span style="background-color: #EFF6FF; color: #1D4ED8; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 12px;">In Progress</span> |
| **Waiting for Requester** | `WAITING_FOR_REQUESTER` | `#FFFAEB` | `#B54708` | <span style="background-color: #FFFAEB; color: #B54708; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 12px;">Waiting for Requester</span> |
| **Resolved** | `RESOLVED` | `#ECFDF3` | `#067647` | <span style="background-color: #ECFDF3; color: #067647; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 12px;">Resolved</span> |
| **Closed** | `CLOSED` | `#F2F4F7` | `#475467` | <span style="background-color: #F2F4F7; color: #475467; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 12px;">Closed</span> |
| **Reopened** | `REOPENED` | `#FFF7ED` | `#C2410C` | <span style="background-color: #FFF7ED; color: #C2410C; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 12px;">Reopened</span> |
| **Cancelled** | `CANCELLED` | `#FEF3F2` | `#B42318` | <span style="background-color: #FEF3F2; color: #B42318; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 12px;">Cancelled</span> |

- Styling Source: The styling for the New status is verified from the Lab 2 code. The visual styling for the remaining statuses is a Lab 3 implementation/design decision chosen to complement the existing Zen Green system.
---

## 6. Responsive Breakpoints and Layout Matrix

| Viewport | Breakpoint | Layout Adaptations |
|---|---|---|
| **Desktop** | `≥ 992px` | Centered content; multi-column forms; full data tables. |
| **Tablet** | `768px–991px` | Fields adapt using available columns; tables remain where practical; no clipping. |
| **Mobile** | `< 768px` | Form fields stack; data tables switch to stacked cards; navigation wraps; no horizontal page scrolling. |

---

## 7. Accessibility (A11y) Rules

1. **Keyboard Accessibility:** Native buttons, links, inputs, selects, and textareas remain keyboard focusable in logical order.
2. **Focus Visibility:** Interactive elements retain a clear visible focus state.
3. **Form Association:** Form controls use associated labels through `htmlFor` / `id` where applicable.
4. **ARIA and State Feedback:** Loading and error states use appropriate accessible attributes or roles such as `aria-busy` and `role="alert"` where implemented.
5. **Text Labels:** Important states such as New, Removed, errors, validation feedback, and internal-only notes are communicated with readable text rather than color alone.

---

## 8. Visual Checklist and Screenshot Evidence Paths

### 8.1 Visual Inspection Checklist

Before declaring the UI implementation complete, verify the screens across Desktop (`≥ 992px`), Tablet (`768–991px`), and Mobile (`< 768px`):

- [ ] **Color Tokens Compliance:** Primary Green (`#006B3C`), Pale Green (`#EAF6EF`), Page Background (`#F5F7F6`), Border Neutral (`#D6E0DA`), and Read-only Shading (`#EEF3F0`) are used consistently.
- [ ] **Editable vs. Read-Only Fields:** System-generated or read-only context fields are clearly distinguishable from editable inputs.
- [ ] **Validation Placement:** Required inputs display understandable validation feedback immediately near the related field.
- [ ] **Button Hierarchy & Busy States:** Primary, secondary, and destructive actions are distinguishable; submission forms cannot be triggered repeatedly while processing.
- [ ] **Responsive Lists:** Ticket Queues and User Lists use a table from Tablet upward and stacked cards below `768px`.
- [ ] **Text Clipping & Overlap:** No clipped labels, unreadable text, overflowing filenames, or horizontal page scrolling on any device.
- [ ] **Attachment States:** Active and Removed Attachments are clearly distinguishable; removed files do not expose Download.
- [ ] **Role-Aware Shell:** Navigation and available actions strictly match the authenticated user's role.
- [ ] **Comments vs. Notes:** Public Comments and Internal Notes are visually distinct in the Ticket Detail view.
- [ ] **State Feedback:** Success, error, empty, no-results, loading, and forbidden states render appropriately.

### 8.2 Screenshot Evidence Paths

Screenshot evidence is stored under:

- `artifacts/lab-03/screenshots/auth/`
- `artifacts/lab-03/screenshots/requester/`
- `artifacts/lab-03/screenshots/it-staff/`
- `artifacts/lab-03/screenshots/admin/`

For final responsive evidence, capture at least:
- Desktop (`1440 × 900`)
- Tablet (`768 × 1024`)
- Mobile (`375 × 812`)

Capture additional screenshots for validation, success, failure, empty, no-results, forbidden states, and Attachment lifecycle evidence as required.
