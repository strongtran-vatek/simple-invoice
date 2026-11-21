---
status: accepted
---

# Invoice numbers are unique ignoring case and surrounding whitespace

The spec says invoice numbers are user-provided and unique at the database level, without saying how they compare. We trim them and enforce uniqueness case-insensitively with a unique index on the lower-cased value, so `INV-1` and `inv-1` collide. To a person these are the same invoice number, and allowing both would let a typo create a duplicate. The number is stored and displayed as the user typed it, minus surrounding spaces.

## Consequences

Loosening this later is easy; tightening it after case-variant duplicates exist is not, which is why it is enforced from the first migration. The service maps the unique violation to 409 Conflict, so concurrent creates of the same number cannot both succeed.
