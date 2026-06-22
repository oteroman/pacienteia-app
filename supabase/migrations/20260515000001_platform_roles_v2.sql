-- Platform Roles v2: add 'sales' role, prospect assignment, acquisition rep tracking

-- 1. Extend platform_role check constraint to include 'sales'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_platform_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_platform_role_check
  CHECK (platform_role IN ('superadmin', 'support', 'sales'));

-- 2. Commission rate for sales reps
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0;

-- 3. Assigned sales rep on each prospect (Paxi leads)
ALTER TABLE public.sales_prospects
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Which sales rep acquired this organization
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS acquisition_rep_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 5. Index for fast rep-filtered queries
CREATE INDEX IF NOT EXISTS idx_sales_prospects_assigned_to ON public.sales_prospects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_organizations_acquisition_rep ON public.organizations(acquisition_rep_id);
