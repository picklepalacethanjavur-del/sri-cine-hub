# Sri Cine Hub V6 — Supplier Network Foundation

V6 refactors the quotation and supplier architecture around the real rental workflow. It is intentionally a larger foundation release rather than another V5 patch.

## Core model
A customer request item, a quotation line, a canonical equipment model, an owned serialized asset and a supplier listing are separate records.

### Source choices in quotation builder
- OUR INVENTORY — models Sri Cine Hub owns; exact physical QR/serial asset is allocated only when the accepted quotation converts to a booking.
- SUPPLIER NETWORK — reusable supplier catalog listing with private cost snapshot.
- MANUAL — one-off equipment/charge that should not become permanent inventory.
- SERVICE — crew, transport, post-production and similar services.

## V6 quotation builder
- Two-panel desktop workflow optimized for 20+ items.
- Left: source tabs, search and categories.
- Right: sticky Current Quotation with compact editable line cards.
- Adding an item does not navigate away from the source list.
- Supplier/internal costs remain private.
- Estimated direct external cost and gross margin are shown internally.
- Optional quotation settings are collapsed instead of occupying the main page.
- Draft quotation can be saved with incomplete customer/dates/items.

## Supplier foundation
- Master Equipment Catalog with canonical models.
- Supplier profiles.
- Reusable Supplier Catalog with quantity, normal cost, rate basis, location, availability notes and last-confirmed timestamp.
- Supplier RFQ workflow and supplier-specific RFQ PDF.
- Supplier RFQ response metadata and attachments foundation.
- Supplier catalog is not mixed into Sri Cine Hub physical inventory.

## Request documents
- Customer request documents remain linked to the quote request.
- Upload UI uses an explicit button and hidden file input so there is no blank clickable attachment field.

## Documents
Reusable external-document action standard:
- Print / Save PDF
- Download PDF
- Share
- WhatsApp helper

Implemented for:
- Customer quotation
- Supplier RFQ
- Receipt

Download PDF uses a real generated PDF endpoint rather than relying only on the browser print dialog. Sharing/downloading does not automatically mark a document Sent.

## Quotation revisions
Every generated quotation can create an immutable revision snapshot so the system can retain what was actually generated/sent at a point in time.

## Booking conversion
- Rental dates are required only at booking conversion, not draft creation.
- Exact physical owned assets are allocated by canonical model when converting an accepted quote.
- Availability is rechecked at conversion.
- Supplier-sourced lines become booking sub-rental/procurement obligations.

## Database
The V6 migrations have already been applied to the current Sri Cine Hub Supabase project. Migration SQL is included under `supabase/migrations` for source control/reference.

## QA performed
Rollback/cleanup QA covered:
1. Empty/incomplete request + empty draft quotation — succeeded at ₹0.
2. Quotation with canonical owned ARRI ALEXA 35 model + supplier Cooke lens line — generated total ₹79,500.
3. Accepted quotation conversion — exact CAM-001 ARRI ALEXA 35 physical asset auto-allocated; one supplier sourcing obligation created; booking total remained ₹79,500.
4. Supplier RFQ generation — RFQ record and item creation succeeded.
5. QA rows were removed after verification.

## Build note
A full `next build` could not be completed in the artifact environment because package dependency installation timed out. Source-level checks found no TypeScript parser/syntax errors in the new files. Run `npm install` and `npm run build` in CI/Vercel after pushing.
