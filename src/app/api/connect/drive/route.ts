import { NextResponse } from 'next/server'
import { requireUser } from '@/server/guard'
import { AppError, withRoute } from '@/server/errors'
import { getDriveConsentUrl } from '@/server/google/oauth'
import { randomBytes, createHash } from 'node:crypto'
import { cookies } from 'next/headers'

export const GET = withRoute(async () => {
  const user = await requireUser()
  if (user.role !== 'admin' && user.role !== 'owner') {
    throw new AppError('FORBIDDEN', 'Admin required', 403)
  }

  const state = randomBytes(16).toString('hex')
  const verifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(verifier).digest('base64url')

  const cookieStore = await cookies()
  cookieStore.set('drive_connect_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/' })
  cookieStore.set('drive_connect_verifier', verifier, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/' })

  const url = getDriveConsentUrl(state, codeChallenge)
  return NextResponse.redirect(url)
})
