'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { addPatientPhoto, deletePatientPhoto } from '@/app/actions/patients'

type Photo = {
  id: string
  photo_url: string
  type: 'before' | 'after' | 'general'
  label: string | null
  taken_at: string
}

interface PatientPhotosProps {
  patientId: string
  initialPhotos: Photo[]
}

const TYPE_LABELS = { before: 'Antes', after: 'Después', general: 'General' }
const TYPE_COLORS = {
  before:  'bg-orange-100 text-orange-700',
  after:   'bg-lima-100 text-lima-700',
  general: 'bg-[#F3F6F9] text-slate',
}

export function PatientPhotos({ patientId, initialPhotos }: PatientPhotosProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadType, setUploadType] = useState<'before' | 'after' | 'general'>('before')
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploading(uploadType)

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `clinic-photos/${crypto.randomUUID()}.${ext}`

    const { data, error: uploadError } = await supabase.storage
      .from('patient-photos')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setError('Error al subir imagen')
      setUploading(null)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('patient-photos').getPublicUrl(data.path)

    const result = await addPatientPhoto(patientId, publicUrl, uploadType)
    if (result.error) {
      setError(result.error)
      setUploading(null)
      return
    }

    setPhotos(prev => [...prev, {
      id:       crypto.randomUUID(),
      photo_url: publicUrl,
      type:     uploadType,
      label:    null,
      taken_at: new Date().toISOString(),
    }])
    setUploading(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDelete(photoId: string) {
    startTransition(async () => {
      await deletePatientPhoto(photoId, patientId)
      setPhotos(prev => prev.filter(p => p.id !== photoId))
    })
  }

  const grouped = {
    before:  photos.filter(p => p.type === 'before'),
    after:   photos.filter(p => p.type === 'after'),
    general: photos.filter(p => p.type === 'general'),
  }

  return (
    <div className="space-y-4">
      {/* Upload bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg border border-fog overflow-hidden text-xs">
          {(['before', 'after', 'general'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setUploadType(t)}
              className={`px-3 py-1.5 transition-colors ${uploadType === t ? 'bg-brand-600 text-white' : 'bg-white text-slate hover:bg-mist'}`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!!uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-300 text-brand-700 text-xs font-medium hover:bg-brand-50 transition-colors disabled:opacity-50"
        >
          {uploading ? 'Subiendo...' : '+ Subir foto'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleUpload}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {/* Gallery grouped by type */}
      {photos.length === 0 ? (
        <p className="text-xs text-slate py-2">Sin fotos todavía. Sube fotos de antes/después del tratamiento.</p>
      ) : (
        <div className="space-y-4">
          {(['before', 'after', 'general'] as const).map(t => grouped[t].length > 0 && (
            <div key={t}>
              <p className="text-[11px] font-semibold text-slate uppercase tracking-widest mb-2">{TYPE_LABELS[t]}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {grouped[t].map(photo => (
                  <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden bg-mist">
                    <Image
                      src={photo.photo_url}
                      alt={TYPE_LABELS[photo.type]}
                      fill
                      className="object-cover cursor-pointer"
                      onClick={() => setExpanded(photo.photo_url)}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-end p-1.5 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleDelete(photo.id)}
                        disabled={isPending}
                        className="bg-white/90 text-red-600 rounded-lg px-2 py-1 text-[10px] font-medium hover:bg-white"
                      >
                        Borrar
                      </button>
                    </div>
                    <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${TYPE_COLORS[t]}`}>
                      {TYPE_LABELS[t]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpanded(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] w-full h-full">
            <Image src={expanded} alt="Foto ampliada" fill className="object-contain" />
          </div>
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-2xl font-bold hover:text-fog"
            onClick={() => setExpanded(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
