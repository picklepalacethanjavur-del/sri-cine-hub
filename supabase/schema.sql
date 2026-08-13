-- Sri Cine Hub V2 PostgreSQL / Supabase schema
create extension if not exists pgcrypto;

create type public.user_role as enum ('admin','staff','investor');
create type public.asset_status as enum ('available','out','maintenance','retired');
create type public.booking_status as enum ('quote','reserved','confirmed','preparing','checked_out','overdue','returned','closed','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  contact_name text not null,
  phone text not null,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text unique not null,
  category text not null,
  name text not null,
  model text,
  serial_number text,
  status public.asset_status not null default 'available',
  meter_hours numeric(12,1),
  location text default 'Chennai',
  owner_group text,
  purchase_cost numeric(14,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text unique not null,
  customer_id uuid references public.customers(id),
  project_name text not null,
  status public.booking_status not null default 'quote',
  start_at timestamptz not null,
  end_at timestamptz not null,
  location text,
  camera_charge numeric(14,2) not null default 0,
  accessories_charge numeric(14,2) not null default 0,
  other_charge numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  amount_received numeric(14,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_dates_valid check (end_at > start_at)
);

create table public.booking_assets (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  asset_id uuid not null references public.assets(id),
  rate numeric(14,2),
  primary key (booking_id, asset_id)
);

create table public.asset_meter_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id),
  booking_id uuid references public.bookings(id),
  event_type text not null check (event_type in ('checkout','return','audit','service')),
  meter_hours numeric(12,1) not null,
  evidence_path text,
  recorded_by uuid references public.profiles(id),
  recorded_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  amount numeric(14,2) not null check (amount >= 0),
  method text,
  reference text,
  received_at timestamptz not null default now(),
  received_by uuid references public.profiles(id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets(id),
  booking_id uuid references public.bookings(id),
  category text not null,
  amount numeric(14,2) not null check (amount >= 0),
  description text,
  expense_date date not null default current_date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.investors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id),
  display_name text not null,
  active boolean not null default true
);

create table public.asset_ownership (
  asset_id uuid not null references public.assets(id),
  investor_id uuid not null references public.investors(id),
  ownership_percent numeric(7,4) not null check (ownership_percent > 0 and ownership_percent <= 100),
  capital_contributed numeric(14,2) not null default 0,
  primary key(asset_id, investor_id)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- Prevent overlapping active bookings for the same serialized asset.
create or replace function public.assert_asset_available()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1
    from public.booking_assets ba
    join public.bookings b on b.id = ba.booking_id
    join public.bookings incoming on incoming.id = new.booking_id
    where ba.asset_id = new.asset_id
      and ba.booking_id <> new.booking_id
      and b.status not in ('cancelled','returned','closed')
      and tstzrange(b.start_at,b.end_at,'[)') && tstzrange(incoming.start_at,incoming.end_at,'[)')
  ) then
    raise exception 'Asset is already booked for an overlapping rental period';
  end if;
  return new;
end $$;

create trigger booking_asset_availability
before insert or update on public.booking_assets
for each row execute function public.assert_asset_available();

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.assets enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_assets enable row level security;
alter table public.asset_meter_events enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.investors enable row level security;
alter table public.asset_ownership enable row level security;
alter table public.audit_log enable row level security;

-- Policies intentionally kept minimal until staff/investor accounts are created.
