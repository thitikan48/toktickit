# Lab 2 UI Specification

## 1. Visual Design System (Zen Green)

TokTickIT implements the **Zen Green Design System**, maintaining visual harmony and consistent component behavior across all screens.

### 1.1 Color Tokens

| Token Name | Hex Code | Purpose / Intended Usage |
|---|---|---|
| **Primary Green** | `#006B3C` | Application header, primary action buttons, brand accents, strong emphasis |
| **Secondary Green** | `#0B7A46` | Active navigation tabs, focus rings, interactive links, button hover states |
| **Pale Green** | `#EAF6EF` | Selected rows, soft card highlights, success background badges |
| **Page Background** | `#F5F7F6` | Main viewport canvas background |
| **Surface / Cards** | `#FFFFFF` | Form containers, modal dialogs, data table cards |
| **Border Neutral** | `#D6E0DA` | Input control borders, card dividers, table horizontal lines |
| **Main Text** | `#1F3328` | Primary typography, headers, table row content (dark charcoal-green) |
| **Muted Text** | `#66756D` | Subtitles, field hints, helper text, timestamps |
| **Read-only Shading** | `#EEF3F0` | Non-editable and system-generated field backgrounds |
| **Error** | `#B42318` | Validation messages, invalid input borders, destructive actions |
| **Error Background** | `#FEF3F2` | Form-level error alert banners |
| **Warning** | `#B54708` | Amber status indicators and informational warning badges |
| **Warning Background** | `#FFFAEB` | Warning alert callout panels |
| **Success** | `#067647` | Confirmation checkmarks, success toast messages |
| **Success Background** | `#ECFDF3` | Success confirmation alert banners |

*Accessibility Rule:* Color is never used as the sole indicator of state or meaning. Badges and errors always include clear text descriptions.

### 1.2 Typography
- **Font Family:** Clean sans-serif stack (`Inter`, `system-ui`, `-apple-system`, `Segoe UI`, `sans-serif`).
- **Hierarchy:**
  - Page Title: `28px` / `700` (Bold)
  - Section Title: `20px` / `600` (Semi-bold)
  - Card Header / Subheading: `16px` / `600`
  - Body Text: `14px`–`16px` / `400` (Regular)
  - Captions / Metadata / Badge: `12px`–`13px` / `500` (Medium)

### 1.3 Spacing and Elevation
- **Spacing Scale:** `8px`, `16px`, `24px`, `32px`.
- **Card Surfaces:** White background (`#FFFFFF`), `1px` border (`#D6E0DA`), `8px` border radius, soft shadow (`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06)`).
- **Max Content Width:** Centered container with max width `1200px`.

---

## 2. Component System and Form Controls

### 2.1 Form Controls
- **Labels:** Positioned strictly **above** the input control in semi-bold (`font-weight: 600`).
- **Required Fields:** Marked with a red asterisk (`*` in `#B42318`) alongside the label text. The asterisk does not replace field-level validation messages.
- **Editable Controls:** White background (`#FFFFFF`), `1px` neutral border (`#D6E0DA`), min height `44px` for touch accessibility.
- **Read-only Controls:** Soft gray-green shading (`#EEF3F0`), `1px` subtle border, non-editable text, distinct cursor (`default` or `not-allowed`).
- **Validation Error State:** Border changes to Error Red (`#B42318`). Error message renders immediately **below** the offending field in `13px` red text.
- **Focus Indicator:** 2px focus ring using Secondary Green (`#0B7A46`) with `2px` offset.

### 2.2 Button Hierarchy
- **Primary Button (`#006B3C`):** White text, bold, `8px` radius. Used for `Continue`, `Submit Ticket`, `Create Ticket`. Hover: `#0B7A46`.
- **Secondary Button:** White background, `#D6E0DA` border, `#1F3328` text. Used for `Cancel`, `Back to My Tickets`, `Clear Filters`. Hover: `#F5F7F6`.
- **Destructive Button:** Pale red background (`#FEF3F2`), `#B42318` text and border. Used for `Remove Attachment`.
- **Busy State:** While processing (e.g., ticket submission or file upload), the button is disabled (`opacity: 0.65; cursor: not-allowed`), displays an animated spinner, and updates visible text (e.g., `Submitting...`).

---

## 3. Application Shell

The application shell provides the top navigation across all requester screens:

### Desktop Viewport (`≥ 992px`)
- **Top Header Bar:** Primary Green (`#006B3C`), height `64px`, white text.
- **Left:** TokTickIT branding icon and title.
- **Center / Left-Nav:** Navigation links:
  - `My Tickets`
  - `Create Ticket`
  - Active page is denoted with Pale Green background pill (`#EAF6EF`) and dark text or high-contrast bottom underline.
- **Right:** Selected Development Requester identity pill (avatar icon, user name) and a secondary button `Change Requester`.

### Mobile Viewport (`< 768px`)
- Responsive header maintaining brand logo and a mobile menu / compact bar.
- Navigation links stack or collapse into a responsive drawer.
- Selected Requester identity and `Change Requester` button remain fully visible without horizontal scroll.

---

## 4. Screen Specifications

### 4.1 Development Requester Selection Screen
Simulated user login screen used for Lab 2 multi-user testing.

- **Layout:** Centered white card (`max-width: 520px`) over `#F5F7F6` canvas.
- **Title:** "Select Development Requester" with user selection illustration.
- **Informational Callout (Pale Green `#EAF6EF`):**
  > "Select a Development Requester to test requester-specific ticket behavior. This is not a login screen. Authentication and role-based access will be introduced in Lab 3."
- **Form Controls:**
  - Dropdown: "Development Requester *" showing active users loaded from PostgreSQL.
  - Action: Primary `Continue` button.
- **States:**
  - *Initial:* No user selected; `Continue` disabled.
  - *Loading:* Dropdown disabled; displays "Loading Requesters...".
  - *Ready:* Lists all active requesters (`name (email)`).
  - *Empty:* If 0 active requesters exist, displays: "No active Development Requesters are available."
  - *Failure:* Error callout with a `Retry` action.

---

### 4.2 Create Ticket Screen

- **Layout:** Centered card with structured sections:
- **Top Section — System-Assigned Info (Read-only):**
  - Ticket Number: Displays placeholder `"Assigned after submission"` in read-only shading (`#EEF3F0`).
  - Ticket Date: Current formatted date/time (read-only).
  - Requester: Pre-populated with active requester's name (read-only).
- **Classification Section:**
  - Category: Dropdown with active categories.
  - Related System: Dropdown with active related systems.
  - Requested Priority: Dropdown (`Low`, `Medium`, `High`).
- **Problem Details Section:**
  - Ticket Summary: Text input (`5–120` chars). Helper counter below.
  - Description: Multiline textarea (`10–4000` chars), min height `140px`.
- **Attachments Zone:**
  - Drag-and-drop or file picker button.
  - Helper note: `"Allowed: JPG, PNG, WEBP, PDF • Max 5 MB per file • Max 5 active attachments"`.
  - Selected files list showing filename, formatted file size, and remove-from-selection button.
- **Action Footer:**
  - Secondary `Cancel` button (navigates to My Tickets).
  - Primary `Submit Ticket` button.
- **States:**
  - *Validation Failure:* Field borders turn red; messages appear below inputs; user inputs are retained.
  - *Submitting:* Button disabled with spinner and `Submitting...` text; prevents duplicate clicks.
  - *Success:* Success banner showing official generated Ticket Number (`TKT-YYYY-XXXXXX`) with actions `View Ticket` or `Back to My Tickets`.
  - *API Failure:* Error banner shown; form fields remain populated for retry.

---

### 4.3 My Tickets Screen

- **Top Filter Toolbar:**
  - Page Heading: `My Tickets`
  - Search input: Placeholder `"Search by ticket number, summary, or description..."`
  - Dropdowns:
    - Category: `"All Categories"` + active categories
    - Requested Priority: `"All Priorities"` (`Low`, `Medium`, `High`)
    - Current Status: `"All Statuses"` (`New`)
  - Sort: Sort by Created Date (`Newest First` / `Oldest First`)
  - Action: `Clear Filters` button
  - Action: Primary `+ Create Ticket` button
- **Desktop Table (`≥ 992px`):**
  - Columns: `Ticket No.` | `Created Date` | `Summary` | `Category` | `Requested Priority` | `Current Status`
  - Row interaction: Clicking Ticket Number or row navigates to Ticket Detail.
- **Mobile Card View (`< 768px`):**
  - Responsive cards stacking vertically. Each card displays Ticket Number header, Created Date, Summary excerpt, Category, Priority badge, Status badge, and a `View Details` touch target.
- **Pagination Footer:**
  - Showing `"Page X of Y (Z tickets)"`.
  - Page Size Selector: Dropdown allowing the user to select items per page (`5`, `10`, `25`, `50`, defaulting to `10`). Changing the page size resets the current page index to 1.
  - `Previous` and `Next` buttons (disabled when on page boundaries).
- **States:**
  - *Loading:* Skeleton loader rows or centered spinner.
  - *Empty:* "You have not created any tickets yet." with a primary `Create Ticket` button.
  - *No Results:* "No tickets match your search or filters." with a `Clear Filters` button.
  - *Failure:* Error banner with a `Retry` button.

---

### 4.4 Requester Ticket Detail Screen (View Mode)

- **Navigation & Breadcrumb:**
  - Breadcrumb: `My Tickets > Ticket Details` on the left.
  - Action: Secondary button `← Back to My Tickets` on the right.
- **Header:**
  - Ticket Number header (e.g., `TKT-2026-000101`).
  - Current Status badge (`NEW`).
- **Ticket Information Card (Read-only):**
  - Two-column metadata grid: Ticket Date, Requester, Category, Related System, Requested Priority, Current Status. All fields styled with read-only shading (`#EEF3F0`).
  - Summary and Full Description formatted in clear, readable typography.
- **Attachments Section:**
  - Header: `Attachments (X/5 active)`
  - Active Attachments Table / List:
    - Filename, size (KB/MB), upload timestamp.
    - `Download` button (triggers download/preview).
    - Destructive `Remove` button.
  - Removed Attachments List (Soft-Removed):
    - Displayed in muted styling (`#66756D`).
    - Badge: `Removed`.
    - Shows removal timestamp and removal reason.
    - Download and preview buttons are completely disabled / omitted.
  - Empty State: When 0 attachments exist, displays *"No attachments uploaded for this ticket yet."*
  - `+ Add Attachment` button: Enabled when active attachments < 5; opens upload modal or file picker. When active attachments reach 5, displays helper text *"Maximum active attachments (5/5) reached"*.
- **Soft-Removal Confirmation Dialog:**
  - Modal with backdrop.
  - Title: `"Confirm Attachment Removal"`
  - Text: `"Are you sure you want to remove <filename>? This action cannot be undone."`
  - Required Input: `"Removal Reason *"` textarea (must be non-empty, 5–255 characters).
  - Actions: Secondary `Cancel` button, Destructive `Confirm Removal` button.
- **Scope Exclusion Note:**
  - Per Lab Sheet section 4.2 & 8.5: Public Comments, Internal Notes, Service Actions, Event Log, IT Staff controls, and Resolution Summary shown in the illustrative Figure 1 are strictly excluded from Lab 2.

---

## 5. Status and Priority Badges

### 5.1 Requested Priority Badges
- **LOW:** Neutral slate/gray-green background (`#E2E8F0`), dark text (`#334155`).
- **MEDIUM:** Pale amber background (`#FEF3C7`), dark amber text (`#92400E`).
- **HIGH:** Pale red background (`#FEE2E2`), dark red text (`#991B1B`).

### 5.2 Current Status Badges
- **NEW:** Pale Green background (`#EAF6EF`), Primary Green text (`#006B3C`), `1px` border (`#006B3C`).

---

## 6. Responsive Breakpoints and Layout Matrix

| Viewport | Breakpoint | Layout Adaptations |
|---|---|---|
| **Desktop** | `≥ 992px` | Centered 1200px container; multi-column forms; full desktop data table in My Tickets. |
| **Tablet** | `768px–991px` | Two-column classification forms; table adapts with compact spacing; no clipping. |
| **Mobile** | `< 768px` | Single-column stacked forms; My Tickets switches from table to stacked cards; touch targets ≥ 44px; zero horizontal page scroll. |

---

## 7. Accessibility (A11y) Rules

1. **Keyboard Accessibility:** All interactive elements (`<button>`, `<a>`, `<input>`, `<select>`, `<textarea>`) are focusable via `Tab` key in logical reading order.
2. **Focus Rings:** Distinct Secondary Green (`#0B7A46`) outline is preserved across all active focus states.
3. **Form Association:** Every input is explicitly associated with its `<label>` via `htmlFor` / `id`.
4. **ARIA Attributes:** Modals use `role="dialog"` with focus trapping; loading spinners use `aria-busy="true"`; error messages use `role="alert"`.

---

## 8. Visual Checklist and Screenshot Evidence Paths

### 8.1 Visual Inspection Checklist
Before declaring the UI implementation complete, verify and check all visual quality criteria across Desktop (`≥ 992px`), Tablet (`768–991px`), and Mobile (`< 768px`):

- [ ] **Color Tokens Compliance:** Primary Green (`#006B3C`), Secondary Green (`#0B7A46`), Pale Green (`#EAF6EF`), and neutral borders (`#D6E0DA`) are applied consistently across all screens without unstyled browser defaults.
- [ ] **Editable vs. Read-Only Fields:** System-generated fields (Ticket Number, Ticket Date, Requester Name) use distinct soft shading (`#EEF3F0`) and are clearly distinguishable from editable white-background inputs.
- [ ] **Validation Placement:** Required fields show a red asterisk (`*`), and field-level error messages render immediately **below** the associated inputs in red text rather than in a detached summary at the top.
- [ ] **Button Hierarchy & Busy States:** Primary (`#006B3C`), Secondary (white/bordered), and Destructive (pale red) actions are distinct. The Submit button disables and shows a spinner with `Submitting...` text during requests.
- [ ] **Text Clipping & Label Wrapping:** Zero clipped form labels, unreadable text, or truncated attachment filenames at any supported viewport.
- [ ] **Control & Element Overlap:** No overlapping input fields, error messages, modal dialogs, or dropdown menus across all viewports.
- [ ] **Horizontal Overflow:** Zero horizontal page scrolling (`overflow-x`) on Desktop, Tablet, and Mobile (`375px` viewport width).
- [ ] **Responsive Transition & Touch Targets:** My Tickets switches cleanly from a desktop data table to responsive stacked cards below `768px`. All mobile interactive buttons and controls maintain a minimum touch target of `44px`.

### 8.2 Screenshot Evidence Paths
Visual verification evidence must be captured and stored under the following directory paths:

- `artifacts/lab-02/screenshots/create-ticket/`
  - `desktop-initial.png`, `desktop-validation-error.png`, `desktop-submitting.png`, `desktop-success.png`, `tablet-create-ticket.png`, `mobile-create-ticket.png`
- `artifacts/lab-02/screenshots/my-tickets/`
  - `desktop-table.png`, `desktop-filters-active.png`, `tablet-my-tickets.png`, `mobile-cards.png`, `empty-state.png`, `no-results-state.png`
- `artifacts/lab-02/screenshots/ticket-detail/`
  - `desktop-view.png`, `attachment-modal.png`, `removed-attachment.png`, `tablet-ticket-detail.png`, `mobile-detail.png`
