import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsAppText }  from '@/lib/whatsapp/send'
import { decryptToken }      from '@/lib/crypto/whatsapp-token'

const TRIGGERS = ['sala de espera', 'sala espera', '#espera', 'ya llegue', 'ya llegué', 'llegue', 'llegué']

export function isWaitingRoomTrigger(body: string): boolean {
  const n = body.toLowerCase().trim()
  return TRIGGERS.some(t => n === t || n.startsWith(t + ' '))
}

interface Params {
  organizationId: string
  branchId:       string
  contactPhone:   string
  contactName:    string | null
}

export async function handleWaitingRoomEntry(params: Params): Promise<void> {
  const { organizationId, branchId, contactPhone, contactName } = params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Already in queue — send position update instead of re-adding
  const { data: existing } = await sb
    .from('waiting_queue')
    .select('id')
    .eq('branch_id', branchId)
    .eq('phone', contactPhone)
    .eq('status', 'waiting')
    .maybeSingle()

  if (existing) {
    const { data: queue } = await sb
      .from('waiting_queue')
      .select('id')
      .eq('branch_id', branchId)
      .eq('status', 'waiting')
      .order('entered_at')
    const pos = ((queue ?? []) as { id: string }[]).findIndex(q => q.id === existing.id) + 1
    await sendMsg(sb, organizationId, branchId, contactPhone,
      `Ya estás en la lista de espera 📋\n\n📍 Tu posición actual: *#${pos}*\n\nEn cuanto sea tu turno te avisamos aquí mismo. 🙏`)
    return
  }

  // Look up patient + today's appointment
  const today = new Date().toISOString().slice(0, 10)
  const { data: patient } = await sb
    .from('patients')
    .select('id, full_name')
    .eq('organization_id', organizationId)
    .eq('phone', contactPhone)
    .maybeSingle()

  let treatmentType: string | null = null
  let patientId: string | null     = null
  const name = patient?.full_name ?? contactName ?? 'Paciente'

  if (patient) {
    patientId = patient.id
    const { data: apt } = await sb
      .from('appointments')
      .select('treatment_type')
      .eq('organization_id', organizationId)
      .eq('patient_id', patient.id)
      .gte('scheduled_at', today + 'T00:00:00Z')
      .lte('scheduled_at', today + 'T23:59:59Z')
      .in('status', ['confirmed', 'pending'])
      .order('scheduled_at')
      .limit(1)
      .maybeSingle()
    treatmentType = apt?.treatment_type ?? null
  }

  // Current queue length → assign position
  const { count } = await sb
    .from('waiting_queue')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('status', 'waiting')
  const position = (count ?? 0) + 1

  await sb.from('waiting_queue').insert({
    organization_id: organizationId,
    branch_id:       branchId,
    patient_id:      patientId,
    patient_name:    name,
    phone:           contactPhone,
    treatment_type:  treatmentType,
    position,
    status: 'waiting',
  })

  const waitMin      = position * 15
  const treatmentTip = treatmentType
    ? `\n\n💆 Tu cita es para *${treatmentType}*. Si aplica, asegúrate de haber retirado maquillaje de la zona antes de entrar.`
    : ''

  const msg =
    `¡Hola ${name}! 👋 Ya te registramos en la sala de espera.\n\n` +
    `📍 *Tu posición: #${position}*\n` +
    `⏱️ Tiempo estimado: ~${waitMin} min` +
    treatmentTip +
    `\n\nEn cuanto sea tu turno te avisamos aquí mismo. 🙏`

  await sendMsg(sb, organizationId, branchId, contactPhone, msg)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendMsg(sb: any, orgId: string, branchId: string, phone: string, msg: string) {
  const { data: cfg } = await sb
    .from('branch_whatsapp_config')
    .select('phone_number_id, access_token_enc')
    .eq('organization_id', orgId)
    .eq('branch_id', branchId)
    .eq('status', 'active')
    .maybeSingle()
  if (!cfg) return
  try {
    const token = decryptToken(cfg.access_token_enc)
    await sendWhatsAppText(phone, msg, cfg.phone_number_id, token)
  } catch { /* non-fatal */ }
}
