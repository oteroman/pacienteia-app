import { createAdminClient }         from '@/lib/supabase/admin'
import { sendWhatsAppText }           from '@/lib/whatsapp/send'
import { transcribeAndParseVoice }    from './transcribe'

// Normalize phone: strip +, spaces, dashes → "51987654321"
function normalizePhone(phone: string): string {
  return phone.replace(/[\s+\-()]/g, '')
}

// Check if an incoming WhatsApp phone belongs to a staff member of this org.
export async function isStaffPhone(
  sb: any,
  organizationId: string,
  phone: string,
): Promise<boolean> {
  const normalized = normalizePhone(phone)
  const { data } = await sb
    .from('org_members')
    .select('id')
    .eq('organization_id', organizationId)
    .or(`whatsapp_phone.eq.${normalized},whatsapp_phone.eq.+${normalized}`)
    .maybeSingle()
  return !!data
}

// Main handler — called from the WhatsApp webhook when audio from staff detected.
export async function handleStaffVoiceNote(opts: {
  organizationId: string
  branchId:       string
  staffPhone:     string
  mediaId:        string
}): Promise<void> {
  const { organizationId, branchId, staffPhone, mediaId } = opts
  const sb = createAdminClient() as any

  // ── 1. Transcribe + parse ─────────────────────────────────────────────────
  const task = await transcribeAndParseVoice(mediaId, branchId)

  if (!task) {
    const sb2 = createAdminClient() as any
    await sb2.from('copilot_tasks').insert({
      organization_id: organizationId,
      branch_id:       branchId,
      title:           '🎙️ Nota de voz (no transcrita)',
      description:     `Audio recibido desde ${staffPhone}. No se pudo transcribir automáticamente — procesar manualmente.`,
      priority:        'medium',
      status:          'open',
      source:          'voice_note',
    })
    await sendWhatsAppText({
      branchId,
      to:   staffPhone,
      body: '⚠️ Recibí tu nota de voz pero no pude transcribirla. Se creó una tarea en el copiloto. Alternativa: escribe la instrucción como texto.',
    })
    return
  }

  // ── 2. Find patient by name ───────────────────────────────────────────────
  let patientId:    string | null = null
  let patientPhone: string | null = null
  let patientLabel: string        = task.patientName ?? 'paciente no identificado'
  let ambiguous = false

  if (task.patientName) {
    const { data: patients } = await sb
      .from('patients')
      .select('id, full_name, phone')
      .eq('organization_id', organizationId)
      .ilike('full_name', `%${task.patientName}%`)
      .limit(5)

    if (patients?.length === 1) {
      patientId    = patients[0].id
      patientPhone = patients[0].phone ?? null
      patientLabel = patients[0].full_name
    } else if ((patients?.length ?? 0) > 1) {
      ambiguous = true
      patientLabel = task.patientName
    }
  }

  // ── 3. Create copilot_task ────────────────────────────────────────────────
  const taskTitle = task.patientName
    ? `🎙️ Voz: ${task.patientName}${task.serviceHint ? ` — ${task.serviceHint}` : ''}`
    : '🎙️ Nota de voz del staff'

  const taskDescription = [
    `**Transcripción:** ${task.transcription}`,
    task.dateHint   && `**Fecha mencionada:** ${task.dateHint}${task.timeHint ? ` a las ${task.timeHint}` : ''}`,
    task.serviceHint && `**Servicio:** ${task.serviceHint}`,
    ambiguous        && `⚠️ Se encontraron varios pacientes con el nombre "${task.patientName}" — confirmar cuál es.`,
    !patientId && task.patientName && !ambiguous && `⚠️ No se encontró ningún paciente con el nombre "${task.patientName}".`,
  ].filter(Boolean).join('\n')

  await sb.from('copilot_tasks').insert({
    organization_id: organizationId,
    branch_id:       branchId,
    patient_id:      patientId ?? undefined,
    title:           taskTitle,
    description:     taskDescription,
    priority:        'medium',
    status:          'open',
    source:          'voice_note',
  })

  // ── 4. Send WhatsApp message to patient if requested ─────────────────────
  let messageSent = false
  if (
    task.messageToPatient &&
    patientPhone &&
    (task.action === 'message' || task.action === 'schedule_and_message')
  ) {
    await sendWhatsAppText({
      branchId,
      to:   patientPhone,
      body: task.messageToPatient,
    })
    messageSent = true
  }

  // ── 5. Reply to staff with confirmation ───────────────────────────────────
  const lines: string[] = ['✅ *Nota de voz procesada*\n']

  if (patientId) {
    lines.push(`👤 Paciente: *${patientLabel}*`)
  } else if (ambiguous) {
    lines.push(`⚠️ Nombre ambiguo: "${task.patientName}" — hay varios pacientes. Revisa el copiloto.`)
  } else if (task.patientName) {
    lines.push(`⚠️ No encontré a "${task.patientName}" en el sistema. La tarea fue creada igual.`)
  }

  lines.push(`📋 Tarea creada en el copiloto: _${task.taskNote}_`)

  if (task.dateHint) {
    const scheduleNote = task.action === 'schedule' || task.action === 'schedule_and_message'
      ? `📅 Recordatorio de agendamiento: ${task.dateHint}${task.timeHint ? ` a las ${task.timeHint}` : ''} — confirma en el calendario.`
      : `📅 Fecha mencionada: ${task.dateHint}`
    lines.push(scheduleNote)
  }

  if (messageSent) {
    lines.push(`💬 Mensaje enviado a ${patientLabel} por WhatsApp.`)
  } else if (task.messageToPatient && !patientPhone) {
    lines.push(`⚠️ Tenía que enviar mensaje al paciente pero no tiene teléfono registrado.`)
  }

  await sendWhatsAppText({
    branchId,
    to:   staffPhone,
    body: lines.join('\n'),
  })
}
