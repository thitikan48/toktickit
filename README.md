# TokTickIT

TokTickIT is a full-stack IT Service Desk project for CPE334.

The repository contains work from Lab 1 and Lab 2, with Lab 2 extending the project with the Requester-facing ticket workflow.

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
│       └── lab-02/
├── server/
│   ├── prisma/
│   ├── src/
│   ├── tests/
│   │   ├── lab-01/
│   │   └── lab-02/
│   └── uploads/
├── e2e/
│   └── lab-02/
├── docs/
│   ├── lab-01/
│   └── lab-02/
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

Update `DATABASE_URL` in `.env` with your local PostgreSQL credentials.

Run Prisma migrations and seed data:

```bash
npx prisma migrate dev
npm run prisma:seed
```

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

## Testing

### Backend Tests

```bash
cd server
npm test -- --run
```

### Frontend Tests

```bash
cd client
npm test -- --run
```

### Playwright E2E Test

From the repository root:

```bash
npx playwright test
```

## Environment

Do not commit the real `.env` file.

Use `.env.example` as the template for local environment configuration.