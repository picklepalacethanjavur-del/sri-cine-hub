# Sri Cine Hub V3

Live Next.js + Supabase foundation for Sri Cine Hub Pvt. Ltd., Chennai.

## Connected Supabase project
- Project: Sri Cine Hub
- Region: ap-south-1 (Mumbai)
- Public quote requests write to `quote_requests`.
- Staff pages require Supabase Auth.
- Cameras, bookings, customers, payments, evidence, maintenance and investor structures are live.
- Date overlap protection is enforced in Postgres.

## Local setup
1. Copy `.env.example` to `.env.local`.
2. `npm install`
3. `npm run dev`

## First staff/admin login
Create the first user in Supabase Authentication. A profile row is created automatically as `staff`. Promote the trusted owner to `admin` in the `profiles` table before production use.

## Security
Do not add service-role keys to this repository. The included publishable key is intended for browser use and is protected by Row Level Security.
