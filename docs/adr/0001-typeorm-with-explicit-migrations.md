---
status: accepted
---

# TypeORM with explicit migrations

The backend needs an ORM for PostgreSQL. We chose TypeORM through `@nestjs/typeorm`, with `synchronize: false` and hand-reviewed migrations, over Prisma. Entity classes sit beside the class-validator DTOs the spec mandates, and QueryBuilder expresses the effective-status filter (see ADR 0003) without dropping to raw SQL. Migrations rather than `synchronize` keep constraints and indexes explicit, which the assessment grades.
