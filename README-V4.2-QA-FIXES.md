# Sri Cine Hub P1 V4.2 — Quote QA Fixes

This release fixes all quote-page issues identified in the live QA pass:

- Submit button no longer stays on `Submitting…`
- Loading state always resets using `try/finally`
- Prevents duplicate submissions while a request is in progress
- Successful submission cleanly resets the form, dates, selected cameras and availability state
- Clear empty state when no cameras are configured/available for the selected dates
- Rejects past start times
- Rejects return time that is not after start time, including same-day invalid time ranges
- Availability lookup now has its own loading/error handling
- Success/error announcements use `aria-live`
- Better small-screen date/time picker layout
- Keeps customer-facing pricing hidden

Replace the repository contents with this full package and push to `main`.
Vercel should redeploy automatically.
