# Sri Cine Hub V6.5 — Premium Rental Receipt

## Premium receipt redesign
- Shared receipt data model feeds both on-screen document and downloaded PDF.
- Client information and rental summary cards.
- Full equipment/service itemization with asset/serial, quantity, days, rate and amount.
- Quotation number included when a booking originated from a quotation.
- Charge breakdown separates rental, damage, late, additional charges and discounts.
- Payment summary with PAID / PARTIALLY PAID / BALANCE DUE.
- Clean customer-facing payment history sourced from the V6.4 payment ledger.
- Notes and premium Sri Cine Hub document styling.
- No OUT Condition / IN Condition section, by design.
- Supplier names, supplier costs and internal margin information are never shown on the customer receipt.
- Document toolbar retains Back, Print/Save PDF, Download PDF, Share, WhatsApp and Close.

## PDF
`lib/receiptPdf.ts` renders the receipt with the same `PremiumReceiptData` assembled by `lib/receiptData.ts`, preventing screen/PDF data drift.
