# TokTickIT

TokTickIT is a Lab 1 full-stack project for CPE334.

## Tech Stack

- Frontend: React + TypeScript + Vite + Bootstrap
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Testing: Vitest + Supertest

## Repository Structure

    toktickit/
    ├── client/
    │   ├── src/
    │   └── tests/
    │       └── lab-01/
    ├── server/
    │   ├── prisma/
    │   ├── src/
    │   └── tests/
    │       └── lab-01/
    ├── docs/
    │   └── lab-01/
    │       ├── ai_use.md
    │       ├── reviewer.md
    │       └── tests.md
    ├── .gitignore
    └── README.md
    
## Setup

### Clone the Repository

    git clone https://github.com/thitikan48/toktickit.git
    cd toktickit

### Frontend

    cd client
    npm install
    npm run dev

The frontend runs at: http://localhost:5173/

### Backend

Open another terminal and run:

    cd server
    npm install
    copy .env.example .env

Update `DATABASE_URL` in `.env` with your local PostgreSQL credentials.

Run the Prisma migration and seed:

    npx prisma migrate dev
    npm run prisma:seed

Start the backend:

    npm run dev

The backend runs at: http://localhost:3000

## Testing

### Frontend Tests

    cd client
    npm test

### Backend Tests

    cd server
    npm test

## Environment

Do not commit the real `.env` file.

Use `.env.example` as the template for your local environment configuration.