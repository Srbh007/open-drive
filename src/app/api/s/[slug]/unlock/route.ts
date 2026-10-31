import { NextResponse } from 'next/server'
import { getLinkInfo, verifyPassword } from '@/server/links'
import { unlockLimit } from '@/server/ratelimit'
import { clientIp, setUnlockCookie } from '@/server/link-access'
import { writeAudit } from '@/server/audit'

// Form POST from the /s/[slug] password prompt. Always redirects back to the link page.
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const back = new URL(`/s/${encodeURIComponent(slug)}`, req.url)
  const ip = clientIp(req)

  if (!(await unlockLimit.limit(`${ip}:${slug}`)).success) {
    back.searchParams.set('error', 'rate')
    return NextResponse.redirect(back, 303)
  }

  try {
    const link = await getLinkInfo(slug)
    const form = await req.formData()
    const password = form.get('password')
    if (link.passwordHash && typeof password === 'string' && password.length <= 128 && (await verifyPassword(password, link.passwordHash))) {
      await setUnlockCookie(slug)
      await writeAudit('link.unlock', link.fileId, undefined, slug, ip)
      return NextResponse.redirect(back, 303)
    }
  } catch {
    // Unknown, revoked or expired links fall through to the same generic error.
  }

  back.searchParams.set('error', 'password')
  return NextResponse.redirect(back, 303)
}
