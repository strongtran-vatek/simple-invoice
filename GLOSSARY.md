# SimpleInvoice

A small invoicing application where authenticated users list, inspect and create invoices. Built for the 101 Digital Full Stack assessment.

## Language

### Invoice

**Invoice**:
A request for payment issued to one customer, carrying one line item, a currency and the amounts derived from them.
_Avoid_: Bill, order

**Invoice Number**:
The user-provided identifier of an invoice, unique across the system. Two numbers that differ only in letter case or surrounding spaces are the same number.
_Avoid_: Invoice ID (that is the system-generated key), reference

**Invoice Reference**:
An optional external reference the customer or another system uses for the invoice.

**Line Item**:
A single thing being charged for on an invoice: a name, an integer quantity and a rate. An invoice has exactly one for now.
_Avoid_: Product, row, entry

**Customer**:
The party an invoice is issued to, recorded on the invoice as a snapshot at issue time. Not a shared record: two invoices for the same person hold two independent copies.
_Avoid_: Client, account

**User**:
A person who can log in. Every user sees every invoice; the creating user is recorded for audit only.
_Avoid_: Account, admin

### Status

**Stored Status**:
The status saved with an invoice: Draft, Pending or Paid. A new invoice is always Draft.

**Effective Status**:
The status shown to users and used for filtering: Overdue when the invoice is overdue, otherwise the stored status.
_Avoid_: Display status, computed status

**Overdue**:
An invoice whose stored status is not Paid and whose due date is before today. It is never saved, only derived, and applies to Draft invoices as well as Pending ones.

**Today**:
The current calendar date in the application's configured timezone. An invoice due today is not yet overdue.

### Money

**Subtotal**:
Quantity multiplied by rate.

**Currency**:
The single currency all of an invoice's amounts are in, chosen from a fixed supported list. Amounts in different currencies are never converted or combined.

**Tax Rate**:
The percentage of the subtotal charged as tax, recorded on the invoice. Ten percent unless the user says otherwise.
_Avoid_: Tax (ambiguous between the rate and the amount)

**Tax Amount**:
The subtotal multiplied by the tax rate, rounded to the cent. Tax is charged on the undiscounted subtotal.

**Discount**:
An absolute amount in the invoice currency taken off the invoice. Never a percentage.

**Total Amount**:
Subtotal plus tax amount minus discount. It is never negative.
_Avoid_: Gross total, grand total

**Estimate**:
A preview of an invoice's amounts shown while it is being entered. It is never stored; the **Total Amount** of a saved invoice is always calculated afresh.
_Avoid_: Quote, draft total

**Total Paid**:
The amount the customer has paid so far.

**Balance Amount**:
Total amount minus total paid. Shown to users as the outstanding balance.
_Avoid_: Amount due, remaining
