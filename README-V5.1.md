# Sri Cine Hub V5.1 — Quotation Workflow Hardening

Fixes from V5 QA:
- Atomic initial quotation creation: header + items + request status commit together.
- Atomic quotation editing: existing line items are never deleted unless replacement succeeds.
- Atomic quotation-to-booking conversion.
- Conversion is Accepted-only.
- Conversion re-checks camera and accessory availability immediately before reservation.
- Equipment kits expand into their serialized camera/accessory assets during booking conversion.
- `bookings.quoted_total_inr` is populated from the quotation grand total so return receipts use the correct rental amount.
- Added camera/accessory/kit rows inherit the quote request rental duration instead of defaulting to one day.
- Converted quote request, quotation, booking and asset assignments are updated in one transaction.
- Quotation internal-rate snapshots remain unchanged and customer-facing print view still exposes only quoted rates.

The required Supabase RPC migrations have already been applied:
- `create_quotation_atomic`
- `save_quotation_atomic`
- `convert_quotation_to_booking_atomic`
