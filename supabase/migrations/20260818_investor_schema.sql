-- investors table
CREATE TABLE IF NOT EXISTS public.investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  email TEXT,
  profile_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage investors" ON public.investors FOR ALL TO authenticated USING (public.current_user_role() IN ('admin','staff'));
CREATE POLICY "Investor view own" ON public.investors FOR SELECT TO authenticated USING (profile_id = auth.uid());

-- camera_investments table
CREATE TABLE IF NOT EXISTS public.camera_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id UUID NOT NULL REFERENCES public.cameras(id),
  investor_id UUID NOT NULL REFERENCES public.investors(id),
  actual_paid_usd NUMERIC NOT NULL DEFAULT 0,
  actual_paid_inr NUMERIC NOT NULL DEFAULT 0,
  investment_pct NUMERIC NOT NULL DEFAULT 0,
  invested_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(camera_id, investor_id)
);
ALTER TABLE public.camera_investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage investments" ON public.camera_investments FOR ALL TO authenticated USING (public.current_user_role() IN ('admin','staff'));
CREATE POLICY "Investor view own investments" ON public.camera_investments FOR SELECT TO authenticated
  USING (investor_id IN (SELECT id FROM public.investors WHERE profile_id = auth.uid()));

-- Seed investors
INSERT INTO public.investors (investor_code, name, location, notes) VALUES
  ('INV-001', 'Siva',         'SFO',    'Initial camera funding'),
  ('INV-002', 'Sudhan',       'Tampa',  'Initially sent $7000, added $150 last day'),
  ('INV-003', 'JPR',          'Raleigh','Initial camera funding'),
  ('INV-009', 'Ram',          'DOP',    'Verify classification'),
  ('INV-011', 'Sri Cine Hub', NULL,     'Combined Srithar + Sri Cine Hub; same owner'),
  ('INV-013', 'Mani',         NULL,     'Verify classification'),
  ('INV-014', 'Mahesh',       NULL,     'Verify classification')
ON CONFLICT (investor_code) DO NOTHING;

-- Link Sudhan's profile (sudhan.mohan@gmail.com)
UPDATE public.investors
SET profile_id = (SELECT id FROM auth.users WHERE email = 'sudhan.mohan@gmail.com' LIMIT 1)
WHERE investor_code = 'INV-002';

-- Seed camera investments for CAM-001 (ARRI Alexa 35 S35)
INSERT INTO public.camera_investments (camera_id, investor_id, actual_paid_usd, actual_paid_inr, investment_pct)
SELECT
  c.id,
  i.id,
  v.paid_usd,
  v.paid_usd * 96,
  v.pct
FROM public.cameras c
CROSS JOIN (VALUES
  ('INV-001',  7000, 8.3),
  ('INV-002',  7150, 8.5),
  ('INV-003',  7000, 8.3),
  ('INV-009',  9000, 10.7),
  ('INV-011', 42000, 50.0),
  ('INV-013',  8350, 9.9),
  ('INV-014',  3500, 4.2)
) AS v(code, paid_usd, pct)
JOIN public.investors i ON i.investor_code = v.code
WHERE c.camera_code = 'CAM-001'
ON CONFLICT (camera_id, investor_id) DO NOTHING;
