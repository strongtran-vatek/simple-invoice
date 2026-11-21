# Requirements and approved decisions

Source: `Assessment_Fullstack_v3.0.0.pdf` (cover and footers read v2.3.1). Decisions below were approved in the grilling session; each carries the round and question number it came from. Domain terms are defined in [GLOSSARY.md](../GLOSSARY.md).

## Spec precedence (R1-Q1)

Sections 2 and 3 of the spec are authoritative. Appendix A is guidance for the shape of seed data only. Where they conflict:

| Conflict | Resolution |
| --- | --- |
| Paging shape: Appendix A `pageNumber/pageSize/totalRecords`, §2.3.1 `page/pageSize/total` | Use `page/pageSize/total` |
| Appendix A has `type` and `invoiceGrossTotal`, absent from §3 | Dropped |
| Appendix A record has `status: "Overdue"`, §2.3.2 says Overdue is never stored | Seeded as `Pending`; it derives to Overdue |
| Filename says v3.0.0, document says v2.3.1 | Noted in README assumptions; no functional impact |

These are to be repeated under "Assumptions" in the README.

## MVP scope (R1-Q2)

In scope, exactly as specified:

- Login with email and password, JWT issued, protected routes redirect to Login.
- Invoice List as the home screen: search, status filter, sort, server-side pagination.
- Invoice Detail.
- Create Invoice with one line item, always created as Draft.
- Endpoints: `POST /auth/login`, `GET /auth/me`, `GET /invoices`, `GET /invoices/:id`, `POST /invoices`.

Out of scope:

- Editing or deleting invoices.
- Recording payments or changing status. Pending, Paid and partially paid invoices exist only through seed data.
- User registration, password reset, refresh tokens, roles.
- Browser-level end-to-end tests (Playwright).

## Value Add (R2-Q24)

All four are in scope; the deadline does not require cutting any. They are built after the core passes its tests, in this order:

1. Date-range filter in the list UI (the API already supports `fromDate` and `toDate`).
2. Live totals preview on the create form, labelled as an estimate; the backend stays authoritative.
3. Health endpoint and Compose healthchecks, so the backend waits for the database.
4. GitHub Actions workflow running lint, tests and build.

## Business rules

- Every authenticated user sees every invoice. `createdBy` is an audit field, not an access filter. (R1-Q6)
- Discount is an absolute currency amount. Tax is computed on the undiscounted subtotal. (R1-Q8)
- A discount that would make the total amount negative is rejected with 400. (R1-Q8)
- Status filters act on the effective status; see [ADR 0003](./adr/0003-filter-by-effective-status.md). (R1-Q7)
- Amounts are stored as `numeric(14,2)` and computed with `decimal.js`, never JS floats. Tax amount is rounded half-up to 2 decimals and the total is derived from the rounded values. Rate, discount and tax rate accept at most 2 decimals. (R2-Q13)
- The invoice stores its tax rate, an addition to the spec's reference model, so the detail view can show "Tax (10%)". (R2-Q14)
- Dates are `DATE` columns exchanged as `YYYY-MM-DD` strings with no time component. "Today" is the current date in `APP_TIMEZONE` (default `UTC`), read through an injectable clock so tests can fix it. (R2-Q15)
- Currency must be one of AUD, USD, GBP, EUR, SGD, VND; anything else is rejected with 400. The backend derives and stores `currencySymbol`; the client never sends it. (R2-Q16)
- Invoice numbers are trimmed and unique ignoring case; see [ADR 0007](./adr/0007-case-insensitive-invoice-numbers.md). (R2-Q18)

## API (R2-Q17, Q18, Q19)

- Endpoints are served exactly as the spec lists them, with no global prefix; only Swagger sits at `/api/docs`. See [ADR 0005](./adr/0005-no-global-api-prefix.md).
- Amounts are JSON numbers, as in Appendix A. (R2-Q13)

Response shape (R3-Q25):

- The invoice JSON mirrors Appendix A, with a nested `customer` object and an `items` array, plus `taxRate`.
- `status` carries the effective status only. The stored status is never exposed.
- `GET /invoices` returns summary rows: id, invoice number, customer name, invoice date, due date, total amount, currency, currency symbol, status. `GET /invoices/:id` returns the full invoice.

`POST /auth/login` (R3-Q27):

- Requires a valid email format and a non-empty password, on client and server. No minimum length or complexity.

`POST /invoices`:

- Body carries `items` as an array validated to exactly one element, plus `tax` (percent, default 10) and `discount` (amount, default 0).
- `invoiceReference` and `description` are accepted as optional fields. (R3-Q26)
- Length caps: 50 for invoice number and reference, 255 for names and email, 500 for address and description. (R3-Q26)
- Returns 201 with the full invoice.
- Duplicate invoice number returns 409 Conflict, enforced by a unique index and mapped from the database error so concurrent creates are caught too.

`GET /invoices`:

- Defaults: `page=1`, `pageSize=10`, maximum `pageSize` 100, sort `invoiceDate DESC` with `id` as tiebreaker.
- `fromDate` and `toDate` filter on invoice date, inclusive.
- Sorting by total amount is numeric and ignores currency.
- `keyword` uses `ILIKE` with wildcard characters escaped.

Other status codes:

- Malformed UUID on `/invoices/:id` returns 400; an unknown id returns 404.
- Failed login returns 401 with one generic message for both wrong email and wrong password.

## Database (R2-Q19)

- Unique index on the normalised invoice number.
- B-tree indexes on invoice date, due date, total amount and status.
- `CHECK` constraints: due date ≥ invoice date, quantity > 0, rate > 0, amounts non-negative.
- No trigram index for search; not worth an extension at this data size. Listed under README limitations.

## Authentication (R2-Q22)

- Bcrypt with cost 10. HS256 tokens carrying user id and email.
- `JWT_EXPIRES_IN` in seconds, default 3600.
- The JWT guard is global; `POST /auth/login` opts out with `@Public()`. New endpoints are protected unless marked otherwise.
- Login is rate-limited with `@nestjs/throttler`. `helmet` is enabled. CORS is restricted to `FRONTEND_ORIGIN`.
- Logout removes the token on the client only.

## Architecture

- **Repository**: this folder is the git root, pushed as `simple-invoice`. Monorepo with `frontend/`, `backend/`, `docs/`, `docker-compose.yml` and `README.md`. Two independent npm projects, no workspace tooling. (R1-Q3, R2-Q12)
- **Backend**: NestJS, TypeScript, PostgreSQL, TypeORM with explicit migrations; see [ADR 0001](./adr/0001-typeorm-with-explicit-migrations.md). (R1-Q4)
- **Customer storage**: embedded columns on the invoice; see [ADR 0002](./adr/0002-customer-embedded-on-invoice.md). (R1-Q5)
- **Token storage**: `localStorage` with a Bearer header; see [ADR 0004](./adr/0004-jwt-in-localstorage.md). (R1-Q9)
- **Frontend**: Vite, React 18, TypeScript, React Router, TanStack Query, React Hook Form with Zod, MUI. List state (page, page size, sort, status, keyword) lives in the URL query string. (R1-Q10)

## Docker and configuration (R2-Q20)

- `docker compose up` starts Postgres 16, the backend on port 3000 and the frontend on port 8080 (static build served by nginx).
- The backend container runs migrations, then the idempotent seed, on start.
- Configuration comes from a root `.env`. First run is `cp .env.example .env` then `docker compose up`; Compose fails with a clear message if `JWT_SECRET` is missing. See [ADR 0006](./adr/0006-env-file-required-before-compose-up.md).

## Seed data (R2-Q21)

- One default user; email and password come from `SEED_USER_*` variables, with placeholder values in `.env.example` and the README.
- The Appendix A invoice plus 40 generated invoices from a fixed random seed, so every run produces the same data.
- Dates are relative to the day the seed runs, so there are always overdue and not-yet-due invoices.
- Paid invoices have total paid equal to the total; Pending have zero or a partial payment; Draft have zero.
- `npm run seed` skips if invoices already exist. `npm run seed -- --reset` wipes and reseeds.

## Testing (R2-Q23)

- **Backend unit** (Vitest; see Amendments): total calculation, Overdue derivation, due-date validation, unique invoice number handling.
- **Backend e2e** (Supertest against a real Postgres started by Testcontainers): login, create, then find the invoice in the list; the effective-status filter. Needs Docker running.
- **Frontend** (Vitest, React Testing Library, MSW): login flow, route guard, the list's search, filter, sort and paging wiring, create-form validation.

## Frontend behaviour

Routes and session (R3-Q28):

- Routes: `/login`, `/invoices` (`/` redirects to it), `/invoices/new`, `/invoices/:id`.
- An unauthenticated visit is redirected to Login and returned to the requested page after signing in.
- On load, a stored token is checked with `GET /auth/me`. The app bar shows the user's name and a Logout button.

Invoice List (R3-Q29):

- Table on desktop, stacked cards below 600px.
- Search is debounced by 300 ms. Any search, filter or sort change resets to page 1.
- Status filter is a single select with an "All" option.
- Sort by clicking column headers on desktop, and through a sort menu on mobile.
- Page size options: 10, 25, 50.
- Distinct loading, empty and error states; the error state has a Retry button.

Create Invoice (R3-Q30):

- Zod rules mirror the server's validation.
- Defaults: invoice date today, due date 30 days later, currency AUD, tax 10, discount 0.
- A 409 is shown on the invoice number field. Other server validation messages are shown in an alert above the form.
- Submit is disabled while the request is in flight.
- Success shows a snackbar and redirects to the list.
- Optional invoice reference and description fields are included. (R3-Q26)

Display formatting (R3-Q31):

- Amounts: two decimals, thousands separators, prefixed by the stored currency symbol, for example `AU$2,180.00`.
- Dates: `03 Jun 2026`, regardless of browser locale, with no timezone conversion.

## Tooling (R3-Q32)

- Node 22 pinned with `.nvmrc`, npm, strict TypeScript, oxlint with Prettier in both projects (see Amendments).
- The backend validates its environment variables at startup and exits with a clear message if one is missing.
- Backend modules: `auth`, `users`, `invoices`, `database` (with `seed`), `common`.
- The non-Docker path targets a local PostgreSQL 14 or newer. Nothing may depend on features added after 14.
- Conventional Commits, one commit per working slice.

## Build order (R3-Q33)

Vertical slices, each ending with passing tests and a commit:

1. Scaffold both projects, Compose, database connection and the first migration.
2. Authentication end to end: seeded user, login, guard, Login screen, route protection.
3. Invoice list, with the seed script.
4. Invoice detail.
5. Create invoice.
6. Swagger completeness, README, and a clean-clone run of `docker compose up`.
7. Value Add items in the agreed order.

## Amendments found during slice 1

Scaffolding with the current framework releases showed that two approved tooling choices no longer match what the frameworks ship. Both were changed to the framework default and are awaiting confirmation:

| Approved | Now | Why |
| --- | --- | --- |
| Jest for backend tests (R2-Q23) | Vitest | NestJS 12 projects are ESM-only and are scaffolded with Vitest. Jest's ESM support is still experimental, and the frontend already uses Vitest. |
| ESLint (R3-Q32) | oxlint | Both `nest new` and `create-vite` now generate an oxlint configuration. Prettier is unchanged. |

Other things settled while building, none of which change an approved decision:

- NestJS 12, TypeORM 1.1, Vite 8, MUI 9, React 18 (pinned, as approved) and React Router 7.
- `@nestjs/observe`, a hosted telemetry service that `nest new` wires in by default, was removed. The spec calls for no external services.
- Compose publishes PostgreSQL on host port 5433 by default, not 5432, so it does not clash with a PostgreSQL already installed on the reviewer's machine. `DB_PORT` changes it.
- Testcontainers is held at version 11. Version 12 needs Node 22.22 or newer and fails on earlier Node 22 releases.
- One `.env` at the repository root configures Compose, the backend and the frontend. The backend also reads `backend/.env` if present.
- Migrations run when the backend starts, so a fresh database needs no manual step. `npm run migration:run` remains for running them by hand.
- Beyond the agreed `CHECK` constraints, the schema also enforces that the total equals subtotal plus tax minus discount, that the balance equals total minus paid, and that user emails are stored lower-cased.
- An e2e test compares the entities with the migrated schema, so a change to an entity without a matching migration fails the build.

## Notes from slice 2 (authentication)

None of these change an approved decision:

- Tokens are signed and verified with `@nestjs/jwt`, passwords are hashed with `bcryptjs` at cost 10, and the guard is our own. NestJS 12 also ships `@nestjs/authentication`, but it hashes with scrypt where the spec names bcrypt, and it is still at version 0.1. Passport is not used; the guard is small enough not to need it.
- The guard loads the user on every request instead of trusting the token's claims, so a deleted user's token stops working at once.
- A password is always checked against a hash, a placeholder one when the email is unknown, so response time does not reveal which emails are registered.
- `POST /auth/login` answers 200, not POST's default 201, and returns `{ accessToken, tokenType, expiresIn }`.
- Login is limited to 10 attempts per minute per client address. Behind Docker's network every browser shares one address, so the limit is effectively global there; this is listed under README limitations.
- Emails are trimmed and lower-cased on sign-in, so letter case does not matter.
- The seed script runs when the backend container starts. It creates the default account, or resets its password and name to the `SEED_USER_*` values, so the documented credentials always work.
- The frontend's HTTP client uses the browser's `fetch` through axios.

## Notes from slice 3 (invoice list)

None of these change an approved decision:

- A list row is a strict subset of the invoice detail, with the same names and nesting: `invoiceId`, `invoiceNumber`, `invoiceDate`, `dueDate`, `currency`, `currencySymbol`, `totalAmount`, `status` and `customer.fullname`.
- A blank query parameter (`?status=`) is treated as absent. An unknown one (`?limit=5`) is rejected with 400, the same as an unknown body property.
- `ordering` is accepted in either letter case. A `toDate` earlier than `fromDate` is rejected with 400.
- A page beyond the last returns 200 with an empty `data` array and the real `total`.
- "Today" is read once per request from the injectable clock and passed to the query as a parameter, so the Overdue filter and the status shown on each row always agree.
- In the list UI, clicking a column that is not the current sort starts ascending; clicking the current one reverses it.
- Seed data is generated from each invoice's index, not from a random number generator. R2-Q21 asked for "a fixed random seed"; the point was that every run produces the same data, which this gives with less machinery.
- Unpaid seed invoices are dated within the last 50 days and Paid ones within the last 150, so on any day roughly a quarter of the sample is Overdue and the rest is spread over Draft, Pending and Paid.
- The Appendix A record names a `createdBy` user that does not exist; the seed records the default account as its creator instead.

## Status

All three grilling rounds are answered and recorded. Slices 1 (scaffold, Compose, database connection, first migration), 2 (authentication end to end) and 3 (invoice list with seed data) are built.
