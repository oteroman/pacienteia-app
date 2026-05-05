-- ============================================================
-- PacienteIA — Patient photo_url column + Storage bucket
-- ============================================================

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Storage bucket for patient photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-photos',
  'patient-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authenticated can upload patient photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-photos');

CREATE POLICY "public can view patient photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'patient-photos');

CREATE POLICY "authenticated can delete patient photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'patient-photos');
