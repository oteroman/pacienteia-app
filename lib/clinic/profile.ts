import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export type BrandTone = 'casual' | 'professional' | 'formal' | 'warm'

export const TONE_LABELS: Record<BrandTone, string> = {
  casual:       'Casual y cercano',
  professional: 'Profesional y claro',
  formal:       'Formal y respetuoso',
  warm:         'Empático y cálido',
}

export const TONE_LLM_HINT: Record<BrandTone, string> = {
  casual:       'usa un tono amigable y cercano, como si fuera un amigo experto',
  professional: 'usa un tono profesional, claro y directo',
  formal:       'usa un tono formal y respetuoso, evita contracciones coloquiales',
  warm:         'usa un tono empático y cálido, muestra genuino interés en el paciente',
}

export interface ClinicProfile {
  clinicId:         string
  brandName:        string | null
  brandTone:        BrandTone
  brandToneNotes:   string | null
  defaultSignature: string | null
  responseOpener:   string | null
  whatsapp:         string | null
  phone:            string | null
  address:          string | null
  businessHours:    string | null
  website:          string | null
  instagramHandle:  string | null
}

type ProfileRow = {
  clinic_id: string; brand_name: string | null; brand_tone: string
  brand_tone_notes: string | null; default_signature: string | null
  response_opener: string | null; whatsapp: string | null; phone: string | null
  address: string | null; business_hours: string | null
  website: string | null; instagram_handle: string | null
}

function toProfile(r: ProfileRow): ClinicProfile {
  return {
    clinicId:         r.clinic_id,
    brandName:        r.brand_name,
    brandTone:        r.brand_tone as BrandTone,
    brandToneNotes:   r.brand_tone_notes,
    defaultSignature: r.default_signature,
    responseOpener:   r.response_opener,
    whatsapp:         r.whatsapp,
    phone:            r.phone,
    address:          r.address,
    businessHours:    r.business_hours,
    website:          r.website,
    instagramHandle:  r.instagram_handle,
  }
}

// ── Fetch ─────────────────────────────────────────────────────
export async function fetchClinicProfile(clinicId: string): Promise<ClinicProfile | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data } = await sb
    .from('clinic_profiles')
    .select('*')
    .eq('clinic_id', clinicId)
    .single()

  return data ? toProfile(data as ProfileRow) : null
}

// ── Upsert ────────────────────────────────────────────────────
export async function upsertClinicProfile(
  clinicId: string,
  fields: Partial<Omit<ClinicProfile, 'clinicId'>>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  await sb.from('clinic_profiles').upsert({
    clinic_id:         clinicId,
    brand_name:        fields.brandName        ?? null,
    brand_tone:        fields.brandTone        ?? 'professional',
    brand_tone_notes:  fields.brandToneNotes   ?? null,
    default_signature: fields.defaultSignature ?? null,
    response_opener:   fields.responseOpener   ?? null,
    whatsapp:          fields.whatsapp         ?? null,
    phone:             fields.phone            ?? null,
    address:           fields.address          ?? null,
    business_hours:    fields.businessHours    ?? null,
    website:           fields.website          ?? null,
    instagram_handle:  fields.instagramHandle  ?? null,
    updated_at:        new Date().toISOString(),
  }, { onConflict: 'clinic_id' })
}

// ── Serializable DTO for client components ────────────────────
// Only the fields needed for auto-fill + draft
export interface ClinicProfileDTO {
  brandName:        string | null
  brandTone:        BrandTone
  brandToneNotes:   string | null
  defaultSignature: string | null
  responseOpener:   string | null
  businessHours:    string | null
  whatsapp:         string | null
  phone:            string | null
}

export function toDTO(p: ClinicProfile): ClinicProfileDTO {
  return {
    brandName:        p.brandName,
    brandTone:        p.brandTone,
    brandToneNotes:   p.brandToneNotes,
    defaultSignature: p.defaultSignature,
    responseOpener:   p.responseOpener,
    businessHours:    p.businessHours,
    whatsapp:         p.whatsapp,
    phone:            p.phone,
  }
}
