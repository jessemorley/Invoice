# invoicing-pwa

A solo-contractor invoicing app: tracks time entries, generates invoices, records expenses, and (new) summarizes income/expenditure per financial year for tax purposes.

## Language

**Financial year (FY)**:
The Australian tax year, July 1 – June 30. FY26 means July 2025–June 2026. Existing `fyLabel()` logic lives in `dashboard-client.tsx`.

**Gross income**:
The sum of `invoices.total` (subtotal + super, what actually lands in the bank) for invoices whose `paid_date` falls within the FY. Cash-basis, not accrual — issued-but-unpaid invoices don't count.
_Avoid_: Revenue, billings (these could wrongly imply accrual-basis/issued_date).

**Expenditure**:
The sum of `expenses.amount` for every expense (billable or not) whose `date` falls within the FY. Reimbursed/billable expenses are included — not netted against income.
_Avoid_: Costs, outgoings.

**Net (Tax view)**:
Gross income minus expenditure for the selected FY. Derived, not stored.

**Uninvoiced group**:
All uninvoiced entries for one client in one ISO week. The atomic unit of invoice generation — one group becomes one invoice.
_Avoid_: "uninvoiced entries for a client" (a client can have several open weeks, hence several groups).

**Suggested invoice**:
An uninvoiced group presented as a potential invoice (e.g. a card in the invoices view). Not persisted — it exists only as long as its entries remain uninvoiced. Accepting it creates a draft invoice. Every uninvoiced group is a suggested invoice; readiness varies.
_Avoid_: Draft invoice (that's a persisted invoice with `status: draft`), potential invoice.

**Ready (suggested invoice)**:
A suggested invoice is ready when the client's invoicing cutoff has passed — for weekly clients, the configured weekly cutoff (Friday 5pm / Sunday midnight / immediately); for everyone else, as soon as uninvoiced entries exist. Purely a fact about the cutoff — the weekly-reminder preference toggle governs only reminder badges/notifications, never readiness.

## Flagged ambiguities

- `invoices.total` already includes `super_amount` regardless of the client-level `include_super_in_totals` display flag — super is baked into what's actually paid, so it correctly counts as gross income.
- GST is tracked per-expense (`gst_included`) but invoices have no GST field. The Tax view does not attempt GST/BAS calculations — it's a plain income/expenditure summary, not a GST tool.
