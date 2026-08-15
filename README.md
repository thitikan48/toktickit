# TokTickIT

TokTickIT is a Lab 1 full-stack project for CPE334.

## Tech Stack

- Frontend: React + TypeScript + Vite + Bootstrap
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Testing: Vitest + Supertest

## Setup

### Frontend

```bash
cd client
npm install
npm run dev 

```
The frontend runs at: http://localhost:5173/

### Backend

```bash
cd server
npm install
npm run dev
```
The backend runs at: http://localhost:3000
Copy the environment template:
```bash
copy .env.example .env
```
Update DATABASE_URL in .env with your local PostgreSQL credentials.
### Testing

```bash
cd client
npm test

cd server
npm test
```
