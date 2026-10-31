import * as React from "react"
import { notFound } from "next/navigation"
import { getLinkInfo } from "@/server/links"
import { db } from "@/server/db"
import { files } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { Button } from "@/components/ui/button"
import { Download, UploadCloud } from "lucide-react"
import { ReplaceFileButton } from "@/components/upload/ReplaceFileButton"
import { rateLimit } from "@/server/ratelimit"
import { headers } from "next/headers"

export default async function PublicLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const ip = "127.0.0.1"; // Ideally from headers
  const { success } = await rateLimit.limit(`public_link_${ip}`);
  if (!success) return <div className="p-4">Rate limited</div>;
  const { slug } = await params
  
  let link
  try {
    link = await getLinkInfo(slug)
  } catch {
    notFound()
  }

  const [file] = await db.select().from(files).where(eq(files.id, link.fileId)).limit(1)
  if (!file) notFound()

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl shadow-sm p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-bold mb-2">{file.title || file.name}</h1>
        <p className="text-text-muted mb-6">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
        
        {file.hasThumbnail && (
          <div className="mb-6 rounded-lg overflow-hidden border border-border aspect-video bg-surface-muted flex items-center justify-center">
            <img src={`/api/thumb/${file.id}`} alt="thumbnail" className="max-w-full max-h-full object-contain" />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <a href={`/api/stream/${file.id}`} download={file.name}>
              <Download className="mr-2 h-4 w-4" /> Download
            </a>
          </Button>

          {link.kind === 'edit' && (
            <ReplaceFileButton slug={slug} fileName={file.name} fileType={file.mimeType} fileSize={file.size} />
          )}
        </div>
      </div>
    </div>
  )
}
