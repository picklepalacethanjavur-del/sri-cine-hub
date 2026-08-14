# Sri Cine Hub V5.3 — Workflow & Progress UX

Built on V5.2.

## Included
- Generate Quotation now creates a `generated` quotation and automatically opens the customer-facing document view.
- Generated document shows success confirmation and workflow actions.
- Workflow: Generated → Mark Sent → Mark Accepted / Declined → Convert to Booking.
- Convert to Booking only appears prominently after Accepted.
- Editing a quotation uses Save Draft / Generate Updated Quotation; conversion is removed from the pricing editor.
- Quotations list opens the document view directly; Edit Quotation is available from the document.
- Quote Request and Quotation status badges are larger, higher-contrast and color-coded.
- Global gold navigation progress bar for internal page/link navigation.
- Heavy actions show centered progress overlay and spinner.
- Buttons show action-specific text such as Generating…, Marking Sent…, Creating Booking….
- Existing V5.2 searchable/category-grouped public equipment picker is retained.

## Backend
Migration `quotation_document_workflow_v53` has already been applied to the Sri Cine Hub Supabase project and is also included in `supabase/migrations/20260814_quotation_document_workflow_v53.sql`.
