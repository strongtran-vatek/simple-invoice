---
status: accepted
---

# A .env file must exist before docker compose up

The spec wants one command to bring up the stack, and also forbids hardcoded secrets. Putting fallback values such as `${JWT_SECRET:-dev-secret}` in `docker-compose.yml` would give a true single command but commits a signing secret. We require `cp .env.example .env` first and make Compose fail with a clear message when `JWT_SECRET` is unset. One extra copy step is the price of keeping every secret out of the repository.

## Consequences

The backend container runs migrations and the idempotent seed on start, so once `.env` exists the reviewer can log in without any further command.
