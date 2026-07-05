// Google Business Profile API helpers
// Uses the My Business API v4 (mybusiness.googleapis.com)
// OAuth scope: https://www.googleapis.com/auth/business.manage

const BASE        = 'https://mybusiness.googleapis.com/v4'
const TOKEN_URL   = 'https://oauth2.googleapis.com/token'
const ACCOUNTS_URL = `${BASE}/accounts`

export interface GBAccount {
  name:        string   // "accounts/123456789"
  accountName: string
  type:        string
}

export interface GBLocation {
  name:         string   // "accounts/123/locations/456"
  locationName: string
}

export interface GBReview {
  reviewId:     string
  reviewer:     { displayName: string }
  starRating:   'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'
  comment?:     string
  createTime:   string
  updateTime:   string
  reviewReply?: { comment: string }
}

export interface TokenResult {
  accessToken: string
  expiresAt:   Date
}

const STAR_MAP: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
}

export function starToInt(star: string): number {
  return STAR_MAP[star] ?? 0
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResult | null> {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) return null
  const data = await res.json() as { access_token: string; expires_in: number }
  return {
    accessToken: data.access_token,
    expiresAt:   new Date(Date.now() + data.expires_in * 1_000),
  }
}

export async function fetchAccounts(accessToken: string): Promise<GBAccount[]> {
  const res = await fetch(ACCOUNTS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return []
  const data = await res.json() as { accounts?: GBAccount[] }
  return data.accounts ?? []
}

export async function fetchLocations(
  accessToken: string,
  accountName: string,   // e.g. "accounts/123456"
): Promise<GBLocation[]> {
  const res = await fetch(`${BASE}/${accountName}/locations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return []
  const data = await res.json() as { locations?: GBLocation[] }
  return data.locations ?? []
}

export async function fetchReviews(
  accessToken:  string,
  accountName:  string,   // "accounts/123456"
  locationName: string,   // "accounts/123456/locations/789"
): Promise<GBReview[]> {
  const res = await fetch(
    `${BASE}/${locationName}/reviews?pageSize=50&orderBy=updateTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) return []
  const data = await res.json() as { reviews?: GBReview[] }
  return data.reviews ?? []
}
