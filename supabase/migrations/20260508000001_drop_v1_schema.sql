-- ══════════════════════════════════════════════════════════════════════════
-- PacienteIA — Drop v1 schema (clean break)
-- Drops all clinic-scoped tables and old helper functions.
-- Safe only on demo/test environments where data loss is acceptable.
-- Migrate to organizations/branches model follows in subsequent migrations.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Drop all tables that directly or indirectly reference clinics.
-- CASCADE handles transitive FK dependencies automatically.
DROP TABLE IF EXISTS public.platform_audit_log       CASCADE;
DROP TABLE IF EXISTS public.slot_openings            CASCADE;
DROP TABLE IF EXISTS public.appointment_rebooking    CASCADE;
DROP TABLE IF EXISTS public.intake_events            CASCADE;
DROP TABLE IF EXISTS public.intakes                  CASCADE;
DROP TABLE IF EXISTS public.clinic_profiles          CASCADE;
DROP TABLE IF EXISTS public.copilot_tasks            CASCADE;
DROP TABLE IF EXISTS public.interaction_summaries    CASCADE;
DROP TABLE IF EXISTS public.interactions             CASCADE;
DROP TABLE IF EXISTS public.clinic_task_audit        CASCADE;
DROP TABLE IF EXISTS public.clinic_tasks             CASCADE;
DROP TABLE IF EXISTS public.gating_events            CASCADE;
DROP TABLE IF EXISTS public.patient_feedback         CASCADE;
DROP TABLE IF EXISTS public.reactivation_campaigns   CASCADE;
DROP TABLE IF EXISTS public.subscription_usage       CASCADE;
DROP TABLE IF EXISTS public.metrics_daily            CASCADE;
DROP TABLE IF EXISTS public.workflow_runs            CASCADE;
DROP TABLE IF EXISTS public.lead_events              CASCADE;
DROP TABLE IF EXISTS public.appointments             CASCADE;
DROP TABLE IF EXISTS public.patients                 CASCADE;
DROP TABLE IF EXISTS public.clinic_members           CASCADE;
DROP TABLE IF EXISTS public.clinics                  CASCADE;

-- Drop old helper functions (replaced by is_org_member / can_access_branch)
DROP FUNCTION IF EXISTS public.is_clinic_member(UUID);
DROP FUNCTION IF EXISTS public.has_clinic_role(UUID, TEXT);

-- Drop the gap_detection function if it references clinics
DROP FUNCTION IF EXISTS public.detect_gaps(UUID)         CASCADE;
DROP FUNCTION IF EXISTS public.detect_gaps(UUID, DATE)   CASCADE;
DROP FUNCTION IF EXISTS public.refresh_gap_candidates()  CASCADE;

-- Drop increment_usage (will be recreated with organization_id in migration 3)
DROP FUNCTION IF EXISTS public.increment_usage(UUID, DATE, TEXT);

COMMIT;
