-- ══════════════════════════════════════════════════════════════════════════
-- PacienteIA — Operational tables v2
-- Intakes, copilot, rebooking, slot openings, clinic tasks.
-- All scoped to organization_id (tenant) + branch_id (operational context).
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Intakes (unified omnichannel) ───────────────────────────────────────
-- branch_id identifies which WhatsApp number / channel received the message.
-- Routing in n8n: phone_number_id → branch → organization → industry.
CREATE TABLE public.intakes (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id          UUID        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  source_channel     TEXT        NOT NULL
                                 CHECK (source_channel IN ('whatsapp','instagram','facebook','call','webform','manual')),
  external_id        TEXT,
  contact_name       TEXT,
  contact_phone      TEXT,
  contact_email      TEXT,
  raw_content        TEXT        NOT NULL,
  normalized_summary TEXT,
  detected_intent    TEXT
                                 CHECK (detected_intent IN ('lead_inquiry','appointment_request','followup','urgent','general')),
  priority           TEXT        NOT NULL DEFAULT 'medium'
                                 CHECK (priority IN ('high','medium','low')),
  status             TEXT        NOT NULL DEFAULT 'new'
                                 CHECK (status IN ('new','in_progress','resolved','dismissed')),
  assigned_to        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_id         UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  metadata           JSONB       NOT NULL DEFAULT '{}',
  tasks_created      INT         NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at        TIMESTAMPTZ
);

CREATE INDEX idx_intakes_org_status  ON public.intakes(organization_id, status, created_at DESC);
CREATE INDEX idx_intakes_branch      ON public.intakes(branch_id, status, created_at DESC);
CREATE INDEX idx_intakes_patient     ON public.intakes(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX idx_intakes_channel     ON public.intakes(organization_id, source_channel);

CREATE TRIGGER set_intakes_updated_at
  BEFORE UPDATE ON public.intakes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Intake Events (audit trail) ─────────────────────────────────────────
CREATE TABLE public.intake_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id       UUID        NOT NULL REFERENCES public.intakes(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL,
  actor           TEXT        NOT NULL DEFAULT 'system',
  details         JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intake_events_intake ON public.intake_events(intake_id, created_at DESC);
CREATE INDEX idx_intake_events_org    ON public.intake_events(organization_id, created_at DESC);

-- ─── Interactions (copilot input) ────────────────────────────────────────
CREATE TABLE public.interactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        REFERENCES public.branches(id),
  source_type     TEXT        NOT NULL
                              CHECK (source_type IN ('whatsapp_text','whatsapp_audio','phone_call','staff_note','chat')),
  raw_content     TEXT        NOT NULL,
  patient_id      UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  submitted_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','processing','done','failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interactions_org    ON public.interactions(organization_id, created_at DESC);
CREATE INDEX idx_interactions_status ON public.interactions(organization_id, status);
CREATE INDEX idx_interactions_patient ON public.interactions(patient_id) WHERE patient_id IS NOT NULL;

CREATE TRIGGER set_interactions_updated_at
  BEFORE UPDATE ON public.interactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Interaction Summaries ────────────────────────────────────────────────
CREATE TABLE public.interaction_summaries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id  UUID        NOT NULL REFERENCES public.interactions(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  summary         TEXT        NOT NULL,
  commitments     JSONB       NOT NULL DEFAULT '[]',
  risks           JSONB       NOT NULL DEFAULT '[]',
  tasks_created   INT         NOT NULL DEFAULT 0,
  model_used      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (interaction_id)
);

CREATE INDEX idx_summaries_org ON public.interaction_summaries(organization_id, created_at DESC);

-- ─── Copilot Tasks ────────────────────────────────────────────────────────
CREATE TABLE public.copilot_tasks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id  UUID        NOT NULL REFERENCES public.interactions(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        REFERENCES public.branches(id),
  patient_id      UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  priority        TEXT        NOT NULL DEFAULT 'medium'
                              CHECK (priority IN ('high','medium','low')),
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','done','dismissed')),
  due_at          TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_copilot_tasks_org    ON public.copilot_tasks(organization_id, status, created_at DESC);
CREATE INDEX idx_copilot_tasks_branch ON public.copilot_tasks(branch_id, status) WHERE branch_id IS NOT NULL;

CREATE TRIGGER set_copilot_tasks_updated_at
  BEFORE UPDATE ON public.copilot_tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Appointment Rebooking ────────────────────────────────────────────────
CREATE TABLE public.appointment_rebooking (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id          UUID        NOT NULL REFERENCES public.branches(id),
  appointment_id     UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id         UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  trigger_type       TEXT        NOT NULL
                                 CHECK (trigger_type IN ('cancelled','no_show','no_response','reschedule_request')),
  previous_status    TEXT        NOT NULL,
  rebook_reason      TEXT,
  channel            TEXT        NOT NULL DEFAULT 'task'
                                 CHECK (channel IN ('whatsapp','task','internal')),
  outcome            TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (outcome IN ('pending','rebooked','lost','escalated','no_response')),
  staff_task_id      UUID        REFERENCES public.copilot_tasks(id) ON DELETE SET NULL,
  new_appointment_id UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  whatsapp_message   TEXT,
  patient_response   TEXT,
  notes              TEXT,
  resolved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rebooking_org    ON public.appointment_rebooking(organization_id, created_at DESC);
CREATE INDEX idx_rebooking_branch ON public.appointment_rebooking(branch_id, outcome);
CREATE INDEX idx_rebooking_appt   ON public.appointment_rebooking(appointment_id);

CREATE TRIGGER set_rebooking_updated_at
  BEFORE UPDATE ON public.appointment_rebooking
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Slot Openings ────────────────────────────────────────────────────────
CREATE TABLE public.slot_openings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id           UUID        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  appointment_id      UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  treatment_type      TEXT        NOT NULL,
  slot_start          TIMESTAMPTZ NOT NULL,
  slot_end            TIMESTAMPTZ,
  reason_opened       TEXT        NOT NULL
                                  CHECK (reason_opened IN ('cancellation','no_show','reschedule','manual')),
  status              TEXT        NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open','filled','expired')),
  candidates          JSONB       NOT NULL DEFAULT '[]',
  candidate_count     INT         NOT NULL DEFAULT 0,
  selected_patient_id UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  new_appointment_id  UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  fill_attempts       INT         NOT NULL DEFAULT 0,
  staff_task_id       UUID        REFERENCES public.copilot_tasks(id) ON DELETE SET NULL,
  filled_at           TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_slot_openings_org    ON public.slot_openings(organization_id, status, slot_start);
CREATE INDEX idx_slot_openings_branch ON public.slot_openings(branch_id, status, slot_start);

CREATE TRIGGER set_slot_openings_updated_at
  BEFORE UPDATE ON public.slot_openings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── CS Clinic Tasks (platform-internal, service role only) ─────────────
CREATE TABLE public.org_tasks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trigger_type     TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open','done','snoozed')),
  priority         TEXT        NOT NULL DEFAULT 'medium'
                               CHECK (priority IN ('high','medium','low')),
  title            TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  action_text      TEXT        NOT NULL,
  message_template TEXT,
  health_score     INT,
  escalated_at     TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  last_note        TEXT,
  snoozed_until    TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX org_tasks_open_uniq ON public.org_tasks(organization_id, trigger_type)
  WHERE status = 'open';
CREATE INDEX idx_org_tasks_status ON public.org_tasks(status, created_at DESC);
CREATE INDEX idx_org_tasks_org    ON public.org_tasks(organization_id, status);

CREATE TRIGGER set_org_tasks_updated_at
  BEFORE UPDATE ON public.org_tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.org_task_audit (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID        NOT NULL REFERENCES public.org_tasks(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL,
  action_type     TEXT        NOT NULL,
  prev_status     TEXT,
  new_status      TEXT,
  prev_priority   TEXT,
  new_priority    TEXT,
  actor           TEXT        NOT NULL DEFAULT 'system',
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_task_audit_task ON public.org_task_audit(task_id, created_at DESC);

-- ─── RLS — Operational tables ─────────────────────────────────────────────
ALTER TABLE public.intakes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interaction_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_rebooking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_openings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_task_audit       ENABLE ROW LEVEL SECURITY;

-- intakes: branch-scoped
CREATE POLICY "intakes: branch select"
  ON public.intakes FOR SELECT
  USING (can_access_branch(organization_id, branch_id));
CREATE POLICY "intakes: branch insert"
  ON public.intakes FOR INSERT
  WITH CHECK (can_access_branch(organization_id, branch_id));
CREATE POLICY "intakes: branch update"
  ON public.intakes FOR UPDATE
  USING (can_access_branch(organization_id, branch_id));

-- intake_events: org-scoped
CREATE POLICY "intake_events: org select"
  ON public.intake_events FOR SELECT
  USING (is_org_member(organization_id));

-- interactions: org-scoped
CREATE POLICY "interactions: org select"
  ON public.interactions FOR SELECT
  USING (is_org_member(organization_id));
CREATE POLICY "interactions: org insert"
  ON public.interactions FOR INSERT
  WITH CHECK (is_org_member(organization_id));

-- interaction_summaries: org-scoped
CREATE POLICY "summaries: org select"
  ON public.interaction_summaries FOR SELECT
  USING (is_org_member(organization_id));

-- copilot_tasks: org-scoped
CREATE POLICY "copilot_tasks: org select"
  ON public.copilot_tasks FOR SELECT
  USING (is_org_member(organization_id));
CREATE POLICY "copilot_tasks: org update"
  ON public.copilot_tasks FOR UPDATE
  USING (is_org_member(organization_id));

-- appointment_rebooking: branch-scoped
CREATE POLICY "rebooking: branch select"
  ON public.appointment_rebooking FOR SELECT
  USING (can_access_branch(organization_id, branch_id));

-- slot_openings: branch-scoped
CREATE POLICY "slot_openings: branch select"
  ON public.slot_openings FOR SELECT
  USING (can_access_branch(organization_id, branch_id));

-- org_tasks + audit: service role only (deny all for session clients)
-- Platform health dashboard reads these via createAdminClient()

COMMIT;
