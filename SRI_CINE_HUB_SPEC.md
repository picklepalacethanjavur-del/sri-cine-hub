# Sri Cine Hub — Product Specification

> Camera rental management platform for a film equipment rental studio.
> Built with **Next.js 15 App Router + Supabase** (PostgreSQL + Auth + RLS).
> Dark theme. Mobile-aware sidebar + bottom bar.

---

## Problem Statement

A film equipment rental studio in Thanjavur manages cameras, lenses, lights, grip, and audio gear for local production companies, independent filmmakers, and ad-shoot crews. Day-to-day operations include:

- Walk-in customers who need equipment on the spot
- Production companies requesting multi-day, multi-camera packages in advance
- Equipment added mid-booking when crews realize they need more gear
- Staggered payments — advance paid on booking, partial mid-shoot, balance on return
- Equipment returned at different times within the same booking
- Equipment sourced ("hired in") from other vendors when the studio's own stock is insufficient
- Investors who want visibility into revenue and utilisation without operational access
- Managers handling checkouts, returns, receipts while the admin handles pricing, deals, and financials

The platform replaces a spreadsheet + WhatsApp workflow and needs to handle the full rental lifecycle from quote request → booking → checkout → return → receipt → payment settlement.

---

## Roles

| Role | Description | Access |
|---|---|---|
| **admin** | Studio owner | Everything, including Deals section and full correction controls |
| **manager** | Counter staff / operations | All booking, checkout, return, inventory, and supplier ops. No Deals. |
| **investor** | Silent partner / stakeholder | Read-only portal. Only sees bookings that physically left the studio. |

Auth is via Supabase email/password. Profiles table: `id, full_name, phone, role, is_active`. `is_active = false` blocks login regardless of role.

---

## Navigation

Sidebar (desktop) + bottom bar (mobile, first 6 items):

| Label | Path | Roles |
|---|---|---|
| Today | `/studio` | admin, manager |
| Quick Rent | `/admin/quick-rent` | admin, manager |
| Requests | `/studio/requests` | admin, manager |
| Bookings | `/studio/bookings` | admin, manager |
| Checkout/Return | `/studio/ops` | admin, manager |
| Receipts | `/studio/receipts` | admin, manager |
| Hire-In | `/admin/sourcing` | admin, manager |
| Calendar | `/admin/calendar` | admin, manager |
| Inventory | `/studio/inventory` | admin, manager |
| Suppliers | `/studio/suppliers` | admin, manager |
| Setup | `/admin/setup` | admin, manager |
| **Deals** | `/admin/deals` | **admin only** |
| Investor Portal | `/invest` | admin, investor |

---

## Features

### 1. Today Dashboard (`/studio`)

**Purpose**: Single-screen status of the studio right now.

Metrics shown:
- Cameras out today
- Active overdue bookings
- Pending quote requests
- Today's checkouts due
- Today's returns due

Lists:
- Pending quote requests (link → request detail)
- Active bookings with status badges

Auto-syncs overdue status via `sync_overdue_bookings` RPC on page load.

---

### 2. Quick Rent (`/admin/quick-rent`)

**Purpose**: Walk-in or phone customer — create a booking in under 60 seconds.

**Layout**: Two-panel split (catalog left, cart + form right).

**Left panel — Catalog**:
- Search box (name, code, brand, category)
- Filter tabs: All / Cameras / Accessories
- Equipment cards showing rate/day
- Unavailable items (already booked for selected dates) shown greyed out with "Booked" label
- Tap to add/remove from cart

**Right panel — Cart + Form**:
- Customer section: Name (required), Phone, Company/Production
- Dates section: Checkout date, Return date — clicking anywhere on the date row opens the calendar picker
- Shows rental duration in days
- Cart: each selected item shows rate/day (editable inline), line total
- Footer: grand total + "Check Out →" button

**On submit**:
1. Creates `customers` record
2. Creates `bookings` record with `status = "confirmed"`, booking code `BK-YYYY-XXXXXX`
3. Inserts `booking_cameras` / `booking_accessories` rows
4. Redirects to Checkout/Return page pre-loaded with the new booking

**Availability check**: When dates are set, queries `booking_cameras` + `booking_accessories` joined to active bookings (not cancelled/returned) for overlapping date ranges and removes conflicts from the selectable catalog.

---

### 3. Quote Requests (`/studio/requests`)

**Purpose**: Manage inbound customer enquiries before they become bookings.

- List of all quote requests with status badges
- New request form: customer name, phone, company, shoot dates, equipment description, notes
- Detail page (`/studio/requests/[id]`): PricingWorkspace / QuoteBuilder
  - Add equipment line items with quantities and rates
  - Calculate totals
  - Convert to booking or send quote to customer

---

### 4. Bookings (`/studio/bookings`, `/admin/bookings/[id]`)

**Booking list** — grouped by status:

| Group | Statuses |
|---|---|
| Active | reserved, confirmed, preparing |
| Out | checked_out, overdue |
| Completed | returned |

Clicking an "Out" booking → Checkout/Return page. Clicking any other → Booking detail.

---

**Booking Detail** (`/admin/bookings/[id]`):

**Metric bar**: Total Charges · Paid · Outstanding (amber if balance remains)

**Equipment panel**:
- Lists every camera and accessory in the booking
- Each line: code, name, date range (item-level start/end or booking default), rate/day, days, line total
- Items returned early shown at 55% opacity with ✓ Returned tag
- Items added mid-booking tagged "added mid-booking"
- **"Return Early"** button per active item → modal to pick a return date; stops billing from that date
- **"Add Equipment"** button → modal to add camera or accessory mid-booking:
  - Type selector (Camera / Accessory)
  - Item picker (shows only available equipment not already in this booking)
  - From date (default: today), To date (default: booking end)
  - Daily rate (pre-filled from internal_rates, overrideable)
  - Preview: X days × ₹rate = ₹total

**Payments panel**:
- Summary line: Charged · Paid · Outstanding
- Payment list: each entry shows amount, type (advance/intermediate/final), method, date, reference, notes
- **"Add Payment"** button → modal:
  - Amount (₹), Date
  - Type: Advance / Intermediate / Final
  - Method: Cash / UPI / Bank Transfer / Cheque
  - Reference / UTR, Notes
  - Preview: "After this: outstanding = ₹X"

**Correction Panel** (admin/manager):
- Edit booking details (production name, project, contact, dates, locations, operator, notes)
- Date edits locked after checkout so availability history is preserved
- Correct checkout/return records (meter hours, condition) with mandatory reason
- Every correction is audit-logged

**Activity History**:
- Full audit log of all actions with timestamps

---

### 5. Checkout / Return (`/studio/ops`)

**Purpose**: The physical handover moment — camera leaves the studio, or comes back.

**Checkout flow** (booking status: confirmed/reserved/preparing):
- Select booking from list or via `?booking=<id>` query param
- Shows equipment list
- Record checkout hours (meter reading) per camera
- Record condition out per item (good / fair / damaged)
- Confirm checkout → status → `checked_out`

**Return flow** (booking status: checked_out / overdue):
- Record return hours (meter reading) per camera
- Record condition in per item (good / fair / damaged / missing)
- Flag any damage
- Confirm return → status → `returned`
- Triggers receipt generation option

---

### 6. Receipts (`/studio/receipts`)

- List of all generated receipts
- Per-receipt: itemised equipment charges, payments received, balance due
- Printable PDF view
- Balance carried over if not fully paid

---

### 7. Hire-In / Sourcing (`/admin/sourcing`)

**Purpose**: When the studio doesn't have a piece of equipment, they rent it from another vendor and sub-rent to the customer.

- Supplier RFQ (Request for Quotation) creation
- Equipment list per RFQ
- Supplier response tracking
- Links to the booking it supports

---

### 8. Calendar (`/admin/calendar`)

- Equipment availability view across a date range
- Shows which cameras are free / booked / reserved per date
- Useful for planning before confirming a booking

---

### 9. Inventory (`/studio/inventory`)

**Cameras**:
- Fields: Code, Name, Manufacturer, Model, Serial Number, Meter Hours, Location, Status
- Status: available / booked / maintenance / retired
- Inline edit form per item
- Delete with confirmation

**Accessories**:
- Fields: Code, Name, Category, Status
- Same edit/delete controls

---

### 10. Suppliers (`/studio/suppliers`)

- Supplier name, contact, specialisation
- Used in Hire-In RFQs

---

### 11. Deals (`/admin/deals` — admin only)

- Long-term pricing agreements or special rates for repeat production companies
- Linked to quote requests

---

### 12. Investor Portal (`/invest`)

- Read-only dashboard for investors / silent partners
- **Only shows bookings that physically went out**: status must be `checked_out`, `overdue`, or `returned`
- Excludes reserved / confirmed / preparing / cancelled (intent without commitment)
- Metrics: active rentals count, total bookings out, revenue (from bookings that returned)

---

## Database Schema

### Core tables

```sql
profiles          -- id (FK auth.users), full_name, phone, role, is_active
customers         -- id, name, company_name, phone
cameras           -- id, camera_code, name, manufacturer, model, serial_number, meter_hours, location, status
accessories       -- id, accessory_code, name, category, status
internal_rates    -- camera_id, accessory_id, daily_rate_inr
```

### Booking lifecycle

```sql
bookings
  id, booking_code, customer_id, status
  production_name, project_name, contact_name, contact_phone
  start_at, end_at (timestamptz)
  camera_charge_inr, other_charges_inr, discount_inr
  quoted_total_inr  -- GENERATED (sum of charge columns)
  payment_status, amount_received_inr
  pickup_location, return_location, operator_name, notes

booking_cameras
  id, booking_id, camera_id
  daily_rate_inr            -- overrideable per line
  item_start_at, item_end_at -- nullable; falls back to booking dates
  returned_at               -- set when returned early
  checkout_hours, return_hours, condition_out, condition_in

booking_accessories
  id, booking_id, accessory_id, quantity
  daily_rate_inr
  item_start_at, item_end_at
  returned_at
  condition_out, condition_in
```

### Payments & receipts

```sql
payments
  id, booking_id, amount_inr, method
  transaction_type  -- advance | intermediate | final
  received_at, received_by, reference, notes
  status, reversed_payment_id, correction_reason

receipts
  id, booking_id, receipt_code, balance_inr
```

### Quote flow

```sql
quote_requests      -- inbound customer enquiries
quotations          -- structured quote with line items
quotation_items     -- equipment + rate + quantity
equipment_kits      -- preset equipment bundles
```

### Suppliers / Hire-In

```sql
suppliers
supplier_rfqs
supplier_rfq_items
supplier_catalog_items
```

### Audit

```sql
audit_log    -- entity_id, action, old_data (jsonb), new_data (jsonb), created_at
```

---

## Booking Status Flow

```
quote_request → quotation → booking (reserved)
                                 ↓
                            confirmed          ← Quick Rent creates here
                                 ↓
                           (preparing)
                                 ↓
                           checked_out         ← Checkout action
                                 ↓
                            overdue            ← auto-set by sync_overdue_bookings RPC
                                 ↓
                            returned           ← Return action
                                 ↓
                            closed / receipt generated

Any status → cancelled (at any time before return)
```

---

## Invoice / Charge Calculation

```
For each line item (camera or accessory):
  start = item_start_at ?? booking.start_at
  end   = item_end_at   ?? booking.end_at
  days  = ceil((end - start) / 86400000)   -- min 1 day
  line  = daily_rate_inr × days

total_charges = Σ all line totals
total_paid    = Σ payments.amount_inr (all transaction_types)
outstanding   = total_charges − total_paid
```

Invoice is always regenerated live from current data (no stored snapshot). Can be printed/sent multiple times during the rental period.

---

## Day-to-Day Customer Scenarios

### Scenario 1: Walk-in same-day rental
> "I need a Sony FX3 and a 50mm lens from today until Friday."

Handled via **Quick Rent**. Staff searches catalog, adds items, enters customer name and dates, hits "Check Out". Booking created as `confirmed`, staff immediately taken to the Checkout/Return page to record meter hours and condition.

---

### Scenario 2: Production company advance booking
> "We're shooting a 5-day ad film next month. Need 2 cameras, slider, wireless mics, and a lighting kit."

Customer submits via **Quote Request** or staff creates a request. Quote is built in PricingWorkspace, sent to customer, then converted to a booking. Booking sits as `confirmed` until the shoot begins.

---

### Scenario 3: Equipment added mid-booking
> "We need an ND filter kit and a second monitor. Can you add it from Day 3?"

Open booking detail → **Add Equipment** → select items → set `From = Day 3`, `To = end of booking` → enter rate. New items appear on the equipment list with their own date range. Invoice recalculates automatically.

---

### Scenario 4: Early partial return
> "We're done with the slider, dropping it off today even though the main cameras stay till Friday."

Open booking detail → **Return Early** on the slider row → pick today's date. Slider's billing stops today; camera billing continues to original end date. Overall booking stays `checked_out`.

---

### Scenario 5: Staggered payments
> Advance ₹20,000 on booking day. Mid-shoot ₹15,000. Balance ₹8,500 on final return.

Each payment recorded via **Add Payment** on the booking detail. Type set appropriately (advance / intermediate / final). Outstanding balance updates after each entry. Invoice printed after each payment to hand to the customer showing what's paid and what remains.

---

### Scenario 6: Equipment not in stock — hire-in
> "We don't have an Arri Alexa Mini LF. Can you still supply it?"

Studio creates a **Hire-In RFQ** to a supplier they work with. Supplier rate is noted; studio marks up and quotes customer. Hire-in record links to the customer booking.

---

### Scenario 7: Overdue equipment
> Booking end date passed but camera not returned.

`sync_overdue_bookings` RPC auto-transitions status to `overdue` on page load. Shows prominently on Today dashboard. Staff calls customer. When returned, ops page records it normally.

---

### Scenario 8: Booking correction after the fact
> "I entered the wrong project name / wrong contact number."

**Correction Panel** on booking detail. Edit fields, enter a reason, save. Every correction creates an audit log entry. Dates are locked after checkout to preserve availability history.

---

### Scenario 9: Damage on return
> Customer returns camera with a cracked screen.

Ops return flow: condition = `damaged`. Audit log records it. Staff can add a note. Damage charge handled as a separate payment or manual adjustment.

---

### Scenario 10: Investor check-in
> "How many cameras are out right now? What's our utilisation?"

Investor logs into `/invest`. Sees only bookings that physically left (checked_out / overdue / returned). No access to admin functions, customer details, or pricing levers.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router |
| Database + Auth | Supabase (PostgreSQL + Supabase Auth) |
| Styling | Vanilla CSS (dark theme, CSS variables) |
| PDF generation | Custom API routes (`/api/documents/...`) |
| Deployment | Vercel (or similar) |
| Language | TypeScript |

### Auth pattern
- Server components use `createServerClient` with `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key) — RLS enforced
- `requireStaff()` in `lib/auth.ts` checks profile role + is_active, redirects to `/investors` if not allowed
- `requireInvestor()` allows admin / manager / investor roles

### RLS pattern
All tables have RLS enabled. Authenticated users get blanket SELECT via `USING (true)` policies. Writes go through the client SDK (manager-level inserts) or RPCs with `SECURITY DEFINER` (corrections, status transitions).

### Key RPCs
- `sync_overdue_bookings()` — auto-transitions past-due bookings to overdue
- `correct_booking_details()` — audit-safe booking edit
- `correct_checkout_asset()` / `correct_return_asset()` — audit-safe operational corrections

---

## Recreating This App — Prompt

```
Build a camera rental management web app called "Sri Cine Hub" using Next.js 15 
App Router and Supabase.

ROLES: admin (full access), manager (all ops, no Deals), investor (read-only portal).

CORE FEATURES:
1. Today dashboard — metrics: cameras out, overdue, pending requests, today's 
   checkouts/returns due
2. Quick Rent — two-panel: catalog (search + filter camera/accessory) on left, 
   cart + customer form + date picker on right; creates a confirmed booking and 
   redirects to ops
3. Quote Requests — inbound enquiries; quote builder to price and convert to booking
4. Bookings list — grouped by status (Active / Out / Completed)
5. Booking detail — per-item pricing with own date ranges and overrideable rates; 
   Add Equipment mid-booking; Return Early per item; payments panel with 
   Add Payment (advance/intermediate/final); outstanding balance always live-computed
6. Checkout / Return ops — record meter hours, condition; transition status; 
   handle overdue auto-sync
7. Receipts — itemised print view; balance tracking
8. Hire-In — supplier RFQ for equipment the studio doesn't own
9. Inventory — cameras and accessories with edit/delete
10. Suppliers — vendor list for hire-in
11. Calendar — availability view across date range
12. Deals — admin-only special pricing agreements
13. Investor portal — bookings that physically left the studio only 
    (status: checked_out, overdue, returned)

DB: bookings, booking_cameras, booking_accessories (both with item_start_at, 
item_end_at, daily_rate_inr, returned_at for per-item billing), customers, cameras, 
accessories, internal_rates, payments, receipts, quote_requests, quotations, 
suppliers, audit_log, profiles.

STATUS FLOW: confirmed → checked_out → overdue (auto) → returned.

INVOICE: total_charges = Σ (daily_rate_inr × days per item), outstanding = charges − paid.
Regenerated live; no stored snapshots.

STYLE: Dark theme (#080808 background, #d8b45a gold accent, white text), 
sidebar navigation (desktop) + bottom bar (mobile). No external UI libraries.
```
