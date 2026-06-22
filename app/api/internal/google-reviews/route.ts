import { NextRequest, NextResponse }                              from 'next/server'
import { createAdminClient }                                       from '@/lib/supabase/admin'
import { refreshAccessToken, fetchReviews, starToInt } from '@/lib/google/business'
import { GoogleGenerativeAI }                                      from '@google/generative-ai'

function authorized(req: NextRequest): boolean {
  const key = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('key')
  return key === process.env.CRON_SECRET
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return run()
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return run()
}

async function run() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: connections } = await sb
    .from('google_business_connections')
    .select('*')

  if (!connections?.length) return NextResponse.json({ processed: 0 })

  let totalNew = 0

  for (const conn of connections as Record<string, string>[]) {
    try {
      // Refresh access token if expired or missing
      let accessToken = conn.access_token
      if (!accessToken || new Date(conn.token_expires_at) <= new Date()) {
        const refreshed = await refreshAccessToken(conn.refresh_token)
        if (!refreshed) {
          console.warn('[google-reviews] token refresh failed for org', conn.organization_id)
          continue
        }
        accessToken = refreshed.accessToken
        await sb.from('google_business_connections').update({
          access_token:     accessToken,
          token_expires_at: refreshed.expiresAt.toISOString(),
        }).eq('id', conn.id)
      }

      const accountName  = `accounts/${conn.account_id}`
      const locationName = `accounts/${conn.account_id}/locations/${conn.location_id}`

      const reviews = await fetchReviews(accessToken, accountName, locationName)

      // Only process reviews newer than last fetch
      const since = conn.last_review_at ? new Date(conn.last_review_at) : new Date(0)
      const fresh = reviews.filter(r => new Date(r.createTime) > since)

      if (!fresh.length) continue

      const { data: org } = await sb
        .from('organizations')
        .select('name')
        .eq('id', conn.organization_id)
        .single()
      const clinicName = org?.name ?? 'la clínica'

      for (const review of fresh) {
        const rating = starToInt(review.starRating)

        // Insert review event — UNIQUE constraint prevents double-processing
        const { error: dupErr } = await sb.from('google_review_events').insert({
          organization_id: conn.organization_id,
          review_id:       review.reviewId,
          rating,
          reviewer_name:   review.reviewer.displayName,
          comment:         review.comment ?? null,
          review_time:     review.createTime,
        })
        if (dupErr) continue   // already processed

        totalNew++

        // Create copilot task for negative reviews (≤ 3 stars)
        if (rating <= 3) {
          const suggested = await generateReply(clinicName, rating, review.comment ?? null)

          const stars = '⭐'.repeat(rating)
          const desc  = [
            `${stars} (${rating}/5) — ${review.reviewer.displayName}`,
            review.comment ? `\n\n"${review.comment}"` : '\n\n_(sin comentario)_',
            suggested ? `\n\n---\n💬 *Respuesta sugerida por IA:*\n${suggested}` : '',
          ].join('')

          const { data: task } = await sb.from('copilot_tasks').insert({
            organization_id: conn.organization_id,
            patient_id:      null,
            title:           `Reseña negativa en Google (${rating}★) — ${review.reviewer.displayName}`,
            description:     desc,
            priority:        rating <= 2 ? 'high' : 'medium',
            status:          'open',
            source:          'google_review',
          }).select('id').single()

          if (task?.id) {
            await sb.from('google_review_events')
              .update({ task_id: task.id })
              .eq('organization_id', conn.organization_id)
              .eq('review_id', review.reviewId)
          }
        }
      }

      // Advance the watermark to the most recent review processed
      const latestTime = fresh
        .map(r => r.createTime)
        .sort()
        .at(-1)

      if (latestTime) {
        await sb.from('google_business_connections')
          .update({ last_review_at: latestTime })
          .eq('id', conn.id)
      }
    } catch (err) {
      console.error('[google-reviews] org', conn.organization_id, err)
    }
  }

  return NextResponse.json({ processed: totalNew })
}

async function generateReply(
  clinicName: string,
  rating:     number,
  comment:    string | null,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || !comment) return null

  try {
    const genAI  = new GoogleGenerativeAI(apiKey)
    const model  = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL_NAME ?? 'gemini-2.5-flash' })
    const result = await model.generateContent(`Eres la gerente de ${clinicName}, clínica en Lima, Perú.
Un paciente dejó esta reseña de ${rating} estrella(s) en Google:

"${comment}"

Escribe UNA respuesta pública, profesional y empática. Máximo 3 oraciones.
- Muestra empatía genuina y disculpas por la experiencia
- Invita al paciente a contactarlos en privado para resolver el problema
- Tono cálido, nunca defensivo ni justificativo
- NUNCA menciones diagnósticos ni información médica específica
- Responde SOLO con el texto de la respuesta, sin comillas ni explicaciones adicionales`)
    return result.response.text().trim().replace(/^["']|["']$/g, '')
  } catch {
    return null
  }
}
