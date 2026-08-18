# V6.2 QA Checklist

## Quote
- [x] Create quotation with owned inventory, supplier item and service
- [x] Generate quotation
- [x] Mark sent
- [x] Mark accepted
- [x] Convert to booking
- [x] Quotation/booking total retained exactly
- [x] Supplier item carried to sub-rental sourcing
- [x] Owned camera allocated to an exact physical body
- [x] Owned accessory allocated to an exact physical asset

## Checkout
- [x] Camera scan event supported
- [x] Accessory scan event supported
- [x] Manual code entry supported
- [x] Manual override supported with reason
- [x] FormData captured before awaits
- [x] Camera hours/condition update
- [x] Camera status changes to out
- [x] Accessory condition update
- [x] Accessory status changes to out
- [x] Booking becomes checked_out

## Return
- [x] Camera return verification
- [x] Accessory return verification
- [x] Return hours/condition update
- [x] Good/fair items return to available
- [x] Damaged/missing items route to maintenance
- [x] Booking becomes returned

## Receipt/Documents
- [x] Receipt upsert after return
- [x] Charges and balance validated
- [x] Quotation PDF route present
- [x] Supplier RFQ PDF route present
- [x] Receipt PDF route present
- [x] Print / Download / Share / WhatsApp common actions present
- [x] Share failures display visible feedback

## Interaction audit
- [x] Button labels audited
- [x] Icon button aria labels audited
- [x] Literal internal route targets audited
- [x] Admin field labels audited
- [x] Unsafe async React event/currentTarget patterns audited

Note: the live admin deployment redirects unauthenticated QA clients to `/login`, so the automated runner cannot inherit the user's browser session. Authenticated workflow behavior was therefore verified through the exact UI handlers/source plus live Supabase end-to-end state transitions.
