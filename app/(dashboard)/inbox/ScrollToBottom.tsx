'use client'

import { useEffect, useRef } from 'react'

// Scrolls its container to the bottom (scrollTop = 0) after each render.
// Works with flex-col-reverse containers where scrollTop=0 = newest messages.
// Only auto-scrolls if the user was already near the bottom (within 120px),
// so reading old messages is not interrupted.
export function ScrollToBottom({ convId }: { convId: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = ref.current?.parentElement
    if (!container) return
    // With flex-col-reverse, scrollTop=0 is the bottom (newest)
    // Only snap if user is already near bottom
    if (container.scrollTop < 120) {
      container.scrollTop = 0
    }
  }, [convId])

  // Invisible marker at the "top" of the DOM (= bottom of visual flex-col-reverse)
  return <div ref={ref} aria-hidden />
}
