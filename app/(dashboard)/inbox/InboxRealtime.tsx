'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const POLL_INTERVAL_MS = 15_000

interface Props {
  organizationId: string
}

export function InboxRealtime({ organizationId }: Props) {
  const router   = useRouter()
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const poll     = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => router.refresh(), 600)
  }, [router])

  useEffect(() => {
    // Polling fallback — guarantees freshness even if Realtime is not enabled
    poll.current = setInterval(refresh, POLL_INTERVAL_MS)

    // Supabase Realtime — fires immediately when DB changes (requires tables
    // enabled in Supabase dashboard → Database → Replication)
    const sb = createClient()
    const channel = sb
      .channel(`inbox-realtime-${organizationId}`)
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'conversations', filter: `organization_id=eq.${organizationId}` }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',      filter: `organization_id=eq.${organizationId}` }, refresh)
      .subscribe()

    return () => {
      if (debounce.current) clearTimeout(debounce.current)
      if (poll.current)     clearInterval(poll.current)
      sb.removeChannel(channel)
    }
  }, [organizationId, refresh])

  return null
}
