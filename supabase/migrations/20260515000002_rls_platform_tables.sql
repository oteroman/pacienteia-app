-- Enable RLS on platform-level tables that have no tenant policies.
-- These tables are only accessed via createAdminClient() which bypasses RLS.
-- Enabling RLS without policies means the user client returns no rows,
-- preventing accidental data exposure if a user-scoped client is ever used.

ALTER TABLE public.sales_prospects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_crm_notes ENABLE ROW LEVEL SECURITY;
