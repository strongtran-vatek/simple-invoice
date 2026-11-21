# SimpleInvoice

A small invoicing application: sign in, list invoices, view one, create one. Built for the 101 Digital Full Stack assessment with ReactJS, NestJS and PostgreSQL.

## Contents

- [Quick start](#quick-start)
- [Default login](#default-login)
- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Run without Docker](#run-without-docker)
- [Seed](#seed)
- [Configuration](#configuration)
- [API](#api)
- [Tests](#tests)
- [Assumptions and design decisions](#assumptions-and-design-decisions)
- [Beyond the requirements](#beyond-the-requirements)
- [Known limitations](#known-limitations)

## Quick start

Needs Docker with Compose.

```bash
cp .env.example .env
```

```bash
docker compose up
```

That builds and starts the database, the backend and the frontend, each once the one before it reports healthy. On start the backend applies the database migrations and runs the seed, so you can sign in straight away.

| Service | URL | Host port | `.env` key |
| --- | --- | --- | --- |
| Frontend | http://localhost:8080 | 8080 | `FRONTEND_PORT` |
| Backend API | http://localhost:3000 | 3000 | `BACKEND_PORT` |
| Swagger UI | http://localhost:3000/api/docs | 3000 | |
| PostgreSQL | localhost:5433 | 5433 | `DB_PORT` |

PostgreSQL is published on 5433, not 5432, so it does not clash with a PostgreSQL already installed on your machine.

If one of these ports is taken, change its key in `.env`. If you change `BACKEND_PORT` or `FRONTEND_PORT`, also update `VITE_API_URL` and `FRONTEND_ORIGIN` to match, then run `docker compose up --build`, because the frontend reads `VITE_API_URL` when it is built.

To stop the stack and delete its data, run `docker compose down -v`.

## Default login

The seed creates one account from the `SEED_USER_*` values in `.env`. With the values from `.env.example`:

| Email | Password |
| --- | --- |
| `reviewer@simpleinvoice.test` | `change-me` |

Running the seed again resets this account's password and name to the values in `.env`.

## What it does

- **Authentication.** A Login screen with client-side and server-side validation. A successful sign-in issues a JWT, which the browser stores and sends with every request. Every other screen and every other endpoint needs it; a visitor without one is sent to the Login screen and returned to the page they asked for after signing in.
- **Invoice List.** The home screen. A paginated list showing invoice number, customer, invoice date, due date, total and status, with search by invoice number or customer name, a status filter, an invoice date range, sorting by invoice date, due date or total, and a choice of page size. Paging, search, filtering and sorting are all done by the server. The list state lives in the URL, so a filtered view can be bookmarked or shared.
- **Invoice Detail.** Invoice information, customer, line items and amounts (subtotal, tax, discount, total, paid and outstanding balance), with the status at the top.
- **Create Invoice.** A form with the validation rules of the specification. A running estimate of the totals is shown while the form is filled in. The invoice is saved as a Draft, the backend calculates its totals, and a success message is shown on return to the list.

The interface is responsive: the list becomes cards and the line items stack on a phone.

## Architecture

A monorepo with two independent npm projects. Either can be built, tested and run on its own.

```
simple-invoice/
├── backend/                NestJS REST API
│   ├── src/
│   │   ├── auth/           Login, JWT guard, current-user decorator
│   │   ├── users/          The user entity and lookups
│   │   ├── invoices/       Entities, DTOs, calculator, status rule, service, controller
│   │   ├── database/       Data source, migrations, seed/
│   │   ├── health/         Liveness and readiness probes
│   │   ├── common/         Error filter, clock, currencies, validators
│   │   └── config/         Environment validation
│   ├── test/               End-to-end tests
│   └── Dockerfile
├── frontend/               React single-page app
│   ├── src/
│   │   ├── api/            HTTP client and one module per resource
│   │   ├── app/            Routes, layout, providers, theme
│   │   ├── auth/           Session state, token storage, route guard
│   │   ├── invoices/       List, form and formatting building blocks
│   │   ├── pages/          One component per screen
│   │   └── test/           Fake backend and render helpers for tests
│   └── Dockerfile
├── docs/                   Requirements and architecture decision records
├── .github/                CI workflow and its smoke test
├── GLOSSARY.md             Domain vocabulary
├── docker-compose.yml
└── .env.example
```

```
Browser ── static files ──▶ nginx (frontend container, port 8080)
   │
   └───── JSON over HTTP ──▶ NestJS (backend container, port 3000) ──▶ PostgreSQL (db container)
```

**Backend.** NestJS 12 with TypeORM on PostgreSQL 16.

- The schema is created by a hand-written migration, never by `synchronize`. A test fails if the entities and the migrated schema ever disagree.
- A global guard requires a valid JWT on every route unless the route is marked `@Public()`, so a new endpoint is protected by default.
- A global `ValidationPipe` validates every request against a `class-validator` DTO and rejects unknown fields.
- A global exception filter gives every error the shape `{ statusCode, message, error }` and keeps internal details out of 500 responses.
- Money is `numeric(14,2)` in the database and `decimal.js` in code, never binary floating point. Database check constraints restate the arithmetic (`total = subtotal + tax − discount`).
- Environment variables are validated at startup; the process exits with a clear message if one is missing or malformed.

**Frontend.** React 18 with TypeScript, built by Vite.

- MUI for components, React Router for routing, TanStack Query for server state, React Hook Form with Zod for forms.
- One axios client attaches the token and, on a 401, clears the session and returns to the Login screen.
- Every amount shown for a saved invoice is the one the backend sent. The only arithmetic in the frontend is the estimate on the create form, which is labelled as such and never sent.

**Business rules worth knowing**

| Rule | Where |
| --- | --- |
| Overdue is derived, never stored: an invoice that is not Paid and whose due date is before today is reported as Overdue. | `backend/src/invoices/invoice-status.enum.ts` |
| `subtotal = quantity × rate`, `tax = subtotal × rate%` rounded half-up to the cent, `total = subtotal + tax − discount`, `balance = total − paid`. | `backend/src/invoices/invoice-calculator.ts` |
| Filtering by status happens in SQL on the derived status, so page counts stay correct. | `backend/src/invoices/invoices.service.ts` |

The vocabulary used in the code and in this document is defined in [GLOSSARY.md](GLOSSARY.md).

## Run without Docker

Needs Node 22 (see `.nvmrc`) and PostgreSQL 14 or newer.

**1. Configuration**

```bash
cp .env.example .env
```

**2. A database.** Either start only the database from Compose, which matches `.env.example` as it is:

```bash
docker compose up -d db
```

or use your own PostgreSQL. Create a role and a database, then set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` and `DB_NAME` in `.env` to match:

```sql
CREATE ROLE simpleinvoice LOGIN PASSWORD 'change-me';
CREATE DATABASE simpleinvoice OWNER simpleinvoice;
```

No extension needs installing.

**3. Backend**, on http://localhost:3000:

```bash
cd backend && npm ci && npm run seed && npm run start:dev
```

**4. Frontend**, in a second terminal, on http://localhost:5173:

```bash
cd frontend && npm ci && npm run dev
```

Both projects read the `.env` at the repository root. The backend applies pending migrations whenever it starts.

## Seed

```bash
cd backend && npm run seed
```

The seed:

- applies any pending migrations;
- creates the default account, or resets its password and name;
- adds 41 sample invoices: the record from Appendix A of the specification, plus 40 generated ones.

It is safe to run repeatedly. If any invoices already exist it leaves them untouched.

```bash
cd backend && npm run seed -- --reset
```

`--reset` deletes every invoice and adds the samples again.

With Docker, the backend container runs the seed each time it starts. To reset the sample data in a running stack:

```bash
docker compose exec backend node dist/database/seed/seed.js --reset
```

The generated invoices are the same on every run. Their dates are counted back from the day the seed runs, so there are always Draft, Pending, Paid and Overdue invoices to look at, across five currencies and a wide range of totals.

## Configuration

Every setting comes from environment variables. `.env.example` lists all of them with placeholder values; `.env` itself is not committed. Nothing sensitive is hardcoded.

| Key | Purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Database connection. Under Compose the backend always uses `db:5432`, and `DB_PORT` is the port published on the host. |
| `BACKEND_PORT` | Port the API listens on. |
| `JWT_SECRET` | Signing key for access tokens, at least 32 characters. |
| `JWT_EXPIRES_IN` | Access token lifetime in seconds. |
| `APP_TIMEZONE` | IANA timezone that decides what "today" is when deriving Overdue. |
| `FRONTEND_ORIGIN` | Comma-separated origins allowed by CORS. |
| `FRONTEND_PORT` | Port the Docker frontend is published on. |
| `VITE_API_URL` | Where the browser reaches the API. Read when the frontend is built. |
| `SEED_USER_EMAIL`, `SEED_USER_PASSWORD`, `SEED_USER_FULLNAME` | The default account. |

Replace `JWT_SECRET`, `DB_PASSWORD` and `SEED_USER_PASSWORD` before using this anywhere but your own machine.

## API

Interactive documentation is at http://localhost:3000/api/docs, and the OpenAPI document at http://localhost:3000/api/docs-json. To try an endpoint there, call `POST /auth/login`, copy `accessToken`, press **Authorize** and paste it.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/login` | Authenticate and receive a JWT |
| `GET` | `/auth/me` | The signed-in user |
| `GET` | `/invoices` | List invoices: `page`, `pageSize`, `sortBy`, `ordering`, `status`, `keyword`, `fromDate`, `toDate` |
| `GET` | `/invoices/:id` | One invoice with its customer and line item |
| `POST` | `/invoices` | Create an invoice |
| `GET` | `/health` | Liveness probe: the process is running |
| `GET` | `/ready` | Readiness probe: the database answers; 503 when it does not |

Every endpoint except login and the two probes requires `Authorization: Bearer <token>`. The probes are an addition to the specification's endpoint list.

A list response is `{ data: [...], paging: { page, pageSize, total } }`. An error is always `{ statusCode, message, error }`; `message` is a list when several fields are invalid.

## Tests

```bash
cd backend && npm test
```

```bash
cd backend && npm run test:e2e
```

```bash
cd frontend && npm test
```

| Suite | Runs against | Covers |
| --- | --- | --- |
| Backend unit | Plain functions and classes | Status derivation, the amount calculator, request validation, password hashing, the JWT guard, the error filter, environment validation, seed data |
| Backend e2e | The real application and a real PostgreSQL, started by Testcontainers | Every endpoint: success, validation, authentication and error cases; the migration; the seed; the health probes; the OpenAPI document |
| Frontend | The whole app in jsdom, with a fake backend (MSW) | Sign-in and route protection, the list with search, filter, sort and paging, the detail view, the create form |

The e2e suite needs Docker running. Each test file gets a fresh database.

The workflow test the specification asks for, "create an invoice, then see it in the list", is written twice:

- [backend/test/invoice-create.e2e-spec.ts](backend/test/invoice-create.e2e-spec.ts), through the HTTP API and a real database;
- [frontend/src/pages/InvoiceCreatePage.test.tsx](frontend/src/pages/InvoiceCreatePage.test.tsx), through the form and the list screen.

Both projects also have `npm run lint` (oxlint), `npm run format:check` (Prettier) and `npm run build`.

**Continuous integration.** [.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every push to `main` and on every pull request, as three jobs:

- backend: lint, format check, build, unit tests, e2e tests;
- frontend: lint, format check, tests, build;
- Docker Compose: copies `.env.example` to `.env`, runs `docker compose up`, waits for every service to report healthy, then runs [.github/scripts/smoke-test.sh](.github/scripts/smoke-test.sh), which signs in as the seeded account, lists the invoices and fetches the frontend.

The smoke test also works against a stack running on your machine: `./.github/scripts/smoke-test.sh`.

## Assumptions and design decisions

Where the specification is silent or contradicts itself, these are the choices made. The full list, with the question each one answers, is in [docs/requirements.md](docs/requirements.md). The decisions that would be costly to reverse each have a short record in [docs/adr/](docs/adr/).

**Where the specification contradicts itself**

- Sections 2 and 3 take precedence over the Appendix A sample. So paging is `page`, `pageSize`, `total`, and the fields `type` and `invoiceGrossTotal`, which appear only in the sample, are not implemented.
- The Appendix A record is seeded as Pending. Its due date has passed, so it shows as Overdue.

**Status**

- "Today" is the current date in `APP_TIMEZONE` (UTC by default). An invoice due today is not yet overdue.
- A Draft whose due date has passed is Overdue too. The rule is "not Paid".
- The status filter acts on the status shown. Filtering by Pending does not return overdue Pending invoices; filtering by Overdue does. The four filters split the invoices with no overlap. ([ADR 0003](docs/adr/0003-filter-by-effective-status.md))
- The API returns only the status shown. The stored status is not exposed.

**Amounts**

- Discount is an amount in the invoice currency, not a percentage.
- Tax is charged on the subtotal before the discount and rounded half-up to the cent.
- A discount larger than subtotal plus tax is rejected, since it would make the total negative. One equal to it is allowed and gives a total of 0.
- The invoice stores its tax rate, so the detail view can show "Tax (10%)". This is an addition to the reference data model.
- Currency is one of AUD, USD, GBP, EUR, SGD or VND. The backend derives the symbol.
- Upper bounds the specification leaves open: tax at most 100%, quantity at most 1,000,000, rate at most 999,999,999.99.
- Rate, tax and discount take at most two decimal places. Text is capped at 50 characters for invoice number, reference and mobile, 255 for names and email, and 500 for address and description. The list returns at most 100 invoices per page.

**Invoices**

- Invoice numbers are unique ignoring letter case and surrounding spaces, so `INV-1` and `inv-1 ` are the same number. A unique database index enforces it, which also covers two simultaneous requests. A duplicate returns 409. ([ADR 0007](docs/adr/0007-case-insensitive-invoice-numbers.md))
- The customer is stored on the invoice, not in a table of its own. An invoice is a record of what was issued, and the specification has no customer management. ([ADR 0002](docs/adr/0002-customer-embedded-on-invoice.md))
- The database allows many line items per invoice. The API accepts exactly one, as an `items` array.
- Every signed-in user sees every invoice. `createdBy` records who created it and is not an access filter.
- `POST /invoices` takes the same nesting as the response: a `customer` object and an `items` array. A request that carries a status, a total or a currency symbol is rejected.
- Dates are calendar dates exchanged as `YYYY-MM-DD`, with no time or timezone, so they never shift by a day between browser and server.

**Security**

- The JWT is kept in `localStorage` and sent as a Bearer header, as the specification's wording suggests. An HttpOnly cookie would resist script injection better, at the cost of CSRF protection and a different API contract. ([ADR 0004](docs/adr/0004-jwt-in-localstorage.md))
- Passwords are hashed with bcrypt. A wrong email and a wrong password give the same message and take about the same time.
- Login is limited to 10 attempts a minute from one address.
- CORS allows only the origins in `FRONTEND_ORIGIN`. Security headers are set by helmet.

**Structure and tooling**

- Endpoints are served exactly as the specification lists them, with no `/api` prefix. Only Swagger sits under `/api/docs`. ([ADR 0005](docs/adr/0005-no-global-api-prefix.md))
- TypeORM with explicit migrations, not schema synchronisation. ([ADR 0001](docs/adr/0001-typeorm-with-explicit-migrations.md))
- `docker compose up` needs `.env` to exist and says so if it does not, instead of falling back to built-in secrets. ([ADR 0006](docs/adr/0006-env-file-required-before-compose-up.md))
- Tests run on Vitest and linting on oxlint in both projects, which is what the current NestJS and Vite scaffolds generate.
- `GET /health` and `GET /ready` are added to the specification's endpoints, so Compose can start the services in order.

## Beyond the requirements

- **Date range filter** on the Invoice List, by invoice date, kept in the URL with the rest of the list state.
- **Running estimate** of subtotal, tax, discount and total on the create form. It is labelled an estimate and never sent; the backend calculates what is stored.
- **Health probes and ordered start-up.** `GET /health` and `GET /ready`, with Compose healthchecks, so each service starts once the one it depends on is ready.
- **CI workflow** with lint, tests, build and a Compose smoke test.
- **Login rate limiting**, a case-insensitive unique invoice number enforced by the database, and database check constraints that restate the invoice arithmetic.
- **Shareable list state**: search, filter, sort and page live in the URL, and "Back to invoices" restores them.

## Known limitations

**Left out because the specification does not ask for them**

- An invoice cannot be edited, deleted, paid or moved to another status. Pending and Paid invoices, and partial payments, exist only in the seed data.
- One line item per invoice.
- One user account, created by the seed. There is no registration, password reset or user management.
- No refresh tokens. A token lasts an hour (`JWT_EXPIRES_IN`), after which the user signs in again. Logging out discards the token in the browser; the server keeps no list of revoked tokens.

**Shortcomings**

- The login rate limit is kept in the memory of one backend process and counted per client address. Behind a proxy that hides client addresses, all users would share one limit.
- Search is a substring match with no supporting index. That is fine for thousands of invoices and would need a trigram index for millions.
- Sorting by total compares the numbers and ignores currency: 100 USD sorts below 200 VND.
- Amounts are always shown with two decimals, including currencies such as VND that have no minor unit.
- "Today" is one timezone for the whole installation, not the viewer's.
- Validation messages from the API are in the API's own terms, for example `customer.email must be a valid email address`. The form's own checks catch nearly everything first, so users rarely see them.
- The frontend ships as a single JavaScript bundle of about 700 kB; it is not split by route.
- `VITE_API_URL` is fixed when the frontend is built. Pointing the Docker frontend at another API means rebuilding it.
- The Compose setup is for local use: plain HTTP, and the seed runs on every backend start.
- The frontend tests use a fake backend. No test drives a real browser against the running stack; that path was checked by hand.
