import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { eq, sql } from "drizzle-orm"
import { Download, Lock } from "lucide-react"
import { db } from "@/server/db"
import { links } from "@/server/db/schema"
import { AppError } from "@/server/errors"
import { getLinkTarget } from "@/server/links"
import { linkPageLimit } from "@/server/ratelimit"
import { hasUnlockedLink } from "@/server/link-access"
import { writeAudit } from "@/server/audit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LinkUploadBox } from "@/components/upload/LinkUploadBox"
import { formatBytes } from "@/lib/format"

export const dynamic = "force-dynamic"

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">{children}</div>
    </div>
  )
}

export default async function PublicLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { slug } = await params
  const { error } = await searchParams
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown"

  if (!(await linkPageLimit.limit(ip)).success) {
    return <Shell><p className="text-text-muted">Too many requests. Please try again in a minute.</p></Shell>
  }

  let target
  try {
    target = await getLinkTarget(slug)
  } catch (err) {
    if (err instanceof AppError && err.status === 410) {
      return <Shell><p className="text-text-muted">This link is no longer available.</p></Shell>
    }
    notFound()
  }
  const { link, file } = target

  if (link.passwordHash && !(await hasUnlockedLink(slug))) {
    return (
      <Shell>
        <Lock className="mx-auto mb-3 h-8 w-8 text-text-muted" />
        <h1 className="mb-4 text-lg font-semibold">This link is password protected</h1>
        <form method="post" action={`/api/s/${slug}/unlock`} className="flex flex-col gap-3">
          <label htmlFor="password" className="sr-only">Password</label>
          <Input id="password" name="password" type="password" required maxLength={128} autoFocus placeholder="Password" />
          {error === "password" && <p className="text-sm text-danger">Wrong password. Try again.</p>}
          {error === "rate" && <p className="text-sm text-danger">Too many attempts. Wait a few minutes.</p>}
          <Button type="submit" className="w-full">Open</Button>
        </form>
      </Shell>
    )
  }

  await db.update(links).set({ views: sql`${links.views} + 1` }).where(eq(links.id, link.id))
  await writeAudit("link.view", file.id, undefined, slug, ip)

  const downloadUrl = `/api/s/${slug}/download`
  const displayName = file.title || file.name
  const isImage = !file.isFolder && file.mimeType.startsWith("image/")

  return (
    <Shell>
      <h1 className="mb-2 break-words text-xl font-bold">{displayName}</h1>
      {!file.isFolder && <p className="mb-6 text-text-muted">{formatBytes(file.size)}</p>}
      {file.isFolder && <p className="mb-6 text-text-muted">Shared folder</p>}

      {isImage && (
        <div className="mb-6 flex items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-muted">
          <img src={downloadUrl} alt={displayName} className="max-h-96 max-w-full object-contain" />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {!file.isFolder && (
          <Button asChild className="w-full">
            <a href={downloadUrl} download={file.name}>
              <Download className="mr-2 h-4 w-4" /> Download
            </a>
          </Button>
        )}
        {link.kind === "edit" && <LinkUploadBox slug={slug} mode={file.isFolder ? "folder" : "file"} />}
      </div>
    </Shell>
  )
}
