---
status: accepted
---

# Status filters act on the effective status

Overdue is derived at read time and never stored, so `GET /invoices?status=` needs a rule. We filter on the effective status, in SQL:

- `status=Overdue` matches invoices whose stored status is not Paid and whose due date is before today.
- `status=Draft` and `status=Pending` match that stored status only when the invoice is not overdue.
- `status=Paid` matches the stored status.

The alternative was filtering Draft and Pending on the stored status, which would return rows whose badge reads Overdue under a "Pending" filter. Filtering in SQL rather than after loading keeps pagination totals correct.

## Consequences

A Draft invoice past its due date is Overdue and disappears from the Draft filter, as the spec's formula implies. The four filters partition the invoices: each one appears under exactly one status.
