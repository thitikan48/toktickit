# Lab 3 UI Specification

## 1. Design System (Zen Green) and Additions

Lab 3 reuses the Lab 2 Zen Green design system without a new visual style. The tokens and rules are repeated here so this file can be used on its own.

### 1.1 Color tokens

| Token | Hex | Use |
|---|---|---|
| Primary Green | `#006B3C` | Header, primary buttons, brand |
| Secondary Green | `#0B7A46` | Active navigation, hover |
| Pale Green | `#EAF6EF` | Soft highlights, badges |
| Page Background | `#F5F7F6` | Page canvas |
| Surface | `#FFFFFF` | Cards, dialogs, tables |
| Border | `#D6E0DA` | Inputs, cards, table lines |
| Main Text | `#1F3328` | Body and headings |
| Muted Text | `#66756D` | Hints, timestamps |
| Read-only Shading | `#EEF3F0` | Non-editable fields |
| Error / Error Background | `#B42318` / `#FEF3F2` | Validation and failure |
| Warning / Warning Background | `#B54708` / `#FFFAEB` | Warnings, Internal Notes panel |
| Success / Success Background | `#067647` / `#ECFDF3` | Success messages |

### 1.2 Typography, spacing, and component states

- **Typography:** system sans-serif (`system-ui`, `Segoe UI`, `sans-serif`); page title about 28 px bold, section title 20 px, card heading 16 px semi-bold, body 14–16 px, captions and badges 12–13 px.
- **Spacing and cards:** 8/16/24/32 px scale; white cards with a neutral border, rounded corners, and a light shadow; content width up to about 1200 px.
- **Form controls:** labels above inputs; required fields marked with a red `*`; editable fields white with a border; read-only fields use Read-only Shading; invalid fields show a red border with the message directly below; disabled controls look dimmed; every control has a visible focus outline.
- **Buttons:** Primary (Primary Green, white text) for the main action such as `Log in` or `Save`; Secondary (outlined) for `Cancel`, `Back`, `Retry`; Destructive style for risky actions such as removing an attachment; Disabled is dimmed; Busy is disabled with a "…ing" label (for example "Logging in…").

### 1.3 Additions for Lab 3

**Badge colors** use only the Lab 2 Zen Green tokens (no new colors). Every badge also shows a text label, so color is never the only signal. One shared component is used for each badge type on every screen.

| Badge | Value | Background / Text |
|---|---|---|
| Status | New | Pale Green `#EAF6EF` / Primary Green `#006B3C` |
| | Open | Pale Green `#EAF6EF` / Secondary Green `#0B7A46` |
| | In Progress, Resolved | Success Background `#ECFDF3` / Success `#067647` |
| | Waiting for Requester, Reopened | Warning Background `#FFFAEB` / Warning `#B54708` |
| | Closed, Cancelled | Read-only Shading `#EEF3F0` / Muted Text `#66756D` |
| Priority (Requested and IT) | Low | `#EEF3F0` / `#66756D` |
| | Medium | `#FFFAEB` / `#B54708` |
| | High | Error Background `#FEF3F2` / Error `#B42318` |
| Role | Requester | `#EEF3F0` / Main Text `#1F3328` |
| | IT Staff | `#EAF6EF` / `#006B3C` |
| | Administrator | Primary Green `#006B3C` / white |
| Account | Active | `#ECFDF3` / `#067647` |
| | Inactive | `#EEF3F0` / `#66756D` |
| "Requester says resolved" label | | `#EAF6EF` / `#006B3C` |

**Public vs Internal:** Public Comments use a normal white card titled "Public Comments" with the note "Visible to the Requester". Internal Notes use a Warning Background card with a **"Staff only"** label and the note "Not visible to the Requester". They have separate composers with different buttons (`Post Public Comment`, `Add Internal Note`). Entries show author, role, and time, and text is displayed as plain text with line breaks.

**Reused components:** buttons, inputs, read-only shading, confirmation dialog (Lab 2 removal dialog pattern), alerts, loading, empty and no-results states, pagination.

## 2. Application Shell

- Primary Green header with `TokTickIT`, role-specific navigation, the user's **name and role badge**, and a user menu with `Change Password` and `Logout`. The Development Requester display and `Change Requester` are removed.

| Role | Navigation |
|---|---|
| Requester | My Tickets, Create Ticket |
| IT Staff | Ticket Queue |
| Administrator | Ticket Queue, User Management |

- Unauthorized destinations are not shown. Reaching one directly shows "You do not have permission to view this page." with a button to the user's home screen.
- Home after login: Requester → My Tickets; IT Staff and Administrator → Ticket Queue.
- On load the app checks the session; a loading indicator is shown, and no session shows Login. If the session expires, Login is shown with "Your session has expired. Please log in again."
- Mobile: the header wraps without overlap or horizontal scrolling.

## 3. Screens

### 3.1 Login
Centered card with `Email *`, `Password *`, and a primary `Log in` button. Validation messages appear under the fields. While submitting, the button is disabled. Failure messages: "Invalid email or password." for bad credentials, "This account is inactive. Contact an administrator." for inactive accounts, and a safe message for network or server errors. The email is kept after a failure.

### 3.2 Change Password
Fields: `Current Password *`, `New Password *`, `Confirm New Password *`, with a hint of the rules (8–72 characters, a letter and a digit, different from the current one). Messages for mismatch, policy failure, wrong current password, and failure of the request.
- **First login (mandatory):** no navigation, only `Logout`; after saving, the user continues to their home screen.
- **From the user menu (optional):** normal shell with `Cancel`.

### 3.3 Requester Screens (Lab 2 regression)
Create Ticket, My Tickets, and Ticket Detail work as in Lab 2 without the selector; the Requester name on Create Ticket comes from the logged-in user. The status filter lists all eight statuses. On Ticket Detail, add:
- Owner ("Not assigned yet" if empty) and IT Priority shown read-only.
- **Problem Appears Resolved** secondary button, shown while the ticket is not Resolved, Closed, or Cancelled; afterwards it is replaced by "You told IT this appears resolved. IT Staff will confirm and close the ticket."
- **Public Comments** thread with a composer (character count, `Post Public Comment`).
- Internal Notes are never shown or requested.

### 3.4 Ticket Queue (IT Staff, Administrator)
- **Toolbar:** search (ticket number, summary, requester), Status, IT Priority, Category, Owner (All, Unassigned, or a staff member), Sort (Default, Newest, Oldest, Last updated, Highest IT Priority), `Clear Filters`.
- **Desktop and Tablet table:** Ticket Number, Summary, Requester, IT Priority, Status, Owner ("Unassigned" when empty), Last Updated, `Open`. Category and Requested Priority are on Ticket Detail to keep the table readable. A small "Requester says resolved" label appears on flagged rows.
- **Mobile cards:** Ticket Number with Status, Summary, Requester, IT Priority, Owner, Last Updated, and a full-width `Open` button.
- **Pagination:** Previous/Next with "Page X of Y"; search, filters, and sort are kept when changing pages; changing a filter returns to page 1.
- **States:** loading, empty ("The queue is empty."), no results (with `Clear Filters`), forbidden, and failure (with `Retry`).

### 3.5 Staff Ticket Detail
- `Back to Queue`, Ticket Number, Status badge, and the "Requester says resolved" label when set.
- **Ticket information (read-only, shaded):** date, requester, category, related system, Requested Priority, summary, description.
- **Ticket handling (editable):**
  - **Owner:** dropdown of active staff and "Unassigned", plus `Claim Ticket` when unassigned.
  - **IT Priority:** Low/Medium/High (Requested Priority shown beside it, read-only).
  - **Status:** shows the current status and a dropdown of only the permitted next statuses (from the matrix in `specification.md`) with `Update Status`. Resolved, Closed, and Cancelled open a confirmation dialog.
  - Rule errors (for example "Assign an owner before changing the status.") appear next to the control; saved changes show a short success message.
- **Attachments:** Lab 2 list in view/download-only mode (no Add, no Remove).
- **Public Comments** and **Internal Notes** panels as described in §1.3, each with its own composer, validation ("Enter between 1 and 2000 characters."), empty message, busy state, and failure message that keeps the typed text.
- **States:** loading, not found, forbidden, failure with `Retry`.

### 3.6 User Management (Administrator)
- `+ Create User` button; search by name or email; one Role filter (All, Requester, IT Staff, Administrator). No pagination.
- **Table (≥768 px):** Name, Email, Role, Status, `Edit`. **Cards (<768 px)** show the same fields.
- **Create dialog:** `Name *`, `Email *`, `Role *`, `Active`, `Initial Password *` with the hint "The user must change this password at first login."
- **Edit dialog:** `Name`, `Email`, `Role`, `Active`, and a `Set New Initial Password` button that opens a small dialog with the same hint. For the Administrator's own row the Active control is disabled with the hint "You cannot deactivate your own account."
- **Feedback:** field validation, conflict messages ("This email is already in use.", "At least one active Administrator is required."), success messages, empty ("No users yet."), no results (with `Clear Filters`), loading, forbidden, and failure with `Retry`. Dialog buttons are disabled while saving, and passwords are cleared when a dialog closes.

## 4. Modes

| Screen | Modes |
|---|---|
| Login | Initial, submitting, error |
| Change Password | First login (mandatory), optional |
| Queue, User list | List with loading, empty, no results, failure |
| Requester Ticket Detail | View with comment composer |
| Staff Ticket Detail | View, edit handling (owner, priority, status), compose comment, compose note |
| User dialogs | Create, edit, set initial password |

## 5. Responsive and Accessibility

| Viewport | Layout |
|---|---|
| Desktop | Full header; queue and user tables; Staff Ticket Detail in two columns (information and discussion on the left, handling on the right) |
| Tablet | Tables remain; single-column Staff Ticket Detail; toolbars wrap without overlap |
| Mobile | Wrapped header; queue and user list as cards; stacked toolbar controls; dialogs fit the screen; no horizontal page scroll |

Accessibility follows Lab 2, plus: every input has a label; errors use `role="alert"` and success messages `role="status"`; dialogs use `role="dialog"`, move focus inside, and close with `Esc`; the Public/Internal difference is shown with text labels, not color alone; all controls are keyboard reachable with visible focus.

## 6. Visual Checklist and Screenshots

Complete at Desktop (1440×900), Tablet (768×1024), and Mobile (375×812) for Login, Change Password, Ticket Queue, Staff Ticket Detail, and User Management. Items are ticked only after real inspection.

- [ ] **Design consistency:** Zen Green tokens, buttons, cards, and spacing match the Lab 2 screens.
- [ ] **Role navigation:** each role sees only its permitted links; user name and role are shown; Logout works.
- [ ] **Badges:** status, priority, role, and account badges are consistent and have text labels.
- [ ] **Editable vs read-only fields:** clearly different on Staff Ticket Detail and in the user dialogs.
- [ ] **Public vs Internal:** Public Comments and Internal Notes are visibly different ("Staff only" label).
- [ ] **Validation and feedback placement:** validation, busy, success, empty, no-results, forbidden, and failure messages appear next to the related control.
- [ ] **Responsive layout:** tables on Desktop/Tablet, cards on Mobile; Staff Ticket Detail collapses to one column.
- [ ] **Focus:** every interactive control shows a visible focus state and is reachable by keyboard; dialogs trap focus and close with `Esc`.
- [ ] **Clipping:** no cut-off labels, badges, or long text (names, emails, summaries, filenames).
- [ ] **Overlap:** no overlapping controls, messages, or dialogs.
- [ ] **Horizontal overflow:** no horizontal page scroll at any of the three sizes.

Screenshots (all three viewports for each major screen, plus the key states such as validation, empty, no results, and failure) are saved under `artifacts/lab-03/screenshots/`:
`authentication/`, `staff-queue/`, `staff-ticket-detail/`, `user-management/`.
