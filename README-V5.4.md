# Sri Cine Hub V5.4 — External Requirement & Sub-Rental Workflow

Built on V5.3.

## Customer request documents
- Staff can create a new **External Request** when a production company sends its own requirement sheet.
- Attach multiple PDF, image, Excel, CSV, Word, or similar request documents (25 MB each).
- Original documents stay linked to the Quote Request and remain visible while editing the quotation.
- Documents are stored in a private Supabase bucket and opened with short-lived signed URLs.

## Source-aware quotation lines
Every quotation line now keeps both the customer's original wording and the customer-facing quotation description. Lines can be fulfilled as:
- **OWN** — Sri Cine Hub inventory
- **SUB-RENTAL** — equipment sourced from another rental company
- **MANUAL** — non-inventory / one-off item
- **SERVICE** — crew or production/post-production service

Quotation items support section headings such as Camera, Lenses, Accessories & Attachments, Lights, Grip, Audio, Transport, Gensets, Crew, and Post Production.

## Sub-rental pricing
- Supplier / rental company
- Supplier cost
- Cost basis: Daily / Weekly / Flat
- Supplier status: Not checked / Requested / Confirmed / Received / Returned / Cancelled
- Supplier quote/reference
- Gross margin preview
- Supplier details and supplier cost remain internal and never appear on the customer PDF.

## Customer quotation
- Final quotation is grouped by section/category like a production requirement sheet.
- Only customer-facing description, quantity, days, customer rate, and amount are shown.
- Internal asset IDs, supplier company, supplier cost, and sourcing status are hidden.

## Booking / procurement
When an Accepted quotation is converted to a booking:
- Only **OWN** inventory items are checked for availability and assigned as Sri Cine Hub assets.
- **SUB-RENTAL** lines automatically become booking sub-rental requirements.
- New **Sub-Rentals** admin screen tracks sourcing through Requested → Confirmed → Received → Returned.
- Bookings show when external equipment is still waiting to be sourced.

## Backend
Migration already applied to Sri Cine Hub Supabase:
`20260817_external_request_subrental_workflow_v54.sql`

Automatic OCR/import from PDFs is intentionally not included in V5.4. Staff reviews and enters the requirement lines manually, which keeps pricing and fulfillment decisions controlled.
