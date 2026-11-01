# Lab 4 UI Specification

## 1. Scope and References

| Screen | Change |
|---|---|
| Shell and navigation | new Dashboard item, first screen after login |
| IT Staff Dashboard, Requester Dashboard | new |
| My Tickets, Ticket Queue | accept drill-down filters from the dashboard |
| Staff Ticket Detail | Actions Taken area, gate message, stale update message, Status Timeline |
| Requester Ticket Detail | read-only Actions Taken and Status Timeline |

I reuse the Zen Green colours, `StatusBadge`, `PriorityBadge`, `Dialog`, and the Bootstrap card, table, alert, and spinner patterns from Labs 2 and 3. There is no new style system. A new `ActionStatusBadge` uses the same badge style and always shows its text: Planned, In Progress, Completed, Cancelled. Ticket status and priority keep their Lab 3 badges, and Internal Notes (private) keep a different style from Public Comments (shared).

## 2. Navigation

| Role | Items in order |
|---|---|
| Requester | Dashboard, My Tickets, Create Ticket |
| IT Staff | Dashboard, Ticket Queue |
| Administrator | Dashboard, Ticket Queue, User Management |

- The Dashboard opens after login, after the forced password change, and after a session restore (BR-30).
- The active item is highlighted with the Lab 3 active style and `aria-current="page"`.
- Every earlier screen is still in the navigation for the roles that had it.

## 3. IT Staff Dashboard

IT Staff and Administrators see the same screen. The title is "Dashboard" with a "Refresh" button.

| Viewport | Layout |
|---|---|
| Desktop (>= 992 px) | row 1: 3 cards; row 2: Tickets by status and My open actions side by side; row 3: Recently updated, full width |
| Tablet (768 to 991 px) | 3 cards in one row; other blocks full width in the same order |
| Mobile (< 768 px) | one column; lists show as cards |

**Cards.** Each card is one button with the label and the value. Its accessible name is "<label>: <value>".

| Card | Label | Example name (Priya) | Click |
|---|---|---|---|
| `unassigned` | Unassigned | "Unassigned: 3" | Ticket Queue with `ownerId=unassigned&statusGroup=active` |
| `myOpenTickets` | My open tickets | "My open tickets: 2" | Ticket Queue with `ownerId=<my id>&statusGroup=active` |
| `myOpenActions` | My open actions | "My open actions: 1" | moves focus to the My open actions list below |

**Tickets by status.** Eight rows, one button each, with a `StatusBadge` and the count, for example "Waiting for Requester: 1". Zero rows are shown. A click opens the Ticket Queue with `status=<STATUS>`.

**Lists.**

| List | Columns (cards on mobile) | Empty text | Link |
|---|---|---|---|
| My open actions | Ticket Number, Action, Status, Action Date, `Open` | "You have no open actions." | `Open` opens the Ticket |
| Recently updated | Ticket Number, Summary, Status, Owner, Last Updated, `Open` | "No tickets updated in the last 7 days." | "View all" opens the Ticket Queue with `sort=updatedAt&direction=desc` |

## 4. Requester Dashboard

The title is "Dashboard" with a "Refresh" button. Only the logged-in Requester's Tickets are shown.

| Viewport | Layout |
|---|---|
| Desktop and tablet | 2 cards in one row; the two lists side by side on desktop, stacked on tablet |
| Mobile | one column; lists show as cards |

| Card | Label | Example name (Jennifer) | Click |
|---|---|---|---|
| `openTickets` | Open tickets | "Open tickets: 3" | My Tickets with `statusGroup=active` |
| `waitingForMe` | Waiting for me | "Waiting for me: 0" | My Tickets with `status=WAITING_FOR_REQUESTER` |

| List | Columns (cards on mobile) | Empty text |
|---|---|---|
| Recently updated | Ticket Number, Summary, Status, Last Updated, `Open` | "No tickets updated in the last 7 days." |
| Recently resolved | Ticket Number, Summary, Status, Resolved On, `Open` | "No tickets resolved in the last 7 days." |

`Open` opens Ticket Detail. Its accessible name is "Open <Ticket Number>".

**Drill-down on My Tickets and the Ticket Queue.** The filters from the dashboard are set in the existing dropdowns. `statusGroup=active` has no dropdown, so it shows as a chip "Active tickets only" with a remove button. "Clear Filters" also removes the chip.

## 5. Actions Taken on Ticket Detail

### 5.1 List

A new "Actions Taken (n)" card on Staff Ticket Detail, after Ticket Information and Ticket Handling, before Attachments. It has an "Add Action" button.

- **Desktop and tablet:** a table with Action Date, Description, Status (`ActionStatusBadge`, plus "Follow-up needed" when set), Assigned To, Performed By, and a `View` button.
- **Mobile:** one card per action with the same fields and a full-width `View` button.
- Performed By shows "Not yet performed" until the action is completed.
- Order: Action Date/Time, oldest first (BR-10).

### 5.2 Create mode

"Add Action" opens a form panel at the top of the card. Fields in order:

| Label | Control | Default | Rule |
|---|---|---|---|
| Action Date and Time * | `datetime-local` (Bangkok time) | now | required |
| Action Description * | textarea, counter "0 / 1000" | empty | required, up to 1000 |
| Status * | select: Planned, In Progress, Completed | Planned | BR-07 |
| Result | textarea, counter "0 / 1000" | empty | optional |
| Assigned To * | select of active IT Staff and Administrators | me | BR-06 |
| Follow-Up Required | checkbox | off | |
| Follow-up Note * | textarea, shown only when the box is checked | empty | required when checked |
| Attachment Notes | textarea, counter "0 / 500", hint "Which file or image to look at. This is not an upload." | empty | optional |

Buttons: "Save Action" (shows "Saving..." and is disabled while busy) and "Cancel". On success the panel closes, "Action saved." is shown, and the list reloads.

### 5.3 View and edit mode

`View` opens the same panel with all fields read-only, plus Created By and Performed By.

| Button | Shown when | Effect |
|---|---|---|
| Edit | Planned or In Progress | fields become editable; "Save Changes" and "Cancel" |
| Start | Planned | status becomes In Progress |
| Complete | Planned or In Progress | status becomes Completed |
| Cancel Action | Planned or In Progress | asks "Cancel this action?" in the Lab 3 confirmation dialog; "Keep Action" closes it |
| Close | always | closes the panel |

A Completed or Cancelled action shows "This action is <Completed/Cancelled> and cannot be changed." and only Close.

### 5.4 Requester view

Requester Ticket Detail shows the same list and View panel for its own Ticket, read-only. There is no Add, Edit, Start, Complete, or Cancel button.

## 6. Workflow Controls and Feedback

- **Status control:** the existing Status select on Staff Ticket Detail lists only allowed targets (section 5.4 of the specification). Confirmation for Resolved, Closed, and Cancelled stays as Lab 3. Every save sends the current `version` as `expectedVersion`.
- **Success:** the screen reloads the Ticket (summary status and new version), the actions, and the timeline, then shows "Changes saved."
- **Gate (`409 OPEN_ACTIONS_EXIST`):** "Complete or cancel all open actions before resolving or closing." as `role="alert"` under the Status select. The status does not change.
- **Stale update (`409 STALE_UPDATE`):** "This ticket was changed by someone else. Reload to see the latest version." at the top of Ticket Handling with a "Reload" button. The user's selected values stay until Reload is pressed. Reload loads the latest Ticket, actions, and timeline.
- **Status Timeline:** a card on both Ticket Details. Each entry shows the time (Bangkok), "<From> to <To>" with the To badge, and "by <name> (<role>)", oldest first. With no rows it shows "No status changes recorded yet."
- **Problem Appears Resolved:** unchanged from Lab 3. It is only a flag and never changes the status.

## 7. Screen States

| Screen or area | Loading (`role="status"`) | Empty | Forbidden | Failure (`role="alert"`) |
|---|---|---|---|---|
| IT Staff Dashboard | "Loading dashboard..." | `0` cards and empty list texts | Lab 3 forbidden message | "Unable to load the dashboard." with Retry |
| Requester Dashboard | "Loading dashboard..." | `0` cards and empty list texts | Lab 3 forbidden message | "Unable to load the dashboard." with Retry |
| Actions Taken | "Loading actions..." | "No actions have been recorded yet." | not used | "Unable to load the actions." with Retry |
| Status Timeline | "Loading history..." | "No status changes recorded yet." | not used | "Unable to load the history." with Retry |
| Action form | "Saving..." on the button | | | field errors under fields; other errors at the top of the panel |

- Validation errors show under each field, and the first invalid field gets focus.
- `409 CONFLICT` (for example an inactive assignee) shows the server message as `role="alert"`. Typed values are kept.
- `500` or a network error shows "Unable to save. Please try again." Typed values are kept.
- Not found uses the existing Lab 3 not-found state.

**Cleanup:** unused `SystemStatus` and `checkSystem()` and leftover "Issue 5:" comments in `client/src/api.ts`, and unused `priorityLabel()` in `PriorityBadge.tsx`, are removed. No placeholder text or broken links remain.

## 8. Responsive Rules

Same as Labs 2 and 3: Desktop 1440 × 900, Tablet 768 × 1024, Mobile 375 × 812. Tables become cards below 768 px. Long text wraps. There is no horizontal page scroll, clipping, or overlap.

## 9. Accessibility

Same rules as Labs 2 and 3, plus:
- Cards and status rows are real buttons (Tab, Enter, Space) with names like "Open tickets: 3".
- Every form control has a visible label. Required fields show `*` and have `aria-required="true"`. Errors are linked with `aria-describedby`.
- Statuses, badges, and messages always show text, not only colour.
- Focus is visible on every control. When the action panel closes, focus goes back to the button that opened it.

## 10. Screenshots

Saved by the Lab 4 E2E tests to `artifacts/lab-04/screenshots/`:

| Folder | Files | Content |
|---|---|---|
| `staff-dashboard/` | `desktop.png`, `tablet.png`, `mobile.png` | Priya, seeded data |
| `staff-dashboard/` | `desktop-empty-actions.png` | Elena, no open actions |
| `requester-dashboard/` | `desktop.png`, `tablet.png`, `mobile.png` | Jennifer |
| `requester-dashboard/` | `desktop-empty-lists.png` | David, empty Recently resolved |
| `actions-taken/` | `desktop-list.png`, `tablet-list.png`, `mobile-list.png` | TKT-2026-900003 with several actions |
| `actions-taken/` | `desktop-create-validation.png` | create mode with field errors |
| `actions-taken/` | `desktop-blocked-resolve.png` | TKT-2026-900002, gate message |
| `actions-taken/` | `mobile-requester-view.png` | Michael viewing TKT-2026-900003 |

## 11. Visual and Accessibility Checklist

I fill in Result after inspection, using the screenshots above.

| Item | Screen | Viewport | Result |
|---|---|---|---|
| Design consistency with Labs 2 and 3 (colours, buttons, cards, spacing) | all Lab 4 screens | all | Pass |
| Dashboard item shown and marked active | shell | desktop, mobile | Pass |
| Cards show label and value; names include the value | both dashboards | all | Pass |
| Status block and lists are readable | IT Staff Dashboard | all | Pass |
| Actions: table on desktop and tablet, cards on mobile | Staff Ticket Detail | all | Pass |
| Editable and read-only fields look different | Actions Taken panel | desktop, mobile | Pass |
| Validation under the field; other errors at the top | Actions Taken panel | desktop, mobile | Pass |
| Gate and stale messages are clear and keep input | Staff Ticket Detail | desktop | Pass |
| Status, priority, and private vs shared content look different | Ticket Detail | desktop, mobile | Pass |
| Keyboard reach and visible focus | all Lab 4 screens | desktop | Fixed: Action Date and Time had no focus ring; now Pass (STYLE-02) |
| No clipping | all Lab 4 screens | all | Pass |
| No overlap | all Lab 4 screens | all | Pass |
| No horizontal overflow | all Lab 4 screens | all | Pass |

## 12. Traceability

| ui-spec section | FR | AC |
|---|---|---|
| 2 Navigation | FR-17 | AC-25 |
| 3 IT Staff Dashboard | FR-15, FR-16, FR-18 | AC-19 to AC-22, AC-24 |
| 4 Requester Dashboard | FR-14, FR-16, FR-18 | AC-02, AC-18, AC-19, AC-22, AC-24 |
| 5 Actions Taken | FR-01 to FR-07 | AC-01, AC-03 to AC-09 |
| 6 Workflow controls | FR-08 to FR-13 | AC-11, AC-13, AC-15, AC-17 |
| 7 States | FR-18, FR-22, FR-23 | AC-24, AC-30, AC-31, AC-34 |
| 8 to 11 Responsive, accessibility, screenshots, checklist | FR-24 | AC-32, AC-33, AC-34 |
