---
status: accepted
---

# Customer is embedded on the invoice

The spec allows customer details either as columns on `invoices` or in a separate `customers` table. We embed them (`customer_fullname`, `customer_email`, `customer_mobile`, `customer_address`). The create form captures customer details per invoice and there is no customer management, so a separate table would need a deduplication rule nobody asked for. An invoice should also keep the customer as they were at issue time, which a shared, mutable customer row would not give.

## Consequences

There is no customer identity: the same person on two invoices is two unrelated snapshots. Adding customer management later means introducing a `customers` table and a nullable foreign key while keeping the snapshot columns.
