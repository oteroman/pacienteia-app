-- ============================================================
-- PacienteIA — Seed Data (desarrollo y pruebas)
-- ============================================================
-- USUARIOS: NO se crean aquí. Supabase Auth no acepta
-- INSERT directo en auth.users con crypt(). En su lugar:
--
--   node scripts/create-seed-users.mjs
--
-- Ese script usa la Admin API y crea automáticamente:
--   owner@clinicabellaforma.com / Test1234!  (2 clínicas)
--   admin@clinicabellaforma.com / Test1234!  (Bella Forma)
--   staff@clinicabellaforma.com / Test1234!  (Bella Forma)
--
-- Los profiles se crean solos vía trigger on_auth_user_created.
-- Las membresías (clinic_members) las inserta el mismo script.
-- ============================================================

-- ─────────────────────────────────────────
-- CLÍNICAS
-- ─────────────────────────────────────────

INSERT INTO public.clinics (id, name, slug, phone, address, city)
VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Clínica Bella Forma',
    'bella-forma',
    '+51 1 234 5678',
    'Av. Javier Prado Este 1234, San Isidro',
    'Lima'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    'Centro Estético Glow',
    'centro-glow',
    '+51 1 876 5432',
    'Av. La Molina 456, La Molina',
    'Lima'
  )
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────
-- PACIENTES
-- ─────────────────────────────────────────

INSERT INTO public.patients (id, clinic_id, full_name, phone, email, dni, status, last_visit_date, notes, tags)
VALUES
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Ana Gutiérrez Paredes',
    '+51 987 001 001',
    'ana.gutierrez@gmail.com',
    '47812345',
    'active',
    '2026-04-20',
    'Paciente frecuente. Prefiere turno mañana.',
    ARRAY['vip', 'botox', 'recurrente']
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Jorge Villanueva Soto',
    '+51 987 002 002',
    'jorge.v@hotmail.com',
    '41234567',
    'inactive',
    '2025-11-10',
    'Sin visita en más de 5 meses. Candidato para reactivación.',
    ARRAY['inactivo', 'mesoterapia']
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Sofía Mendoza Ríos',
    '+51 987 003 003',
    null,
    '73456789',
    'lead',
    null,
    'Llegó por Instagram. Interesada en relleno de labios.',
    ARRAY['lead', 'redes-sociales']
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000004',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Patricia Lozano Vega',
    '+51 987 004 004',
    'patricia.lozano@gmail.com',
    '68901234',
    'active',
    '2026-04-30',
    null,
    ARRAY['botox', 'peeling']
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000005',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'Roberto Campos Díaz',
    '+51 987 005 005',
    'roberto.campos@gmail.com',
    '52345678',
    'active',
    '2026-04-15',
    'Paciente de Glow. No debe aparecer en Bella Forma.',
    ARRAY['hidratacion']
  )
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────
-- CITAS (appointments)
-- ─────────────────────────────────────────

INSERT INTO public.appointments (id, clinic_id, patient_id, treatment_type, scheduled_at, status, notes, price)
VALUES
  (
    'cccccccc-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000001',
    'Botox frente y entrecejo',
    '2026-05-06 10:00:00+00',
    'confirmed',
    'Segunda sesión. Dosis estándar.',
    350.00
  ),
  (
    'cccccccc-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000004',
    'Peeling químico',
    '2026-05-06 11:30:00+00',
    'scheduled',
    null,
    180.00
  ),
  (
    'cccccccc-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000001',
    'Botox frente',
    '2026-04-10 09:00:00+00',
    'completed',
    'Sin novedades. Próxima cita en 3 meses.',
    300.00
  ),
  (
    'cccccccc-0000-0000-0000-000000000004',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'Mesoterapia capilar',
    '2026-04-22 14:00:00+00',
    'no_show',
    'No se presentó. Sin aviso previo.',
    220.00
  ),
  (
    'cccccccc-0000-0000-0000-000000000005',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000003',
    'Consulta relleno de labios',
    '2026-05-07 15:00:00+00',
    'scheduled',
    'Primera consulta de la lead de Instagram.',
    0.00
  )
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────
-- LEAD EVENTS
-- ─────────────────────────────────────────

INSERT INTO public.lead_events (clinic_id, patient_id, event_type, source, payload, processed)
VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000003',
    'lead.created',
    'instagram',
    '{"message": "Hola, ¿cuánto cuesta el relleno de labios?", "channel": "dm"}'::jsonb,
    true
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'patient.inactive',
    'system',
    '{"days_since_last_visit": 175, "last_treatment": "mesoterapia capilar"}'::jsonb,
    false
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'appointment.upcoming',
    'system',
    '{"appointment_id": "cccccccc-0000-0000-0000-000000000004", "hours_until": 24}'::jsonb,
    true
  )
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────
-- WORKFLOW RUNS (registros de n8n)
-- ─────────────────────────────────────────

INSERT INTO public.workflow_runs (
  clinic_id, event_type, entity_type, entity_id,
  status, payload, result, triggered_at, completed_at
)
VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'lead.created',
    'patient',
    'bbbbbbbb-0000-0000-0000-000000000003',
    'success',
    '{"source": "instagram", "patient_id": "bbbbbbbb-0000-0000-0000-000000000003"}'::jsonb,
    '{"action": "whatsapp_sent", "message_id": "wamid.abc123"}'::jsonb,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days' + INTERVAL '4 seconds'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'appointment.upcoming',
    'appointment',
    'cccccccc-0000-0000-0000-000000000004',
    'success',
    '{"appointment_id": "cccccccc-0000-0000-0000-000000000004", "hours_until": 24}'::jsonb,
    '{"action": "reminder_sent", "channel": "whatsapp"}'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day' + INTERVAL '2 seconds'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'patient.inactive',
    'patient',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'failed',
    '{"patient_id": "bbbbbbbb-0000-0000-0000-000000000002"}'::jsonb,
    null,
    NOW() - INTERVAL '3 hours',
    null
  )
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────
-- MÉTRICAS DIARIAS
-- ─────────────────────────────────────────

INSERT INTO public.metrics_daily (
  clinic_id, date,
  appointments_scheduled, appointments_confirmed, appointments_completed,
  appointments_cancelled, appointments_no_show,
  new_patients, reactivated_patients, leads_captured,
  estimated_revenue_recovered
)
VALUES
  -- clinic_id, date, scheduled, confirmed, completed, cancelled, no_show, new_patients, reactivated, leads, revenue
  ('aaaaaaaa-0000-0000-0000-000000000001', '2026-05-01', 4, 3, 3, 0, 1, 1, 0, 2, 220.00),
  ('aaaaaaaa-0000-0000-0000-000000000001', '2026-05-02', 5, 4, 4, 1, 0, 0, 0, 1, 0.00),
  ('aaaaaaaa-0000-0000-0000-000000000001', '2026-05-03', 3, 3, 2, 0, 1, 0, 1, 0, 220.00),
  ('aaaaaaaa-0000-0000-0000-000000000001', '2026-05-04', 6, 5, 5, 0, 0, 2, 1, 3, 0.00),
  ('aaaaaaaa-0000-0000-0000-000000000001', '2026-05-05', 2, 1, 0, 0, 0, 0, 0, 1, 0.00),
  ('aaaaaaaa-0000-0000-0000-000000000002', '2026-05-05', 3, 2, 0, 0, 0, 1, 0, 0, 0.00)
ON CONFLICT (clinic_id, date) DO NOTHING;
