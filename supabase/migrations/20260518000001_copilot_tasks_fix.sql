-- Fix copilot_tasks schema:
-- 1. Make interaction_id nullable (auto-tasks from NLU, voice, staff have no interaction)
-- 2. Add source column (used by all automated inserts)

ALTER TABLE public.copilot_tasks
  ALTER COLUMN interaction_id DROP NOT NULL;

ALTER TABLE public.copilot_tasks
  ADD COLUMN IF NOT EXISTS source TEXT;

CREATE INDEX IF NOT EXISTS idx_copilot_tasks_source
  ON public.copilot_tasks(source) WHERE source IS NOT NULL;
