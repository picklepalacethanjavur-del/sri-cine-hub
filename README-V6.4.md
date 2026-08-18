# Sri Cine Hub V6.4 — Corrections, Payments & History

V6.4 changes the application from a one-way rental workflow into a correction-safe operational workflow.

## Key changes
- Receipt payments are now a transaction ledger, not a single mutable paid amount.
- Add Payment can be used after a return/receipt was created with ₹0 paid.
- Payments can be reversed with a required reason; the original transaction stays in history.
- Receipt charges can be corrected with a required reason and before/after audit data.
- Quote requests can be corrected without silently rewriting an already-generated quotation.
- Accepted quotations can be reopened before conversion.
- Booking details have an Edit / Correct workflow with history.
- Checkout meter/condition and return meter/condition have controlled correction RPCs.
- Rental dates are locked after checkout to protect availability history.
- Booking detail page includes activity history and links back to Checkout/Return/Receipt.
- Document pages now always include a Back action.
- Receipt document shows only effective current payments; reversed transactions remain internal history.
- Return form labels payment as optional and explicitly supports recording payment later.
- Document action buttons have explicit high-contrast styling; the dark/blank-looking Print and Share controls are fixed.
- Request file inputs remain visually hidden behind labeled attachment buttons.
- Payment and audit tables are read-only to staff through RLS; controlled RPCs perform writes.

## Database migrations
- `20260818_v64_corrections_payments_history.sql`
- `20260818_v64_operational_corrections.sql`
- `20260818_v64_trigger_function_privilege_hardening.sql`
- `20260818_v64_payment_audit_integrity.sql`

These migrations were applied to Supabase project `ucqjgavwncpwrjrmtkfr` during QA.
