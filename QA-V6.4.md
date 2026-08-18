# Sri Cine Hub V6.4 QA Report

Date: 18 Aug 2026
Scope: Quote Request → Quotation → Booking → Checkout → Return → Receipt → Payment Correction → Operational Correction → Audit/RLS regression.

## Real QA records left in Supabase
- Request: `QR-20260818-DC5A39`
- Quotation: `QT-20260818-4882EE`
- Booking: `BK-2026-7C216D`
- Receipt: `RC-20260818-5F75CA`
- Camera: `CAM-005`
- Accessory: `ACC-003`

The records are intentionally prefixed/described with QA-V64 context and were left available for inspection.

## End-to-end tests

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | Create internal quote request through staff RPC | Request created under authenticated staff claims | PASS |
| 2 | Generate quotation with owned camera, owned accessory, service line | Correct total and generated status | PASS — ₹27,500 |
| 3 | Correct customer request after quotation generation | Request changes, generated quotation not silently rewritten | PASS |
| 4 | Mark quote Sent → Accepted | Status transitions succeed | PASS |
| 5 | Undo acceptance back to Sent | Reopen allowed before conversion | PASS |
| 6 | Re-accept and convert to booking | Exact owned assets allocated | PASS — CAM-005 + ACC-003 |
| 7 | Correct booking details before checkout | Change saved with audit reason | PASS |
| 8 | Atomic checkout | Both owned assets move to Out | PASS |
| 9 | Atomic return with ₹0 paid | Receipt created, payment Pending, balance ₹27,500 | PASS |
| 10 | Add partial payment ₹10,000 | Paid ₹10,000 / balance ₹17,500 | PASS |
| 11 | Add payment ₹17,500 | Paid ₹27,500 / balance ₹0 | PASS |
| 12 | Reverse mistaken ₹17,500 payment | Original retained; reversal recorded; balance recalculated | PASS |
| 13 | Add corrected replacement payment | Net paid returns to ₹27,500 | PASS |
| 14 | Correct receipt charges +₹1,000 damage +₹500 late | Total becomes ₹29,000; balance becomes ₹1,500 | PASS |
| 15 | Add final ₹1,500 payment | Paid ₹29,000 / balance ₹0 / Paid status | PASS |
| 16 | Correct checkout hours 5.0 → 5.5 | Corrected with audit reason | PASS |
| 17 | Correct return hours 8.0 → 8.5 | Camera current hours updated safely | PASS |
| 18 | Correct accessory return condition Good → Fair | Asset remains Available, correction audited | PASS |

## Negative / rollback tests

| Test | Result |
|---|---|
| Zero-value payment rejected | PASS — `Payment amount must be greater than zero` |
| Duplicate reversal rejected | PASS — `This payment has already been reversed` |
| Correction reason shorter than 4 characters rejected | PASS |
| Booking rental date change after return rejected | PASS — dates locked after checkout |
| Checkout hours greater than return hours rejected | PASS |
| Return hours lower than checkout hours rejected | PASS |
| Direct staff insert into `payments` blocked by RLS | PASS |
| Direct staff insert into `audit_log` blocked by RLS | PASS |
| Controlled payment RPC still works after RLS hardening | PASS |

## Final QA state
- Booking status: `returned`
- Payment status: `paid`
- Receipt rental: ₹27,500
- Damage: ₹1,000
- Late: ₹500
- Paid: ₹29,000
- Balance: ₹0
- Camera checkout hours: 5.5
- Camera return/current hours: 8.5
- Camera status: Available
- Accessory return condition: Fair
- Accessory status: Available
- Payment ledger includes original mistaken payment + explicit reversal + corrected replacement.

## Source/UI QA
- TypeScript/TSX parser: **70 files, 0 syntax errors**.
- UI audit script: **0 unlabeled buttons, fields, or links found**.
- Static route audit: **26 application routes, 27 static internal hrefs, 0 missing routes**.
- Unsafe FormData pattern audit: **0 handlers using `new FormData(e.currentTarget)` after asynchronous work**.
- Receipt document action contrast fixed: `.button.ghost` now has explicit foreground/background/border colors, including disabled buttons.
- Customer request file controls use hidden native file inputs and labeled `Attach/Upload` buttons; no blank native file field is intentionally rendered.

## Build limitation
A full local `npm install` / `next build` could not complete in the artifact runtime because package installation timed out. This release therefore has parser-level TypeScript validation, UI/source audits, and live Supabase integration tests. Vercel/CI must still perform the final dependency install and production build.
