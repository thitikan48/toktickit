# TokTickIT

TokTickIT is a full-stack IT Service Desk project for CPE334.

The repository contains work from Lab 1 to Lab 4. Lab 2 added the Requester-facing ticket workflow. Lab 3 added login, three roles (Requester, IT Staff, Administrator), the IT Staff ticket workflow, and user management. Lab 4 adds Actions Taken, the final ticket workflow (resolution gate, status history, stale update check), and a Dashboard for each role.

## Tech Stack

- Frontend: React + TypeScript + Vite + Bootstrap
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Testing: Vitest + Supertest + React Testing Library + Playwright

## Repository Structure

```text
toktickit/
├── client/
│   ├── src/
│   └── tests/
│       ├── lab-01/
│       ├── lab-02/
│       ├── lab-03/
│       └── lab-04/
├── server/
│   ├── prisma/
│   ├── src/
│   ├── tests/
│   │   ├── lab-01/
│   │   ├── lab-02/
│   │   ├── lab-03/
│   │   └── lab-04/
│   └── uploads/
├── e2e/
│   ├── lab-02/
│   ├── lab-03/
│   └── lab-04/
├── artifacts/
│   ├── lab-02/screenshots/
│   ├── lab-03/screenshots/
│   └── lab-04/screenshots/
├── docs/
│   ├── lab-01/
│   ├── lab-02/
│   ├── lab-03/
│   └── lab-04/
├── playwright.config.ts
├── .gitignore
└── README.md
```

## Setup

### Clone the Repository

```bash
git clone https://github.com/thitikan48/toktickit.git
cd toktickit
```

### Backend

```bash
cd server
npm install
copy .env.example .env
```

Update `DATABASE_URL` in `.env` with your local PostgreSQL credentials. The other settings are described in [Environment](#environment).

Run the Prisma migrations and seed the data:

```bash
npx prisma migrate dev
npm run prisma:seed
```

The seed is safe to run repeatedly. On a database that still holds the Lab 2 data, the Lab 3 migration keeps every ticket and attachment, and the seed gives the existing users the initial password below. The Lab 4 migration only adds new tables and columns, so all earlier data stays.

Start the backend:

```bash
npm run dev
```

Backend:

```text
http://localhost:3000
```

### Frontend

Open another terminal from the repository root:

```bash
cd client
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Open the application with `localhost` (not `127.0.0.1`): the login cookie is only sent to the API when both use the same host name.

## Seeded Accounts (local development only)

Every seeded account uses the initial password **`ChangeMe123`** (set `SEED_INITIAL_PASSWORD` before seeding to use another one). It is a local development value, not a real secret. Accounts marked "first login" must choose a new password before they can use the application; the others can be used right away.

| Role | Name | Email | State |
|---|---|---|---|
| Requester | Jennifer Anderson | jennifer.anderson@example.com | ready |
| Requester | Michael Brown | michael.brown@example.com | first login |
| Requester | Sarah Johnson | sarah.johnson@example.com | first login |
| Requester | David Lee | david.lee@example.com | first login |
| Requester | Alex Ford | alex.ford@example.com | inactive |
| IT Staff | Priya Nair | priya.nair@example.com | ready |
| IT Staff | Marcus Chen | marcus.chen@example.com | first login |
| IT Staff | Elena Rossi | elena.rossi@example.com | ready |
| IT Staff | Tom Baker | tom.baker@example.com | inactive |
| Administrator | Admin User | admin@example.com | ready |

The seed also adds 13 sample tickets (all statuses and priorities, assigned and unassigned) with example Public Comments and Internal Notes, and (Lab 4) 9 Actions Taken in all four action statuses. The expected dashboard numbers are in `docs/lab-04/specification.md` section 7.4.

## Demo (Lab 4)

Start the backend and frontend on a freshly seeded database. Every account uses the password `ChangeMe123`; first-login accounts must set a new password first.

1. **IT Staff Dashboard.** Log in as Priya Nair (`priya.nair@example.com`). The Dashboard opens first. Show the cards (Unassigned 3, My open tickets 2, My open actions 1), the status counts, and the recent lists. Click a card to open the filtered Ticket Queue.
2. **Actions Taken.** Open **TKT-2026-900003** (Cannot sign in to email). It has 3 actions: Completed, In Progress, and Cancelled. Add a new action, then edit the In Progress one. Completed and Cancelled actions are read-only.
3. **Resolution gate.** Try to change the status to Resolved. It is blocked because open actions remain. Set the open actions to Completed or Cancelled, then resolve the Ticket.
4. **Status Timeline.** Show the new status change at the top of the Status Timeline card.
5. **Stale update.** Open the same Ticket in a second browser window (also as Priya). Change the IT Priority in one window, then save a change in the other. The second save shows "This ticket was changed by someone else" with a Reload button.
6. **Requester Dashboard.** Log in as Jennifer Anderson (`jennifer.anderson@example.com`). Show Open tickets, Waiting for me, and the Recently updated and Recently resolved lists (TKT-2026-900013). To see the Requester view of TKT-2026-900003 (actions and timeline, read-only), log in as its Requester, Michael Brown.

## Rolling Back the Lab 4 Migration

The Lab 4 migration (`20261101000000_lab4_actions_taken`) has a recovery script, `down.sql`, in the same folder. It removes only the Lab 4 objects (the `ActionTaken` and `TicketStatusHistory` tables, the `ActionStatus` type, and the `resolvedAt` and `version` columns) and the migration's row in `_prisma_migrations`. All Lab 1 to 3 data stays. **All Actions Taken and status history rows are lost.**

```bash
cd server
npx prisma db execute --file prisma/migrations/20261101000000_lab4_actions_taken/down.sql --schema prisma/schema.prisma
```

This runs on the database in `DATABASE_URL`. To apply the migration again afterwards:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

The migration test (MIG-02) runs the same script in a scratch schema on the test database and rolls it back, so the script is checked on every `npm test`.

## Testing

The tests use the seeded accounts above. They never create the users they log in with (except the User Management test, which creates one through the app and removes it again).

### Test Database (Lab 4)

From Lab 4 the server tests and the E2E tests use their own database, `toktickit_test`, so they never change the demo data in `toktickit`.

1. Create the empty database once (use your own PostgreSQL user):

   ```bash
   psql -U postgres -c "CREATE DATABASE toktickit_test"
   ```

2. Create `server/.env.test` with the same connection string as `.env`, but with the database name `toktickit_test`:

   ```text
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/toktickit_test?schema=public"
   ```

   This file is ignored by git. `npm test` stops with a clear message if it is missing.

Before the server tests start, the test setup runs `prisma migrate deploy` and the seed on `toktickit_test`. The two dashboard test files also reset and reseed `toktickit_test` first, because their expected numbers come from the seed. The reset refuses to run on any other database.

### Backend Tests

```bash
cd server
npm test                       # server/tests/lab-04 on toktickit_test
```

### Frontend Tests

```bash
cd client
npm test                       # client/tests/lab-04
```

### Playwright E2E Tests

From the repository root:

```bash
npx playwright test            # e2e/lab-04
```

Playwright starts its own API server on `toktickit_test` and the Vite dev server, so **stop your own `npm run dev` servers first** (ports 3000 and 5173 must be free). The run also refreshes the screenshots in `artifacts/lab-04/screenshots/`.

### Note on the Lab 1 to Lab 3 tests

The Lab 1 to 3 test files are kept unchanged as a record. Some of them no longer pass because a later lab changed the requirement on purpose:

- Lab 1 and Lab 2 tests were written for the Lab 2 API (no login, a `requesterId` parameter, a Development Requester selector). Lab 3 replaced that.
- Some Lab 3 tests expect the Lab 3 screens and API: no `expectedVersion`, My Tickets or the Ticket Queue as the first screen, and attachments that only existed in the development database.

The full list, with the reason for each, is in `docs/lab-04/reviewer.md`. The Lab 4 regression tests (`server/tests/lab-04/regression.api.test.ts`) check the Lab 1 to 3 features again with the current rules. The type checks (`npm run build`) skip the old test folders for the same reason.

## Environment

Do not commit the real `.env` file. Use `server/.env.example` as the template.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | API port (default `3000`) |
| `CLIENT_ORIGIN` | Browser origin allowed to call the API (default `http://localhost:5173`) |
| `SESSION_SECRET` | Secret that signs the session cookie. Optional for local development (a random one is used); required when `NODE_ENV=production` |
| `SEED_INITIAL_PASSWORD` | Optional: initial password used by the seed (default `ChangeMe123`) |

If the API answers with an unexpected error, the real cause is written to the terminal that runs `npm run dev` in `server`; the browser only receives a safe, generic message.
