# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal

Develop TokTickIT by replacing the temporary Development Requester selector with real email/password authentication and role-based authorization for Requester, IT Staff, and Administrator. Preserve the Lab 2 Requester Ticket and Attachment functions, add the required IT Staff Ticket workflow and simple Administrator User Management, and enforce authorization on the backend.

## 2. Stakeholder Request Interpretation

The stakeholder wants secure login instead of the temporary Requester selector. Requesters continue their Lab 2 Ticket and Attachment functions. IT Staff can work from a shared Ticket Queue and Ticket Detail, including ownership, IT Priority, status, Public Comments, and Internal Notes. Administrators can manage user accounts and have only the additional Ticket permissions explicitly listed in the authorization matrix. The existing Zen Green design is retained.

## 3. Scope

### 3.1 Included
- Email/password login, logout, current-user retrieval, and first-login password change
- Three roles: Requester, IT Staff, Administrator
- Server-side role and ownership authorization
- Lab 2 Requester Ticket and Attachment functions
- Requester Public Comments and Problem Appears Resolved indication
- IT Staff Ticket Queue and Ticket Detail
- Ticket claim/reassign, IT Priority, permitted status changes, Public Comments, and Internal Notes
- Simple Administrator User Management
- Required database migration, REST APIs, UI changes, validation, feedback, and tests
- Zen Green visual style and responsive behavior from Lab 2

### 3.2 Excluded
- MFA, SSO, social login, email invitations, email password reset/recovery
- Self-registration
- SLA, escalation, notifications, Actions Taken, dashboards/KPIs beyond simple queue counts
- Multi-tenant, department/organization management
- Multiple roles per user
- User deletion, bulk operations, import/export, account history/audit history
- Extended user profiles or profile images
- Production/cloud deployment work
- Advanced account recovery, account unlocking, or admin approval workflows
- Mandatory pagination, multi-column sorting, or multiple simultaneous filters for the Admin user list

## 4. Functional Requirements

### 4.1 Authentication

- **FR-01:** Users shall log in with email and password.
- **FR-02:** The system shall provide logout and current-user retrieval.
- **FR-03:** A user with an initial password shall change it successfully before entering the normal application.

### 4.2 Authorization

- **FR-04:** The system shall support exactly three roles: Requester, IT Staff, and Administrator.
- **FR-05:** Every protected operation shall be authorized by the backend using the authenticated user, role, and ticket ownership where applicable. UI hiding/disablement is only for presentation and is not the security mechanism.

### 4.3 Requester

- **FR-06:** Requesters shall continue to use the existing Lab 2 Ticket and Attachment functions for their own Tickets. No new attachment behavior is introduced by Lab 3.
- **FR-07:** Requesters shall be able to add Public Comments and indicate that a problem appears to be resolved.

### 4.4 IT Staff

- **FR-08:** IT Staff shall be able to use the shared Ticket Queue and open Ticket Detail.
- **FR-09:** IT Staff shall be able to claim/reassign Tickets and change IT Priority.
- **FR-10:** IT Staff shall be able to change Ticket Status only through the permitted status transitions.
- **FR-11:** IT Staff shall be able to add Public Comments and Internal Notes.

### 4.5 Administrator

- **FR-12:** Administrators shall be able to view and search User Accounts by name or email and may filter by role.
- **FR-13:** Administrators shall be able to create a User with exactly one role.
- **FR-14:** Administrators shall be able to update name, email, role, and activation status.
- **FR-15:** Administrators shall be able to set a new initial password for a User.
- **FR-16:** Administrators shall be able to perform only the Ticket Detail actions explicitly granted in the authorization matrix: change IT Priority and add Internal Notes. Administrators do not receive the IT Staff Queue, claim/reassign, or status-changing functions.

## 5. Business Rules

### 5.1 Authentication

- **BR-01:** Only an active User with valid credentials may authenticate.
- **BR-02:** A User with `mustChangePassword = true` cannot enter the normal application until the new password is saved successfully. After a successful password change, `mustChangePassword` shall be set to `false`.
- **BR-03:** Passwords shall be stored as secure password hashes and never as plaintext.
- **BR-04:** Logout shall invalidate the current authenticated session.
- **BR-05:** A deactivated User cannot authenticate.
- **BR-06:** Email addresses shall be unique.
- **BR-07:** The backend shall determine the current User from the authenticated session, not from client-supplied identity fields.

### 5.2 Ownership and Authorization

- **BR-08:** Requester APIs shall use the authenticated User identity instead of accepting a client-selected `requesterId` as the authority for ownership.
- **BR-09:** A Requester may access and manage only their own Tickets and Attachments.
- **BR-10:** Protected operations shall be rejected when the authenticated User does not have permission.

### 5.3 Authorization Matrix

| Function | Requester | IT Staff | Administrator |
|---|---:|---:|---:|
| Login / Logout | ✓ | ✓ | ✓ |
| Own Ticket functions | ✓ | — | — |
| Own Attachment functions | ✓ | — | — |
| Add Public Comments | ✓ | ✓ | — |
| Indicate Problem Appears Resolved | ✓ | — | — |
| View Ticket Queue | — | ✓ | — |
| View Ticket Detail | Own Tickets | ✓ | ✓ (for permitted actions only) |
| Claim / Reassign | — | ✓ | — |
| Set IT Priority | — | ✓ | ✓ |
| Change Ticket Status | — | ✓ | — |
| Add Internal Notes | — | ✓ | ✓ |
| View User Accounts | — | — | ✓ |
| Create User | — | — | ✓ |
| Update User | — | — | ✓ |
| Activate / Deactivate User | — | — | ✓ |
| Set Initial Password | — | — | ✓ |

Administrators may access Ticket Detail only for the actions explicitly permitted to them: changing IT Priority and adding Internal Notes. They do not receive Ticket Queue, Claim/Reassign, or Ticket Status functions.

### 5.4 Ticket Assignment and Priority

- **BR-11:** A Ticket may have zero or one primary Owner.
- **BR-12:** A Ticket Owner, when assigned, must be an active IT Staff or Administrator.
- **BR-13:** IT Priority shall initially copy Requested Priority.
- **BR-14:** Only IT Staff or Administrator may change IT Priority.
- **BR-15:** Requested Priority shall remain unchanged when IT Priority changes.

### 5.5 Ticket Status

- **BR-16:** Tickets shall use only: New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, Cancelled.
- **BR-17:** Status changes shall follow the transition matrix below.
- **BR-18:** Only IT Staff may change Ticket Status.
- **BR-19:** Requesters may indicate Problem Appears Resolved but cannot directly set Resolved or Closed.
- **BR-20:** No additional confirmation dialog is required for status changes in Lab 3; the normal Save/Change Status action is the confirmation. The transition and role checks are the required validation.

#### Status Transition Matrix

| Current | Allowed Next | Role | Confirmation |
|---|---|---|---|
| New | Open, Cancelled | IT Staff | None |
| Open | In Progress, Waiting for Requester, Resolved, Cancelled | IT Staff | None |
| In Progress | Waiting for Requester, Resolved, Cancelled | IT Staff | None |
| Waiting for Requester | In Progress, Resolved, Cancelled | IT Staff | None |
| Resolved | Closed, Reopened | IT Staff | None |
| Reopened | In Progress, Waiting for Requester, Resolved, Cancelled | IT Staff | None |
| Closed | Reopened | IT Staff | None |
| Cancelled | None | None | Final status |

If the Ticket does not exist or the requested transition is not in the matrix, the operation shall be rejected.

### 5.6 Public Comments and Internal Notes

- **BR-21:** Public Comments are visible to Requester, IT Staff, and Administrator.
- **BR-22:** Internal Notes are visible only to IT Staff and Administrator.
- **BR-23:** Comments and Notes are append-only in Lab 3; they cannot be edited or deleted.
- **BR-24:** Empty or whitespace-only content shall be rejected.
- **BR-25:** Comment/Note content is limited to 1,000 characters. This is a simple UI/API validation limit for Lab 3; no richer text editor is required.
- **BR-26:** Each entry shall record its author and backend creation time.
- **BR-27:** Comment and Note content shall be rendered as plain text; user-entered HTML shall not be interpreted as markup.

### 5.7 Administrator Rules

- **BR-28:** Each User has exactly one role.
- **BR-29:** Duplicate email addresses shall be rejected on create and update.
- **BR-30:** A newly assigned initial password sets `mustChangePassword = true`.
- **BR-31:** An Administrator cannot deactivate their own account.
- **BR-32:** The system shall not allow deactivation that leaves zero active Administrators.
- **BR-33:** Users are deactivated rather than deleted.

### 5.8 Validation and Regression

- **BR-34:** Invalid input shall be rejected with clear feedback.
- **BR-35:** Protected-resource errors shall not disclose unauthorized resource details.
- **BR-36:** Lab 2 Tickets and Attachments shall be preserved and remain usable after migration.

## 6. UI Specification Summary

- Keep the Lab 2 Zen Green design and reusable components.
- Show the authenticated user's name, role, and Logout action.
- Show only the navigation/actions allowed by the authorization matrix. Backend authorization remains the security control.
- Use clear status/role badges.
- Provide loading, saving, success, validation-error, empty, no-results, forbidden, not-found, conflict, and safe API-failure feedback where applicable.
- Keep desktop, tablet, and mobile support.

### 6.1 Login

- Email and password fields.
- Safe response for invalid credentials or inactive users.
- Mandatory Change Password screen for users with an initial password.

### 6.2 Requester

- Preserve Lab 2 Ticket and Attachment behavior.
- Remove the Development Requester selector.
- Use the authenticated Requester identity.
- Add Public Comments and Problem Appears Resolved.

### 6.3 IT Staff

- Ticket Queue with simple search, required queue filters, sorting, and pagination.
- Ticket Detail with owner, IT Priority, status, Public Comments, Internal Notes, and Attachments as applicable.
- Claim/Reassign, IT Priority, and status controls only where permitted.
- Public Comments and Internal Notes must be visually distinct.

### 6.4 Administrator

- Simple User Management screen.
- User list fields: Name, Email, Role, Status, Edit.
- Search by name/email and optional role filter.
- Create/edit User with name, email, one role, activation status, and initial password as required.
- Set a new initial password.
- Administrators may access permitted Ticket Detail actions for changing IT Priority and adding Internal Notes. They do not receive Ticket Queue, Claim/Reassign, or Ticket Status controls.
- Show validation/duplicate-email/self-deactivation/no-active-Admin feedback.

## 7. Data Model and Migration

### 7.1 User

Evolve the existing Lab 2 `RequesterUser` into `User` rather than creating a second user table.

Minimum User fields:

| Field | Purpose |
|---|---|
| `id` | Existing user identifier |
| `name` | User name |
| `email` | Unique login email |
| `passwordHash` | Secure password hash |
| `role` | `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR` |
| `isActive` | Account activation state |
| `mustChangePassword` | Whether an initial password must be changed |
| `createdAt` | Creation time |
| `updatedAt` | Last update time |

Keep the existing Lab 2 User identifiers where possible so existing Ticket requester relationships can be preserved simply.

### 7.2 Ticket

Extend the existing Ticket model without discarding data:

- Keep the existing Ticket number, Requester, Category, Related System, Summary, Description, Requested Priority, timestamps, and Attachment relationships.
- Change the Requester relationship from `RequesterUser` to `User`.
- Add an optional primary Owner relationship to `User`.
- When assigned, the Owner must be an active IT Staff or Administrator.
- Add `itPriority`, initially copied from `requestedPriority`.
- Extend Ticket Status to the Lab 3 status set.
- Preserve existing Tickets and Attachments.

### 7.3 Comments and Notes

Store Public Comments and Internal Notes as Ticket-related records with:

- Ticket reference
- Author User reference
- Type: Public Comment or Internal Note
- Content
- Backend creation time

They are append-only in Lab 3.

### 7.4 Relationships and Indexes

- One User may request many Tickets.
- One User may own many Tickets.
- A Ticket has zero or one Owner.
- A Ticket has many Comments/Notes.
- Preserve Category, Related System, and Attachment relationships.
- Keep useful Lab 2 indexes and add indexes needed for User email, Ticket requester/owner/status/priority, and Comment/Note ticket + creation time.

### 7.5 Migration

- Evolve `RequesterUser` into `User`.
- Preserve existing Requester records and IDs where possible.
- Existing Requesters receive role `REQUESTER`.
- Existing Tickets keep their Requester relationship.
- Existing Attachments remain attached to their Tickets.
- Existing Requesters receive local initial passwords and `mustChangePassword = true`.
- Remove the temporary Development Requester selector/client identity state.
- Protected Ticket/Attachment APIs use the authenticated User identity.

### 7.6 Seed Data

Seed must be idempotent and include at least:

- 4 active Requesters and 1 inactive Requester
- 3 active IT Staff and 1 inactive IT Staff
- 1 active Administrator
- Realistic Tickets across Requesters, statuses, priorities, and assigned/unassigned states
- Example Public Comments and Internal Notes
- Local/development credentials only; no real secrets

## 8. API Contract

`api-spec.md` is the detailed API contract. It shall define method, path, authentication requirement, request/response shape, and status codes for every endpoint.

At minimum the API shall support:

### 8.1 Authentication

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

Decision: use a simple server-side session stored by the server and identified by an HTTP-only, SameSite cookie. The client does not store authentication tokens in local storage.

### 8.2 Requester APIs

Preserve Lab 2 Ticket and Attachment APIs. The backend derives Requester identity from the authenticated session instead of accepting a client-supplied `requesterId` as the authority for ownership, and checks ownership before allowing access or modification.

### 8.3 IT Staff APIs

Support Ticket Queue search/filter/sort/pagination, Ticket Detail, claim/reassign, IT Priority, permitted status changes, Public Comments, and Internal Notes.

### 8.4 Administrator APIs

Support User list/search, optional role filter, create User, update User, activate/deactivate, and set initial password.

Administrators may also use the permitted Ticket Detail actions for changing IT Priority and adding Internal Notes. They do not receive Ticket Queue, claim/reassign, or Ticket Status functions.

### 8.5 API Security and Errors

- Backend authorization is required for every protected endpoint.
- Unauthenticated requests, forbidden requests, invalid input, missing resources, conflicts, and unexpected failures shall be distinguishable as appropriate.
- Protected-resource errors shall not reveal unauthorized resource existence or details.
- Logout invalidates the current session.

## 9. Acceptance Criteria

- **AC-01:** Given an active User with valid credentials, when the User submits the login form, then the User is authenticated and an authenticated session is created; given an inactive User or invalid credentials, when the User submits the login form, then the login request is rejected safely.
- **AC-02:** Given a User with `mustChangePassword = true`, when the User logs in, then the User must change the password successfully before entering the normal application.
- **AC-03:** Given an authenticated User attempts to access a protected operation, when the User does not have the required role or ticket ownership, then the backend rejects the request even when the API is called directly.
- **AC-04:** Given an authenticated Requester, when the Requester uses Ticket or Attachment functions, then the system allows access only to the Requester's own Tickets and uses the authenticated identity to determine ownership.
- **AC-05:** Given an authenticated Requester viewing their own Ticket, when the Requester submits a Public Comment or indicates that the problem appears resolved, then the system records the permitted action.
- **AC-06:** Given an authenticated IT Staff User, when the User accesses the Ticket Queue or Ticket Detail, then the User can claim/reassign Tickets, change IT Priority, change permitted statuses, and add Public Comments and Internal Notes.
- **AC-07:** Given an authenticated Administrator, when the Administrator manages User Accounts or accesses permitted Ticket Detail actions, then the Administrator can manage Users and change IT Priority or add Internal Notes, but cannot access the Ticket Queue, claim/reassign Tickets, or change Ticket Status.
- **AC-08:** Given a Ticket with Public Comments and Internal Notes, when an authorized User views the Ticket, then Public Comments are visible to Requester, IT Staff, and Administrator, while Internal Notes are visible only to IT Staff and Administrator.
- **AC-09:** Given a User submits a Comment or Internal Note, when the content is empty, whitespace-only, or exceeds 1,000 characters, then the system rejects the submission; when valid content is submitted, then the content is rendered as plain text.
- **AC-10:** Given a Ticket with a current status, when an IT Staff User requests a status change, then the system allows only transitions defined in the status transition matrix and rejects invalid transitions; a Requester cannot directly set a Ticket to Resolved or Closed.
- **AC-11:** Given an Administrator attempts to create or update a User or deactivate an Administrator account, when the email is duplicated, the Administrator attempts to deactivate their own account, or the action would leave no active Administrator, then the system rejects the operation.
- **AC-12:** Given existing Lab 2 Tickets and Attachments, when the Lab 2 data is migrated to Lab 3, then the existing Tickets and Attachments remain available and usable.
- **AC-13:** Given an authenticated User, when the User logs out, then the current authenticated session is invalidated and protected resources can no longer be accessed through that session.
- **AC-14:** Given a User performs an applicable system action, when the system is loading, saving, succeeds, receives invalid input, has no results, or encounters a forbidden, not-found, conflict, or safe API failure condition, then the UI displays the corresponding required feedback.

## 10. Definition of Done

- All FR and BR in this specification are implemented.
- Authentication, logout, current-user retrieval, and first-login password change work.
- Backend RBAC and ownership checks are implemented for all protected operations.
- Lab 2 Requester Ticket/Attachment behavior still works.
- IT Staff Queue and Ticket Detail work with the defined workflow.
- Administrator User Management works with the defined rules.
- Migration preserves Tickets and Attachments.
- Seed data is idempotent and satisfies the required role counts.
- `api-spec.md` matches the implemented API.
- UI follows Zen Green and required feedback states.
- Acceptance tests cover authentication, authorization, ownership, queue, priority, status, comments/notes, admin management, migration, responsive/accessibility behavior, and safe failures.
- No critical regression or unauthorized-access issue remains.

## 11. Assumptions and Decisions

1. **User migration:** Evolve `RequesterUser` into `User` and preserve existing IDs/relationships where possible. This is the simplest way to preserve Lab 2 data.
2. **Authentication:** Use a server-side session with an HTTP-only, SameSite cookie. No JWT/refresh-token system is needed for Lab 3.
3. **Roles:** Exactly one role per User.
4. **Admin permissions:** Admin is separate from IT Staff. Admin gets only User Management plus IT Priority/Internal Notes as explicitly required by the matrix; Admin does not get the IT Queue, claim/reassign, or status functions.
5. **Ticket Owner:** Zero or one primary Owner; if assigned, the Owner is an active IT Staff or Administrator.
6. **IT Priority:** Initially copy Requested Priority; later changes do not modify Requested Priority.
7. **Status confirmation:** No extra confirmation dialog. The Save/Change Status action is the confirmation.
8. **Comments/Notes:** Append-only, maximum 1,000 characters, plain-text rendering, author and backend creation time.
9. **API detail:** Exact request/response schemas and status codes belong in `api-spec.md`; this specification only defines required API capabilities.
10. **Lab 2 preservation:** Existing Tickets and Attachments are migrated in place rather than recreated.