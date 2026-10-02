# TokTickIT

TokTickIT is a full-stack IT Service Desk project for CPE334.

The repository contains work from Lab 1, Lab 2, and Lab 3. Lab 2 added the Requester-facing ticket workflow. Lab 3 adds login, three roles (Requester, IT Staff, Administrator), the IT Staff ticket workflow, and user management. The Lab 3 engineering documents are in `docs/lab-03/`.

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
│       └── lab-03/
├── server/
│   ├── prisma/
│   ├── src/
│   ├── tests/
│   │   ├── lab-01/
│   │   ├── lab-02/
│   │   └── lab-03/
│   └── uploads/
├── e2e/
│   ├── lab-02/
│   └── lab-03/
├── artifacts/
│   └── lab-03/screenshots/
├── docs/
│   ├── lab-01/
│   ├── lab-02/
│   └── lab-03/
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

The seed is safe to run repeatedly. On a database that still holds the Lab 2 data, the Lab 3 migration keeps every ticket and attachment, and the seed gives the existing users the initial password below.

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

The seed also adds 13 sample tickets (all statuses and priorities, assigned and unassigned) with example Public Comments and Internal Notes.

## Testing

The Lab 3 tests use the seeded accounts above, so run `npm run prisma:seed` first. They never create the users they log in with.

### Backend Tests

```bash
cd server
npx vitest run tests/lab-03    # Lab 3
npm test -- --run              # all labs
```

### Frontend Tests

```bash
cd client
npx vitest run tests/lab-03    # Lab 3
npm test -- --run              # all labs
```

### Playwright E2E Tests

With the backend and frontend running (or let Playwright start them), from the repository root:

```bash
npx playwright test            # runs e2e/lab-03
```

This also refreshes the screenshots in `artifacts/lab-03/screenshots/`.

### Note on the Lab 1 and Lab 2 tests

The Lab 1 and Lab 2 tests were written for the Lab 2 API (no login, a `requesterId` parameter, a Development Requester selector). Lab 3 replaces that on purpose, so those tests are not expected to pass any more. Run the `lab-03` folders for the current behaviour. The server type check (`npm run build`) skips the Lab 1 and Lab 2 test folders for the same reason.

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
