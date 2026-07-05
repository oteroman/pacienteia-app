import { createAdminClient } from '@/lib/supabase/admin'
import { sendSalesWhatsApp }  from './sales-send'

type FlowStep =
  | 'awaiting_name'
  | 'awaiting_clinic'
  | 'awaiting_size'
  | 'awaiting_pain'
  | 'awaiting_demo_interest'
  | 'awaiting_email'
  | 'closed'

interface Prospect {
  id:           string
  phone:        string
  contact_name: string | null
  clinic_name:  string | null
  monthly_apts: string | null
  pain_point:   string | null
  email:        string | null
  status:       string
  flow_step:    FlowStep
}

const SIZE_LABELS: Record<string, string> = {
  '1': 'Menos de 50 citas/mes',
  '2': '50–200 citas/mes',
  '3': '200–500 citas/mes',
  '4': 'Más de 500 citas/mes',
}

const PAIN_LABELS: Record<string, string> = {
  '1': 'Muchos no-shows',
  '2': 'Mucho tiempo en WhatsApp manual',
  '3': 'Muchos slots vacíos por cancelaciones',
  '4': 'Pacientes que dejan de volver',
}

function buildPitch(painKey: string, clinicName: string | null): string {
  const clinic = clinicName ?? 'tu clínica'
  const pitches: Record<string, string> = {
    '1':
      `💡 El principal problema de *${clinic}* son los no-shows. PacienteIA lo resuelve así:\n\n` +
      `✅ *Recordatorios automáticos* por WhatsApp 24h y 2h antes de cada cita, con confirmación de un clic.\n` +
      `✅ Las clínicas que lo usan reducen sus no-shows hasta un *40%* en el primer mes.\n\n` +
      `¿Te gustaría una demo gratuita? Responde *Sí* para coordinar 📅`,
    '2':
      `💡 Entiendo — mucho tiempo en WhatsApp manual frena el crecimiento. PacienteIA lo resuelve así:\n\n` +
      `✅ *Automatiza el 80%* de los mensajes: confirmaciones, recordatorios, encuestas post-cita.\n` +
      `✅ Los pacientes pueden agendar directamente por WhatsApp, *sin intervención del staff*.\n\n` +
      `¿Te gustaría una demo gratuita? Responde *Sí* para coordinar 📅`,
    '3':
      `💡 Los slots vacíos son ingresos perdidos. PacienteIA los recupera así:\n\n` +
      `✅ *Backfill inteligente* — cuando se cancela una cita, el sistema detecta el hueco y automáticamente les escribe a los pacientes candidatos: "¿Te interesa el slot de hoy a las 3pm?"\n` +
      `✅ Sin staff adicional, sin llamadas.\n\n` +
      `¿Te gustaría una demo gratuita? Responde *Sí* para coordinar 📅`,
    '4':
      `💡 Los pacientes que no vuelven son el churn silencioso. PacienteIA lo detecta y lo revierte:\n\n` +
      `✅ *Score de retención* por paciente — predice quién está en riesgo *antes* de que se vaya.\n` +
      `✅ *Campaña de reactivación automática* — WhatsApp personalizado a pacientes inactivos 60+ días.\n\n` +
      `¿Te gustaría una demo gratuita? Responde *Sí* para coordinar 📅`,
  }
  return (
    pitches[painKey] ??
    `PacienteIA automatiza la gestión de citas y comunicación WhatsApp. ¿Te gustaría una demo gratuita? Responde *Sí* 📅`
  )
}

function isPositive(text: string): boolean {
  return /\b(si|sí|dale|ok|okay|claro|me interesa|quiero|adelante|genial|perfecto|bueno|yes|yep|por supuesto|obvio|claro que sí|claro que si)\b/i.test(
    text,
  )
}

function looksLikeEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveInbound(sb: any, prospectId: string, body: string) {
  await sb.from('sales_messages').insert({ prospect_id: prospectId, direction: 'inbound', body })
}

export async function handleSalesBotMessage(
  phone: string,
  body: string,
  sendFn: (to: string, msg: string, prospectId?: string) => Promise<void> = sendSalesWhatsApp,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: existing } = await sb
    .from('sales_prospects')
    .select('id, phone, contact_name, clinic_name, monthly_apts, pain_point, email, status, flow_step')
    .eq('phone', phone)
    .single() as { data: Prospect | null }

  if (!existing) {
    // First contact — upsert to avoid race condition on duplicate webhooks
    const { data: created } = await sb.from('sales_prospects').upsert(
      { phone, flow_step: 'awaiting_name', status: 'new' },
      { onConflict: 'phone', ignoreDuplicates: true },
    ).select('id').single()

    const prospectId = created?.id
    if (prospectId) await saveInbound(sb, prospectId, body)

    const msg =
      `¡Hola! 👋 Soy *Paxi*, el asistente virtual de *PacienteIA*.\n\n` +
      `Ayudamos a clínicas en Lima a automatizar su gestión de citas y WhatsApp. 🏥\n\n` +
      `Para empezar, ¿cuál es tu nombre?`

    await sendFn(phone, msg, prospectId)
    return
  }

  const p = existing

  // Save inbound message
  await saveInbound(sb, p.id, body)

  // Silently ignore messages after flow ends
  if (p.flow_step === 'closed' || p.status === 'disqualified') return

  if (p.flow_step === 'awaiting_name') {
    const name = body.trim().split(/\s+/).slice(0, 3).join(' ')
    await sb.from('sales_prospects').update({ contact_name: name, flow_step: 'awaiting_clinic' }).eq('id', p.id)
    await sendFn(phone, `¡Mucho gusto, *${name}*! 😊\n\n¿Cuál es el nombre de tu clínica o consultorio?`, p.id)
    return
  }

  if (p.flow_step === 'awaiting_clinic') {
    const clinic = body.trim()
    await sb.from('sales_prospects').update({ clinic_name: clinic, flow_step: 'awaiting_size' }).eq('id', p.id)
    await sendFn(
      phone,
      `Perfecto, *${clinic}*. 📋\n\n¿Cuántas citas manejan aproximadamente al mes?\n\n` +
      `1️⃣ Menos de 50\n2️⃣ 50 – 200\n3️⃣ 200 – 500\n4️⃣ Más de 500\n\nResponde con el número.`,
      p.id,
    )
    return
  }

  if (p.flow_step === 'awaiting_size') {
    const key   = body.trim()
    const label = SIZE_LABELS[key]
    if (!label) {
      await sendFn(phone, `Por favor responde con el número *1*, *2*, *3* o *4*. 😊`, p.id)
      return
    }
    await sb.from('sales_prospects').update({ monthly_apts: label, flow_step: 'awaiting_pain' }).eq('id', p.id)
    await sendFn(
      phone,
      `¿Cuál es el mayor dolor operativo de *${p.clinic_name ?? 'tu clínica'}* hoy?\n\n` +
      `1️⃣ Muchos pacientes no vienen (no-shows)\n` +
      `2️⃣ Mucho tiempo respondiendo WhatsApp manualmente\n` +
      `3️⃣ Muchos slots vacíos por cancelaciones\n` +
      `4️⃣ Pacientes que dejan de volver\n\nResponde con el número.`,
      p.id,
    )
    return
  }

  if (p.flow_step === 'awaiting_pain') {
    const key   = body.trim()
    const label = PAIN_LABELS[key]
    if (!label) {
      await sendFn(phone, `Por favor responde con el número *1*, *2*, *3* o *4*. 😊`, p.id)
      return
    }
    await sb
      .from('sales_prospects')
      .update({ pain_point: label, flow_step: 'awaiting_demo_interest', status: 'qualifying' })
      .eq('id', p.id)
    await sendFn(phone, buildPitch(key, p.clinic_name), p.id)
    return
  }

  if (p.flow_step === 'awaiting_demo_interest') {
    if (isPositive(body)) {
      await sb.from('sales_prospects').update({ flow_step: 'awaiting_email' }).eq('id', p.id)
      await sendFn(
        phone,
        `¡Excelente! 🎉\n\n¿A qué correo electrónico te mandamos el acceso de prueba y los detalles de la demo?`,
        p.id,
      )
    } else {
      await sb.from('sales_prospects').update({ flow_step: 'closed', status: 'disqualified' }).eq('id', p.id)
      await sendFn(
        phone,
        `Sin problema, ${p.contact_name ?? ''}! 😊\n\nSi en algún momento quieres conocer más, escríbenos aquí.\n\n¡Mucho éxito con *${p.clinic_name ?? 'tu clínica'}*! 🏥`,
        p.id,
      )
    }
    return
  }

  if (p.flow_step === 'awaiting_email') {
    const email = body.trim().toLowerCase()
    if (!looksLikeEmail(email)) {
      await sendFn(phone, `Por favor envíame tu correo electrónico (ej: nombre@clinica.com). 📧`, p.id)
      return
    }
    await sb
      .from('sales_prospects')
      .update({ email, status: 'demo_requested', flow_step: 'closed' })
      .eq('id', p.id)
    await sendFn(
      phone,
      `¡Perfecto, ${p.contact_name ?? ''}! ✅\n\n` +
      `Te enviamos los detalles de la demo a *${email}* en las próximas horas.\n\n` +
      `Mientras tanto puedes ver cómo funciona en *pacienteia.com* 🌐\n\n` +
      `¡El equipo se pondrá en contacto contigo pronto! 🙌`,
      p.id,
    )
    return
  }
}
