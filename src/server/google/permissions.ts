import 'server-only'
import { getAccessToken } from '@/server/google/tokens'

export async function addGoogleEditPermission(driveAccountId: string, providerFileId: string, email: string): Promise<void> {
  const token = await getAccessToken(driveAccountId)

  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(providerFileId)}/permissions?supportsAllDrives=true&fields=permissions(id,emailAddress,role,type)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  if (!listRes.ok) {
    throw new Error(`Failed to fetch permissions: ${listRes.status}`)
  }

  const { permissions } = await listRes.json()
  const existing = permissions?.find(
    (p: { type: string, emailAddress: string, role: string }) => p.type === 'user' && p.emailAddress === email && (p.role === 'writer' || p.role === 'owner')
  )

  if (existing) {
    return
  }

  const addRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(providerFileId)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'user',
        role: 'writer',
        emailAddress: email,
      }),
    }
  )

  if (!addRes.ok) {
    throw new Error(`Failed to add edit permission: ${addRes.status}`)
  }
}
