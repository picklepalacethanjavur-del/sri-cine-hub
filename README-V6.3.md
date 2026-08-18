# Sri Cine Hub V6.3 — QA Hardened

V6.3 is a release-blocking reliability pass focused on quote RLS, checkout/return atomicity, evidence storage, receipts, and UI interaction quality.

## Main changes

- Internal quote request creation moved to staff-only RPCs.
- Active-staff RLS helper and defense-in-depth policies added to operational tables.
- Quote request, supplier RFQ, and rental-evidence private storage policies hardened.
- Staff-only function ACLs enforced; unused legacy public RPC surface closed.
- New atomic `checkout_booking_atomic` and `return_booking_atomic` RPCs.
- Proof files are uploaded first, but removed automatically if the atomic DB operation fails.
- Camera/accessory verification includes QR/manual verification and audited override.
- Damaged/missing owned returns create maintenance work automatically.
- Receipt/payment state is calculated atomically with the return.
- Blank native request-file field replaced with a clean attach-files control.
- Obsolete legacy quotation manager removed.
- QA suite executed with persistent `QA-V63-*` database records. See `QA-V6.3.md`.

## Database

The V6.3 migrations were already applied to Supabase project `ucqjgavwncpwrjrmtkfr` during QA. They are included under `supabase/migrations/` for reproducibility:

- `20260818_v63_rls_and_qa_hardening.sql`
- `20260818_v63_function_acl_hardening.sql`
- `20260818_v63_atomic_checkout_return.sql`
- `20260818_v63_remove_legacy_rpc_surface.sql`

## Build note

Package source passed TypeScript/TSX parser QA. A full Next.js production build could not be completed in the artifact environment because dependency installation timed out; deploy/CI should run the normal `npm install` and `npm run build`.
