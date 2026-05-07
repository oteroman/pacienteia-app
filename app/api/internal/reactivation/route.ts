// GET /api/internal/reactivation?clinic_id=XXX&step=1|2
// Called by n8n cron to get patients to contact.
// Returns step-1 candidates or step-2 pending patients.

import { NextRequest, NextResponse } from 'next/server'
import { getInactivePatients, getPendingStep2Patients } from '@/lib/reactivation/query'

function authorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-webhook-secret')
  return !!process.env.WEBHOOK_SECRET && secret === process.env.WEBHOOK_SECRET
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const clinicId = searchParams.get('clinic_id')
  const step = searchParams.get('step') ?? '1'

  if (!clinicId) {
    return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 })
  }

  if (step === '2') {
    const patientIds = await getPendingStep2Patients(clinicId)
    return NextResponse.json({ patients: patientIds.map((id) => ({ id })), count: patientIds.length })
  }

  const limit = Number(searchParams.get('limit') ?? '50')
  const patients = await getInactivePatients(clinicId, Math.min(limit, 100))
  return NextResponse.json({ patients, count: patients.length })
}
