# Sri Cine Hub V6.3 — QA Execution Report

Date: 2026-08-18
Environment: Supabase project `ucqjgavwncpwrjrmtkfr` (not-live environment)
Release target: V6.3 QA Hardened

## Release blockers fixed

1. **Quote flow RLS failure** — internal request creation no longer relies on a browser-side direct insert. It now uses `staff_create_quote_request`, which validates an active staff session and performs the write through a staff-only RPC.
2. **Attachment RLS fragility** — quote request attachment metadata now uses staff-only RPCs. Quote documents, supplier RFQ documents, and rental evidence all have explicit authenticated staff storage policies.
3. **Missing `rental-evidence` storage policies** — this was a real defect and would block proof-photo upload during checkout/return. SELECT/INSERT/UPDATE/DELETE staff policies were added.
4. **Non-atomic checkout/return** — asset lines, asset statuses, camera hours, evidence metadata, booking state, receipt creation, and maintenance creation are now protected by atomic database RPCs.
5. **Partial-state risk after proof-photo upload** — uploaded evidence files are cleaned up when the atomic checkout/return RPC fails.
6. **Damaged/missing return handling** — damaged or missing owned assets are moved to maintenance and a maintenance record is created automatically.
7. **Payment status defect** — unpaid returned rentals now remain `pending`; partial is used only when some payment exists; zero balance becomes `paid`.
8. **FormData lifecycle defect** — all submit handlers capture FormData synchronously before any await; no `new FormData(e.currentTarget)` patterns remain.
9. **Unlabeled UI controls** — interaction audit found zero unlabeled buttons, inputs, selects, textareas, or links after fixes.
10. **Blank request attachment field** — the new-request form now uses a clean `+ Attach Request Files` control and displays selected filenames instead of a blank native file field.
11. **Dead legacy quotation UI** — obsolete `QuoteManager.tsx`, which performed multi-step direct quotation inserts, was removed. `/admin/quotes` remains a redirect to the current Quote Requests workflow.
12. **Legacy RPC surface** — unused old public quote/catalog RPCs were closed; current public quote request V2 and public equipment availability remain intentionally public.

## Executed test cases

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| RLS-01 | Active admin direct staff-policy insert | Allowed | Insert succeeded under authenticated admin claims | PASS |
| RLS-02 | Anonymous direct insert to `quote_requests` | Blocked by RLS | `new row violates row-level security policy` returned | PASS |
| RLS-03 | Internal request through `staff_create_quote_request` | Create workspace with optional fields | Created successfully | PASS |
| RLS-04 | Anonymous call to staff RPC | Denied | Staff RPC EXECUTE removed from anon | PASS |
| RLS-05 | Public quote RPC `submit_quote_request_v2` as anon | Allowed | `QR-20260818-42A0D3` created | PASS |
| RLS-06 | Quote request document storage policy | Staff write allowed | Authenticated storage policy simulation succeeded | PASS |
| RLS-07 | Rental evidence storage policy | Staff write allowed | Authenticated storage policy simulation succeeded | PASS |
| RLS-08 | Supplier RFQ document storage policy | Staff write allowed | Authenticated storage policy simulation succeeded | PASS |
| QUOTE-01 | Empty/incomplete draft | No customer/date/items required | `QT-20260818-55B7BF`, total 0 | PASS |
| QUOTE-02 | Invalid date range | Reject return before start | `Return must be after start` | PASS |
| QUOTE-03 | Mixed own/supplier/service quote | Correct total and sources | `QT-20260818-FE4EB1`, total 77,500 | PASS |
| QUOTE-04 | Generate → Sent → Accepted → Convert | Preserve quote total | `BK-2026-127EAD`, quoted total 77,500 | PASS |
| QUOTE-05 | Generated revision snapshot | Revision stored | Revision 1 exists | PASS |
| QUOTE-06 | Owned-asset availability collision | Conversion blocked | `need 1, found 0` returned | PASS |
| QUOTE-07 | Atomic E2E quote | Correct total | `QT-20260818-CC7692`, total 26,750 | PASS |
| BOOK-01 | Physical asset auto-allocation | Allocate exact serialized units at conversion | CAM-004 + ACC-002 allocated | PASS |
| OPS-01 | Checkout wrong asset count | Reject and roll back | Expected 2 / received 1; booking remained Reserved; assets Available | PASS |
| OPS-02 | Atomic checkout | All owned assets transition together | Booking Checked Out; camera/accessory Out | PASS |
| OPS-03 | Return hours below checkout hours | Reject and roll back | Booking remained Checked Out; no receipt created | PASS |
| OPS-04 | Atomic valid return | Return all owned assets and create receipt | Booking Returned; receipt generated | PASS |
| OPS-05 | Damaged accessory | Move to maintenance + create maintenance record | Maintenance record created with `Damage reported on return` | PASS |
| OPS-06 | QA operational cleanup | Do not leave real inventory blocked | CAM-004 and ACC-002 restored Available; QA maintenance Cancelled | PASS |
| PAY-01 | Fully paid return | Balance 0 / Paid | Paid; balance 0 | PASS |
| PAY-02 | No payment return | Balance due / Pending | Pending with balance 26,750 in rollback test | PASS |
| RCPT-01 | Receipt math | Rental + charges - payment = balance | 26,750 + 1,000 + 500; paid 28,250; balance 0 | PASS |
| RFQ-01 | Supplier catalog + Supplier RFQ | Create and progress RFQ | `RFQ-20260818-CCC6DB` → Confirmed | PASS |
| ATT-01 | Attachment metadata add/delete RPC | Add then remove safely | Final metadata count 0 | PASS |
| ACL-01 | Staff-only workflow function ACL | anon false, authenticated true | Verified for quote/booking/checkout/return/RFQ RPCs | PASS |
| UI-01 | Button labels | No unlabeled controls | 66 buttons audited; 0 unlabeled | PASS |
| UI-02 | Form field labels | No unlabeled controls | 97 inputs, 14 selects, 9 textareas audited; 0 unlabeled | PASS |
| UI-03 | Internal static navigation | All fixed href routes exist | 25 static routes checked; 0 missing | PASS |
| CODE-01 | TypeScript/TSX parser | No syntax parse errors | 66 TS/TSX files; 0 parse errors | PASS |
| CODE-02 | Unsafe FormData pattern | No currentTarget-after-await hazard | 0 unsafe patterns | PASS |
| RPC-01 | Frontend RPC inventory | Every referenced RPC exists | All 15 current RPC names found exactly once | PASS |

## Persistent QA records intentionally left in Supabase

The environment is not live and these are intentionally retained for inspection. They are easy to identify by the `QA-V63` prefix.

- `QR-20260818-1869ED` / `QT-20260818-FE4EB1` / `BK-2026-127EAD` / `RC-20260818-07B426` — mixed-source E2E regression.
- `QR-20260818-42A0D3` — anonymous public quote request.
- `QR-20260818-273CB7` / `QT-20260818-55B7BF` — empty draft regression.
- `QR-20260818-4A830E` / `QT-20260818-67AD8B` / `BK-2026-37809D` — availability blocker test; booking cancelled after validation.
- `QR-20260818-F4BA7C` / `QT-20260818-5AF974` — accepted conflict quote; conversion intentionally failed.
- `QR-20260818-9D0CE3` / `QT-20260818-CC7692` / `BK-2026-E5D40E` / `RC-20260818-3E7724` — new atomic checkout/return E2E.
- Supplier `QA-V63 Supplier Rentals`, catalog item `QA Cooke S7/i FF Lens Set`, RFQ `RFQ-20260818-CCC6DB`.
- QA maintenance record created during the damaged-accessory test is retained as **Cancelled**; the real test asset was restored to Available.

## Important QA limitation

A literal authenticated browser click-through of every deployed control was not possible because the QA tools do not inherit the user's private browser login session. To compensate, the release used three layers:

1. real database integration tests under authenticated admin JWT claims,
2. deliberate RLS/rollback/failure-path execution,
3. source-level interaction/label/route/FormData audits across the complete package.

A full `next build` was also not completed in this isolated artifact environment because `npm install` timed out. TypeScript/TSX parser QA completed with zero syntax errors. Vercel should run the dependency install and production build when this package is deployed.
