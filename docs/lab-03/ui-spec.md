# Lab 3 UI Specification

> Extends `docs/lab-02/ui-spec.md`. All Zen Green tokens, typography, spacing, form conventions, button hierarchy, breakpoints, and accessibility rules from Lab 2 remain in force; only additions and changes are listed here.

## 1. Design Additions (Zen Green)

### 1.1 Badges (always carry a text label; color is never the only signal)

| Badge | Values → style |
|---|---|
| **Status** | New → Pale Green `#EAF6EF` / `#006B3C`; Open → `#E8F1FB` / `#175CD3`; In Progress → `#E0F2FE` / `#026AA2`; Waiting for Requester → Warning Bg `#FFFAEB` / `#B54708`; Resolved → Success Bg `#ECFDF3` / `#067647`; Closed → `#EEF3F0` / `#66756D`; Reopened → `#FDF2FA` / `#C11574`; Cancelled → `#EEF3F0` / `#66756D` (muted) |
| **Priority** (Requested and IT) | Low → neutral `#EEF3F0`; Medium → Warning Bg / Warning; High → Error Bg `#FEF3F2` / `#B42318`. Label always reads "Low/Medium/High"; IT Priority badge is prefixed "IT:" and Requested "Req:" where both appear |
| **Role** | Requester → `#EEF3F0` / `#1F3328`; IT Staff → Pale Green / Primary; Administrator → Primary Green bg, white text |
| **Account Status** | Active → Success Bg/Success; Inactive → `#EEF3F0` / `#66756D` |
| **Appears Resolved** | Pale Green pill "Requester says resolved" |

### 1.2 Public vs Internal panels

- **Public Comments panel:** white card, header "Public Comments", subtitle "Visible to the Requester", Border Neutral outline.
- **Internal Notes panel:** Warning Background `#FFFAEB` card with a Warning-colored left border, header "Internal Notes" plus a **"Staff only"** badge, subtitle "Not visible to the Requester". The two composers have different button labels (`Post Public Comment`, `Add Internal Note`) and are never in the same form, so a private note cannot be posted publicly by accident.
- Entries show author name, role badge, and timestamp; content is plain text with line breaks preserved (BR-22).

### 1.3 Reused components
Buttons, form controls, read-only shading `#EEF3F0`, confirmation dialog (Lab 2 removal dialog pattern), alert banners (`role="alert"` for errors, `role="status"` for success), loading spinner, empty/no-results states, pagination (Previous/Next + "Page X of Y"). New shared components: `RoleBadge`, `StatusBadge`, `PriorityBadge`, `CommentThread`, `ConfirmDialog`.

---

## 2. Application Shell (changed)

- Primary Green header; brand `TokTickIT`; **role-specific navigation** (active item underlined with Secondary Green):

| Role | Navigation |
|---|---|
| Requester | My Tickets, Create Ticket |
| IT Staff | Ticket Queue |
| Administrator | Ticket Queue, User Management |

- Right side: **user name + Role badge**, a user menu with `Change Password` and `Logout`. The "Development Requester / Change Requester" display is removed.
- Unauthorized destinations are not shown. If reached directly (typed URL/state), a **Forbidden** state is shown: "You do not have permission to view this page." with a button to the user's home screen.
- Home screen by role after login: Requester → My Tickets; IT Staff/Administrator → Ticket Queue.
- Mobile (<768 px): header wraps to two rows, navigation items remain visible, user menu collapses to the name + menu button; no overlap or horizontal scroll.
- While the session is being restored (`GET /api/auth/me`), a full-page loading indicator is shown; on `401` the Login screen is shown. A mid-session `401` returns to Login with the message "Your session has expired. Please log in again."

---

## 3. Screens

### 3.1 Login (SCR-01)

- Centered card on `#F5F7F6`, no shell navigation. Title "Log in to TokTickIT".
- Fields: `Email *`, `Password *` (masked, with Show/Hide toggle). Primary `Log in` button. Local-lab hint line: "Local development accounts are listed in the README."
- **States:** Initial; **Validation** (empty/invalid email format shown under the field); **Busy** (button disabled, "Logging in…", `aria-busy`); **Invalid credentials** (alert "Invalid email or password."); **Inactive** (alert "This account is inactive. Contact an administrator."); **Network/server failure** (safe alert + retry by resubmitting); email value retained, password cleared on failure.
- On success: if `mustChangePassword` → Change Password, otherwise role home.

### 3.2 Change Password (SCR-02, mandatory and voluntary)

- Card with fields `Current Password *`, `New Password *`, `Confirm New Password *`; helper text lists the policy (8–72 characters, at least one letter and one digit, different from current).
- **Mandatory mode** (first login): heading "Choose a new password", explanation that it is required before continuing, **no navigation**, only `Logout` available. **Voluntary mode** (from the user menu): normal shell and a `Cancel` action.
- Validation: required fields, policy, confirmation mismatch ("Passwords do not match."), same-as-current; server `fields` errors shown beside the field; busy state disables `Save Password`.
- Success: status message, then mandatory mode continues to the role home screen; voluntary mode returns to the previous screen.

### 3.3 Requester screens (Lab 2, regression)

- Create Ticket, My Tickets, Ticket Detail behave and look as in Lab 2 with the selector removed; **Requester** field on Create Ticket shows the authenticated name (read-only).
- My Tickets status filter now lists all eight statuses; the table/card show the Status badge and (new) an "IT Priority" column on ≥992 px.
- **Ticket Detail additions (below Attachments):**
  - `Problem Appears Resolved` secondary button, shown only when allowed (BR-19); after use it is replaced by the Pale Green "You indicated this appears resolved" notice with the time. Confirmation is not required. A note explains that IT Staff will formally resolve or close the ticket.
  - **Public Comments** panel (thread + composer `Add a comment` textarea, `0/2000` counter, `Post Public Comment`). Composer hidden with an explanatory message when the ticket is Closed or Cancelled.
  - Owner name and IT Priority displayed read-only ("Assigned to" shows "Not assigned yet" when empty).
  - Internal Notes are never rendered or requested.

### 3.4 IT Staff Ticket Queue (SCR-03)

- **Heading** "Ticket Queue" with three **count chips**: `Active`, `Unassigned`, `Assigned to me` (clicking a chip applies the matching filter).
- **Toolbar:** search (Ticket Number, Summary, Requester), Status, IT Priority, Category, Owner (`All`, `Unassigned`, `Assigned to me`, each active staff user), Sort (`Default (priority, oldest first)`, `Newest first`, `Oldest first`, `Last updated`, `Highest IT Priority`), `Clear Filters`. Changing any control resets to page 1; page size selector 10/25/50.
- **Desktop/Tablet table (≥768 px).** Columns (chosen to keep the grid scannable): Ticket No., Summary, Requester, Category, IT Priority (badge; Requested priority in tooltip/secondary line), Status badge, Owner (name or "Unassigned", "(inactive)" marker), Last Updated, `Open`. Created Date is available through sort and Ticket Detail; Requested Priority is shown as a small caption under IT Priority only when it differs. At 768–991 px the Category column folds under Summary.
- **Mobile cards (<768 px):** each card shows Ticket No. + Status badge, Summary, Requester, IT Priority badge, Owner, Last Updated, and a full-width `Open` button.
- Rows with "Requester says resolved" show the Pale Green pill.
- **Pagination:** Previous/Next, "Page X of Y", total count, retaining all query state.
- **States:** Loading (spinner, `aria-busy`); Empty ("The queue is empty."); No results ("No tickets match your search or filters." + `Clear Filters`); Forbidden (Requester or invalid session); Failure (safe error + `Retry`); invalid-query errors never surface because controls only offer valid values.

### 3.5 IT Staff Ticket Detail (SCR-04)

Two-column layout on ≥992 px (main ticket/communication left, operational panel right); single column below.

- **Header:** `Back to Queue`, Ticket Number, Status badge, IT Priority badge, "Requester says resolved" pill when applicable.
- **Ticket Information (read-only, shaded):** Ticket Date, Requester (name, email), Category, Related System, Requested Priority, Summary, Description.
- **Ticket Handling panel (editable, white controls) with per-control save feedback:**
  - **Owner:** dropdown of active assignees plus "Unassigned"; a `Claim Ticket` primary button appears only when unassigned; `Save Owner`/auto-save with inline "Saved" status.
  - **IT Priority:** dropdown Low/Medium/High; Requested Priority shown beside it, read-only.
  - **Status:** shows the current status and a dropdown listing only `allowedTransitions` returned by the API plus `Update Status`. `Resolved`, `Closed`, `Cancelled` open a **ConfirmDialog** ("Change status to Resolved? The Requester will see the new status.", `Cancel` / `Confirm`).
  - Conflict errors (`OWNER_REQUIRED`, `INVALID_TRANSITION`, `ALREADY_OWNED`, `INVALID_ASSIGNEE`) appear as an inline alert near the control with plain-language text (e.g. "Assign an owner before changing the status."); after a conflict the ticket is refreshed.
- **Attachments:** Lab 2 list reused in **view/download-only** mode (no Add, no Remove); removed attachments show metadata and reason, no Download.
- **Public Comments** panel and **Internal Notes** panel (section 1.2), stacked in this order with distinct styling; each has its own composer, counter, busy state, validation message ("Enter between 1 and 2000 characters."), empty message ("No comments yet."), and failure alert that keeps typed text.
- **States:** page loading, not found ("Ticket not found."), forbidden, failure with `Retry`.

### 3.6 User Management (SCR-05, Administrator only)

- Heading "User Management" with `+ Create User` primary button.
- **Toolbar:** search (name or email) and a single Role filter (`All roles`, Requester, IT Staff, Administrator); no pagination, no multi-column sort (list ordered by name).
- **Table (≥768 px):** Name, Email, Role badge, Status badge (Active/Inactive), `Edit`. **Cards (<768 px):** name, email, role + status badges, `Edit`.
- **Create User dialog:** `Name *`, `Email *`, `Role *` (single select), `Active` checkbox (default checked), `Initial Password *` (Show/Hide), helper text "The user must change this password at first login." `Create User` / `Cancel`.
- **Edit User dialog:** `Name`, `Email`, `Role`, `Active`; separate `Set New Initial Password` secondary button opening a small dialog (`New Initial Password *`, confirmation text that the user must change it at next login). Own-account row: Active toggle disabled with helper "You cannot deactivate your own account."
- **Feedback:** field validation (required, email format, policy), conflict messages ("This email is already in use.", "At least one active Administrator is required.", "You cannot deactivate your own account."), success banner ("User created", "User updated", "Initial password set; the user must change it at next login"), empty ("No users yet."), no results ("No users match your search." + `Clear Filters`), loading, forbidden, and safe failure with `Retry`. Dialog buttons are disabled while saving.
- Passwords are never displayed after submission and are cleared from component state on close.

---

## 4. Screen Modes

| Screen | Modes |
|---|---|
| Login | Initial, busy, error |
| Change Password | Mandatory, voluntary |
| Create Ticket (Lab 2) | Create |
| My Tickets / Ticket Queue / User list | List (loading, empty, no-results, failure) |
| Requester Ticket Detail | View (+ comment composer) |
| Staff Ticket Detail | View, edit-handling (owner/priority/status), compose comment, compose note |
| User dialogs | Create, edit, set-initial-password |

## 5. Responsive Matrix

| Viewport | Layout |
|---|---|
| Desktop ≥992 px | Full header; Queue table with all columns; Staff Ticket Detail two columns; User table |
| Tablet 768–991 px | Queue/User tables, Category folded under Summary; single-column Staff Ticket Detail; toolbar wraps without overlap |
| Mobile <768 px | Wrapped header; Queue and User list as cards; stacked toolbar controls (full width); dialogs become near full-screen; no horizontal page scroll |

## 6. Accessibility

Same rules as Lab 2, plus: every input has an associated `<label>`; Show/Hide password toggles are real buttons with `aria-pressed`; errors use `role="alert"`, success uses `role="status"`; busy regions use `aria-busy`; dialogs use `role="dialog"`, `aria-modal`, focus is moved into the dialog and returned on close, `Esc` cancels; badges include text; Internal vs Public distinction is conveyed by headings and the "Staff only" text, not color alone; tables have header cells with `scope="col"`; all controls are keyboard reachable with visible focus.

## 7. Visual Checklist and Screenshot Evidence

Check at Desktop (`1440×900`), Tablet (`768×1024`), Mobile (`375×812`):

- [ ] Zen Green tokens used; new screens look like the Lab 2 application.
- [ ] Role-specific navigation correct for each role; no unauthorized links; user name and role shown.
- [ ] Editable vs read-only fields distinguishable on Staff Ticket Detail and dialogs.
- [ ] Status, Requested/IT Priority, Role, Account badges consistent and text-labelled.
- [ ] Public Comments and Internal Notes visibly distinct; "Staff only" label present.
- [ ] Validation, busy, success, empty, no-results, forbidden, conflict, and failure feedback placed near the related control.
- [ ] Queue table (≥768 px) and cards (<768 px); no horizontal page scroll; no clipped text or overlapping controls.
- [ ] Dialogs usable on mobile; focus visible.

Screenshots are stored under:

- `artifacts/lab-03/screenshots/authentication/` (login, errors, inactive, change password)
- `artifacts/lab-03/screenshots/staff-queue/`
- `artifacts/lab-03/screenshots/staff-ticket-detail/`
- `artifacts/lab-03/screenshots/user-management/`

## 8. Requirement Traceability

Login/Change Password: FR-01–06, AC-01–05, 29 · Role shell and forbidden states: FR-06–07, AC-11 · Requester additions: FR-09–11, AC-10, 19, 21 · Queue: FR-12, AC-13–14 · Staff Detail: FR-13–18, AC-15–21 · User Management: FR-19–23, AC-22–27 · Responsive/A11y/style: AC-29–31.
