import { NextResponse } from 'next/server'
import { requireUser } from '@/server/guard'
import { exchangeCode, getGoogleProfile, getDriveAbout, getRootFolderId } from '@/server/google/oauth'
import { encrypt } from '@/server/crypto'
import { db } from '@/server/db'
import { driveAccounts, syncState } from '@/server/db/schema'
import { cookies } from 'next/headers'
import { log } from '@/server/log'

const DRIVE_COLORS = ['#EF4444', '#F59E0B', '#84CC16', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899']

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) return NextResponse.redirect(new URL('/settings', req.url))
  if (!code || !state) return NextResponse.redirect(new URL('/settings?drive_error=1', req.url))

  const user = await requireUser()
  if (user.role !== 'admin' && user.role !== 'owner') {
    log.error('Forbidden access attempt in drive connection callback')
    return NextResponse.redirect(new URL('/settings?drive_error=1', req.url))
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('drive_connect_state')?.value
  const verifier = cookieStore.get('drive_connect_verifier')?.value

  if (!savedState || !verifier || state !== savedState) {
    log.error('State mismatch in drive connection callback')
    return NextResponse.redirect(new URL('/settings?drive_error=1', req.url))
  }

  cookieStore.delete('drive_connect_state')
  cookieStore.delete('drive_connect_verifier')

  try {
    const tokens = await exchangeCode(code, verifier)
    if (!tokens.refresh_token) {
      log.error('No refresh token received during drive connection callback')
      return NextResponse.redirect(new URL('/settings?drive_error=1', req.url))
    }

    const profile = await getGoogleProfile(tokens.access_token)
    const about = await getDriveAbout(tokens.access_token)
    const root = await getRootFolderId(tokens.access_token)

    const allDrives = await db.select({ id: driveAccounts.id }).from(driveAccounts)
    const color = DRIVE_COLORS[allDrives.length % DRIVE_COLORS.length]

    const quotaUsed = parseInt(about.storageQuota?.usage || '0', 10)
    const quotaTotal = about.storageQuota?.limit ? parseInt(about.storageQuota.limit, 10) : null

    const [account] = await db.insert(driveAccounts).values({
      googleSub: profile.sub,
      email: profile.email,
      label: profile.email,
      color,
      rootFolderId: root.id,
      refreshTokenEnc: encrypt(tokens.refresh_token),
      quotaUsed,
      quotaTotal,
      status: 'active',
      createdBy: user.id,
    }).onConflictDoUpdate({
      target: driveAccounts.googleSub,
      set: {
        refreshTokenEnc: encrypt(tokens.refresh_token),
        email: profile.email,
        quotaUsed,
        quotaTotal,
        status: 'active',
        rootFolderId: root.id,
      }
    }).returning()

    await db.insert(syncState).values({
      driveAccountId: account.id,
      status: 'initial',
    }).onConflictDoUpdate({
      target: syncState.driveAccountId,
      set: { status: 'initial', error: null, scanPageToken: null, pageToken: null }
    })

    return NextResponse.redirect(new URL('/settings', req.url))
  } catch (err) {
    log.error('Failed to exchange code and save drive', { error: (err as Error).message })
    return NextResponse.redirect(new URL('/settings?drive_error=1', req.url))
  }
}
