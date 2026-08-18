# Sri Cine Hub V6.5 — Premium Receipt QA

## Scope
Premium redesign of the customer-facing rental receipt. OUT Condition / IN Condition is intentionally not included.

## Data-model QA
Both the browser receipt and downloaded PDF now use `loadPremiumReceiptData()` from `lib/receiptData.ts`.

Validated against the existing Sri Cine Hub receipt:
- Receipt: RC-20260818-5D0012
- Booking: BK-2026-4084B8
- Quotation: QT-20260817-9C7792
- Customer: Kumaravel
- Project: Madurai project
- Rental item: ARRI ALEXA 35 (S35)
- Physical asset: CAM-001
- Quantity: 1
- Days: 2
- Rate: Rs. 18,000
- Amount: Rs. 36,000
- Posted payment: Rs. 36,000 via UPI
- Current balance: Rs. 0

The new receipt therefore has enough database information to replace the old single `Rental Rs. 36,000` row with a real itemized rental receipt.

## Screen/PDF parity
PASS
- Screen and PDF use the same normalized receipt data object.
- Supplier name, supplier cost, and internal margin are not present in the customer renderer.
- Reversed payments are removed from the clean customer-facing payment history while remaining available in the internal ledger/history.

## Receipt sections
PASS
- Sri Cine Hub premium document header
- Receipt number and issue date
- PAID / PARTIALLY PAID / BALANCE DUE badge
- Client Information
- Rental Summary
- Booking and quotation references
- Pickup / return date-time
- Duration
- Optional production, operator, pickup and return locations
- Equipment & Services line items
- Asset / serial
- Quantity
- Days
- Rate
- Amount
- Charge breakdown
- Payment summary
- Payment history
- Notes
- Footer
- Back / Print / Download / Share / WhatsApp / Close actions

## Explicit exclusion
PASS
No OUT Condition / IN Condition labels, fields, or condition columns are rendered in the receipt screen or receipt PDF.

## Static source QA
PASS
- 72 TypeScript/TSX files parsed with the TypeScript parser.
- 0 syntax parse errors.
- `lib/receiptData.ts` independently type-checked successfully.
- `lib/receiptPdf.ts` type-checked successfully with a local pdf-lib type stub used only for QA because node_modules are not included in the source package.
- No supplier-name, supplier-cost, or margin fields are referenced by customer receipt renderers.
- No receipt condition fields are referenced by customer receipt renderers.
- Existing document actions confirmed: Back, Print / Save PDF, Download PDF, Share, WhatsApp, Close.

## Build limitation
A complete local `npm install` / Next.js production build could not be completed in the artifact runtime because dependency installation exceeded the execution timeout. Vercel/CI should run the final dependency installation and production build after deployment.
