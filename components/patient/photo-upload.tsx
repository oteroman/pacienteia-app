'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface PhotoUploadProps {
  currentUrl?: string | null
  onUpload: (url: string) => void
}

export function PhotoUpload({ currentUrl, onUpload }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploading(true)

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `uploads/${crypto.randomUUID()}.${ext}`

    const { data, error: uploadError } = await supabase.storage
      .from('patient-photos')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setError('Error al subir imagen')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('patient-photos')
      .getPublicUrl(data.path)

    setPreview(publicUrl)
    onUpload(publicUrl)
    setUploading(false)
  }

  return (
    <div className="flex items-center gap-4">
      <div
        onClick={() => inputRef.current?.click()}
        className="relative w-16 h-16 rounded-full border-2 border-dashed border-gray-300
                   hover:border-brand-400 cursor-pointer overflow-hidden bg-gray-50
                   flex items-center justify-center transition-colors"
      >
        {preview ? (
          <Image src={preview} alt="Foto" fill className="object-cover" />
        ) : (
          <span className="text-2xl text-gray-300">👤</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          disabled={uploading}
        >
          {uploading ? 'Subiendo...' : preview ? 'Cambiar foto' : 'Subir foto'}
        </button>
        <p className="text-xs text-gray-400">JPG, PNG o WebP · máx 5MB</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}
