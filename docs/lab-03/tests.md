# TokTickIT — Lab 3 Test Plan

## 1. Purpose
This test plan defines the tests for the Lab 3 increment before or alongside implementation. The plan covers unit, API/integration, UI component, UI style, responsive, security/authorization, migration/regression, and end-to-end behavior.

The tests verify:
- Authentication & Session Invalidation
- Role-Based Authorization (RBAC)
- Requester Ownership & Lab 2 Compatibility
- IT Staff Ticket Workflow & Queue Queries
- Administrator User Management & Safety Rules
- Data Migration & Preservation
- Validation & Safe Failures
- Zen Green UI Design & Responsive Behavior

---

## 2. Test Plan Matrix

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
 
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UNIT-01** | Unit | BR-17 | Valid Ticket Status transitions | Only transitions defined in the status matrix are accepted | `server/tests/lab03/status.unit.test.ts` | |
| **UNIT-02** | Unit | BR-24, BR-25 | Comment/Note validation | Blank content and content over 1000 characters are rejected | `server/tests/lab03/comment-validation.unit.test.ts` | |
| **UNIT-03** | Unit | BR-28, BR-29 | User role and email validation | User has exactly one valid role and duplicate email is rejected | `server/tests/lab03/user-validation.unit.test.ts` ||
| **UNIT-04** | Unit | BR-31, BR-32 | Administrator safety rules | Self-deactivation and removing the last active Administrator are rejected | `server/tests/lab03/admin-safety.unit.test.ts` ||
| **UNIT-05** | Unit | BR-03, BR-30 | Password validation | Invalid password input is rejected and accepted passwords are handled without storing plaintext | `server/tests/lab03/password-validation.unit.test.ts` ||
| **API-01** | API / Integration | AC-01 | Valid login | Active user with valid credentials receives an authenticated response with safe user data | `server/tests/lab03/auth.api.test.ts` ||
| **API-02** | API / Integration | AC-01 | Invalid login | Invalid credentials are rejected without exposing sensitive authentication details | `server/tests/lab03/auth.api.test.ts` ||
| **API-03** | API / Integration | AC-01 | Inactive account login | Inactive users cannot authenticate | `server/tests/lab03/auth.api.test.ts` ||
| **API-04** | API / Integration | AC-02 | Initial password | User with `mustChangePassword` cannot access the normal application until the password is changed successfully | `server/tests/lab03/first-login.api.test.ts` ||
| **API-05** | API / Integration | AC-02 | Password boundaries | Password values outside the accepted validation rules are rejected and valid boundary values are accepted | `server/tests/lab03/password.api.test.ts` ||
| **API-06** | API / Integration | AC-13 | Logout | Logout invalidates the session and subsequent protected requests are rejected | `server/tests/lab03/auth.api.test.ts` ||
| **API-07** | API / Integration | AC-03 | Direct API authorization | Backend rejects requests from users without the required role or ownership | `server/tests/lab03/authorization.api.test.ts` ||
| **API-08** | API / Integration | AC-04 | Requester ownership | Requester can access only their own tickets and attachments | `server/tests/lab03/ownership.api.test.ts` ||
| **API-09** | API / Integration | AC-03 | Requester Internal Notes | Requester requests to add Internal Notes are forbidden and Internal Notes are not returned to the Requester | `server/tests/lab03/notes.api.test.ts` ||
| **API-10** | API / Integration | AC-04 | Lab 2 Requester regression | Existing Requester Ticket and Attachment functions continue to work after authentication is introduced | `server/tests/lab03/requester-regression.api.test.ts` ||
| **API-11** | API / Integration | AC-06 | IT Staff Ticket Queue | IT Staff can access the shared queue; unauthorized roles cannot | `server/tests/lab03/queue.api.test.ts` ||
| **API-12** | API / Integration | AC-06 | Queue queries | Queue search, status, priority, owner, sorting, and pagination behave as specified | `server/tests/lab03/queue.api.test.ts` ||
| **API-13** | API / Integration | AC-06 | Claim / Reassign | IT Staff can claim or reassign tickets; unauthorized roles are rejected | `server/tests/lab03/assignment.api.test.ts` ||
| **API-14** | API / Integration | AC-06, AC-07 | IT Priority | IT Staff and Administrators can change IT Priority; Requesters cannot | `server/tests/lab03/priority.api.test.ts` ||
| **API-15** | API / Integration | AC-06, AC-07 | Requested Priority preservation | Changing IT Priority does not change Requested Priority | `server/tests/lab03/priority.api.test.ts` ||
| **API-16** | API / Integration | AC-06, AC-10 | Status transitions | Only IT Staff can perform valid status transitions; invalid transitions are rejected | `server/tests/lab03/status.api.test.ts` ||
| **API-17** | API / Integration | AC-05, AC-08, AC-09 | Public Comments | Requester and IT Staff can add valid Public Comments; blank/oversized comments are rejected | `server/tests/lab03/comments.api.test.ts` ||
| **API-18** | API / Integration | AC-07, AC-08 | Administrator Public Comment restriction | Administrators cannot add Public Comments | `server/tests/lab03/comments.api.test.ts` ||
| **API-19** | API / Integration | AC-08, AC-09 | Internal Notes | IT Staff and Administrators can add valid Internal Notes; notes remain hidden from Requesters | `server/tests/lab03/notes.api.test.ts` ||
| **API-20** | API / Integration | AC-05 | Problem appears resolved | Requester can record the permitted action without directly changing the ticket to Resolved or Closed | `server/tests/lab03/problem-resolved.api.test.ts` ||
| **API-21** | API / Integration | AC-07, AC-11 | User listing and search | Administrator can list users, search by name/email, and optionally filter by role | `server/tests/lab03/users.api.test.ts` ||
| **API-22** | API / Integration | AC-07, AC-11 | User creation | Administrator can create a user with one valid role and an initial password | `server/tests/lab03/users.api.test.ts` ||
| **API-23** | API / Integration | AC-11 | Duplicate email | User creation/update with an existing email is rejected | `server/tests/lab03/users.api.test.ts` ||
| **API-24** | API / Integration | AC-07, AC-11 | User editing | Administrator can edit name, email, role, and activation state according to the rules | `server/tests/lab03/users.api.test.ts` ||
| **API-25** | API / Integration | AC-07, AC-11 | Activation / Deactivation | Administrator can activate/deactivate users while respecting Administrator safety rules | `server/tests/lab03/users.api.test.ts` ||
| **API-26** | API / Integration | AC-11 | Initial password behavior | Setting a new initial password sets `mustChangePassword` and stores only a secure password hash | `server/tests/lab03/users.api.test.ts` ||
| **API-27** | API / Integration | AC-11 | Administrator safety | Administrator cannot deactivate self or remove the last active Administrator | `server/tests/lab03/users.api.test.ts` ||
| **API-28** | API / Integration | AC-07 | Administrator Ticket Detail permissions | Administrator can change IT Priority and add Internal Notes, but cannot use Queue, Claim/Reassign, or Status actions | `server/tests/lab03/admin-ticket-permissions.api.test.ts` ||
| **API-29** | API / Integration | AC-07 | Non-Administrator User Management access | Requesters and IT Staff cannot access User Management endpoints | `server/tests/lab03/users.api.test.ts` ||
| **API-30** | API / Integration | AC-14 | Safe failures | Invalid input and unauthorized requests return clear errors without exposing protected details | `server/tests/lab03/error-handling.api.test.ts` ||
| **API-31** | API / Integration | AC-12 | Migration | Existing Lab 2 users, tickets, attachments, and relationships remain preserved after migration | `server/tests/lab03/migration.api.test.ts` ||
| **API-32** | API / Integration | AC-12 | Seed data | Required active/inactive Requesters, IT Staff, Administrator, and realistic ticket data are available | `server/tests/lab03/seed.api.test.ts` ||
| **UI-01** | UI Component | AC-01, AC-02 | Login UI | Login, invalid credentials, inactive accounts, and initial-password flow display the required states | `e2e/lab-03/login.spec.ts` ||
| **UI-02** | UI Component | AC-04, AC-05 | Requester UI | Requester sees own tickets, attachments, Public Comments, and problem-resolved action | `e2e/lab-03/requester.spec.ts` ||
| **UI-03** | UI Component | AC-06 | IT Staff UI | IT Staff sees Queue and permitted Ticket Detail controls | `e2e/lab-03/it-staff.spec.ts` |
| **UI-04** | UI Component | AC-07, AC-11 | Administrator User Management UI | Administrator can list, search, filter, create, edit, activate/deactivate users, and set initial passwords | `e2e/lab-03/admin-users.spec.ts` ||
| **UI-05** | UI Component | AC-07 | Administrator Ticket Detail UI | Administrator can change IT Priority and add Internal Notes, but does not receive Queue, Claim/Reassign, or Status controls | `e2e/lab-03/admin-ticket-detail.spec.ts` ||
| **UI-06** | UI Component | AC-08, AC-09 | Comment/Note feedback | Validation and visibility rules are correctly represented in the UI | `e2e/lab-03/comments-notes.spec.ts` ||
| **UI-STYLE-01** | UI Style | UI Spec Sec. 1 | Zen Green design | Lab 3 screens use the required Zen Green design language and reusable components | `e2e/lab-03/style.spec.ts` ||
| **UI-STYLE-02** | UI Style | UI Spec Sec. 6 | Status / Role / Priority badges | Required badges use consistent styling and labels | `e2e/lab-03/style.spec.ts` ||
| **RESP-01** | Responsive | UI Spec Sec. 6 | Responsive behavior | Authentication, ticket, queue, and user-management screens remain usable at supported screen sizes | `e2e/lab-03/responsive.spec.ts` ||
| **SEC-01** | Security / Authorization | AC-03 | Role enforcement | Backend rejects operations that are outside the authenticated user's role | `server/tests/lab03/authorization.api.test.ts` ||
| **SEC-02** | Security / Authorization | AC-03 | Ownership enforcement | Requester cannot access or modify another Requester's ticket or attachment | `server/tests/lab03/ownership.api.test.ts` ||
| **SEC-03** | Security / Authorization | AC-01, AC-13 | Session security | Invalid, logged-out, or inactive sessions cannot access protected resources | `server/tests/lab03/auth.api.test.ts` ||
| **SEC-04** | Security / Authorization | AC-03 | Client bypass protection | Changing client-side IDs or hidden UI controls cannot bypass backend authorization | `server/tests/lab03/authorization.api.test.ts` ||
| **SEC-05** | Security / Authorization | AC-01, AC-02 | Password protection | Passwords are hashed and are not returned in API responses | `server/tests/lab03/auth.api.test.ts` ||
| **MIG-01** | Migration / Regression | AC-12 | Lab 2 data preservation | Existing Lab 2 ticket and attachment data and relationships are preserved | `server/tests/lab03/migration.api.test.ts` ||
| **MIG-02** | Migration / Regression | AC-12 | Requester regression | Existing Lab 2 Requester behavior continues to work after migration | `server/tests/lab03/requester-regression.api.test.ts` ||
| **E2E-01** | E2E | AC-01, AC-02, AC-04, AC-05 | Requester workflow | Requester logs in, completes initial password change if required, uses own tickets, adds a comment, and records problem-resolved | `e2e/lab-03/requester-workflow.spec.ts` ||
| **E2E-02** | E2E | AC-02 | Initial password login and change | Normal application opens only after a valid initial-password change | `e2e/lab-03/first-login.spec.ts` ||
| **E2E-03** | E2E | AC-06, AC-10 | IT Staff workflow | IT Staff accesses Queue, manages ownership, priority, status, comments, and notes according to the rules | `e2e/lab-03/it-staff-workflow.spec.ts` ||
| **E2E-04** | E2E | AC-07, AC-11 | Administrator workflow | Administrator manages users and performs only the permitted Ticket Detail actions | `e2e/lab-03/admin-workflow.spec.ts` ||
| **E2E-05** | E2E | AC-12 | Migration / regression workflow | Migrated Lab 2 data remains usable after authentication and authorization are enabled | `e2e/lab-03/migration-workflow.spec.ts` ||

---

## 3. Required Coverage
The test plan covers all key areas required by the Lab 3 sheet:

* Valid and invalid login, inactive accounts
* Initial-password behavior and password validation boundaries
* Logout and session invalidation
* Role-based navigation and direct API authorization
* Requester ownership and Lab 2 Ticket/Attachment regression
* IT Staff Queue queries, Claim/Reassign, IT Priority, and Ticket Status transition rules
* Public Comments, Internal Notes, and Problem appears resolved
* Administrator User Management (listing, search, role filtering, creation, editing, duplicate-email rejection, activation/deactivation, initial password reset)
* Administrator Ticket Detail permissions
* Admin safety rules (prevention of self-deactivation and removing the last active Administrator)
* Migration preservation
* Responsive behavior
* Safe failures
* E2E workflows

---

## 4. Test-First Requirement
The tests are created before or alongside implementation. Automated test files listed in this plan are target paths for execution and should be implemented as part of the Lab 3 increment rather than reconstructed only after coding is complete.