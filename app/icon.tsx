import { ImageResponse } from 'next/og'

export const size        = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <svg width="32" height="32" viewBox="0 0 80 80">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4A90E2" />
            <stop offset="100%" stopColor="#8E44AD" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="80" height="80" rx="22" fill="url(#g)" />
        <circle cx="40" cy="22" r="3.6" fill="#fff" />
        <circle cx="28" cy="32" r="3.0" fill="#fff" />
        <circle cx="52" cy="32" r="3.0" fill="#fff" />
        <line x1="40" y1="22" x2="28" y2="32" stroke="#fff" strokeWidth="1.6" strokeOpacity="0.55" strokeLinecap="round" />
        <line x1="40" y1="22" x2="52" y2="32" stroke="#fff" strokeWidth="1.6" strokeOpacity="0.55" strokeLinecap="round" />
        <line x1="28" y1="32" x2="52" y2="32" stroke="#fff" strokeWidth="1.6" strokeOpacity="0.55" strokeLinecap="round" />
        <path d="M 22 50 Q 40 66 58 50" stroke="#fff" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      </svg>
    ),
    { ...size },
  )
}
