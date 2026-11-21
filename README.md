# SimpleInvoice

A small invoicing application: sign in, list invoices, view one, create one. Built for the 101 Digital Full Stack assessment.

> Work in progress. The project is being built in vertical slices; so far sign-in, route protection, the database schema and the Docker setup are in place. This README is completed in a later slice.

## Structure

A monorepo with two independent npm projects:

```
backend/              NestJS REST API (TypeScript, TypeORM, PostgreSQL)
frontend/             React single-page app (TypeScript, Vite, MUI)
docs/                 Requirements and architecture decision records
GLOSSARY.md           Domain vocabulary
docker-compose.yml    Database, backend and frontend together
.env.example          Every configuration key, with placeholder values
```

## Run with Docker

```bash
cp .env.example .env
docker compose up
```

| Service | URL | `.env` key |
| --- | --- | --- |
| Frontend | http://localhost:8080 | `FRONTEND_PORT` |
| Backend API | http://localhost:3000 | `BACKEND_PORT` |
| Swagger UI | http://localhost:3000/api/docs | |
| PostgreSQL | localhost:5433 | `DB_PORT` |

On start the backend container applies database migrations and runs the seed, so you can sign in straight away. If you change `BACKEND_PORT` or `FRONTEND_PORT`, update `VITE_API_URL` and `FRONTEND_ORIGIN` to match.

## Default login

The seed creates one account from the `SEED_USER_*` values in `.env`. With the values from `.env.example`:

| Email | Password |
| --- | --- |
| `reviewer@simpleinvoice.test` | `change-me` |

Running the seed again resets this account's password and name to the values in `.env`.

## Run without Docker

Needs Node 22 and PostgreSQL 14 or newer.

```bash
cp .env.example .env        # then point DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME at your PostgreSQL
cd backend && npm ci && npm run seed && npm run start:dev
cd frontend && npm ci && npm run dev
```

The frontend dev server runs on http://localhost:5173.

## Seed

```bash
cd backend && npm run seed
```

Applies any pending migrations, then creates or resets the default account. It is safe to run repeatedly.

## Tests

```bash
cd backend && npm test          # unit tests
cd backend && npm run test:e2e  # against a real PostgreSQL started by Testcontainers; needs Docker running
cd frontend && npm test
```

## Decisions

Approved requirements are in [docs/requirements.md](docs/requirements.md), and the reasoning behind the less obvious choices is in [docs/adr/](docs/adr/).
