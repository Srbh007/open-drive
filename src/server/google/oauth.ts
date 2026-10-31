import 'server-only'
import { env } from '@/env'
import { z } from 'zod'

const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  scope: z.string(),
  token_type: z.string(),
  id_token: z.string().optional(),
})

export function getDriveConsentUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: env.AUTH_GOOGLE_ID,
    redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/connect/drive/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive openid email',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeCode(code: string, codeVerifier: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.AUTH_GOOGLE_ID,
      client_secret: env.AUTH_GOOGLE_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/connect/drive/callback`,
      code_verifier: codeVerifier,
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to exchange code: ${res.status} ${errorText}`)
  }

  const data = await res.json()
  return tokenResponseSchema.parse(data)
}

export async function revokeToken(token: string) {
  const res = await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  })
  if (!res.ok) {
    console.warn(`Failed to revoke token: ${res.status}`)
  }
}

export async function getGoogleProfile(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch profile')
  const json = await res.json()
  return z.object({ sub: z.string(), email: z.string() }).parse(json)
}

export async function getDriveAbout(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch drive about')
  const json = await res.json()
  return z.object({
    storageQuota: z.object({
      usage: z.string().optional(),
      limit: z.string().optional(),
    }).optional(),
    user: z.object({
      emailAddress: z.string().optional(),
    }).optional(),
  }).parse(json)
}

export async function getRootFolderId(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/drive/v3/files/root?fields=id", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch root folder')
  const json = await res.json()
  return z.object({ id: z.string() }).parse(json)
}
