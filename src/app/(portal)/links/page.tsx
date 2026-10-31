"use client"
import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Copy, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { LinkKind } from "@/server/links"

type LinkData = {
  id: string
  slug: string
  kind: LinkKind
  fileId: string
  fileName: string
  views: number
  expiresAt: string | null
  createdAt: string
  driveColor: string
}

export default function LinksPage() {
  const { data: links = [], refetch } = useQuery({
    queryKey: ['links'],
    queryFn: async () => {
      const res = await fetch('/api/links')
      if (!res.ok) throw new Error("Failed to load")
      const json = await res.json()
      return json.data as LinkData[]
    }
  })

  const copyLink = async (slug: string, kind: LinkKind) => {
    const origin = window.location.origin
    const url = kind === 'image' ? `${origin}/i/${slug}` : `${origin}/s/${slug}`
    await navigator.clipboard.writeText(url)
    toast.success("Link copied")
  }

  const revokeLink = async (slug: string) => {
    if (!confirm("Revoke this link? Anyone using it will lose access.")) return
    try {
      const res = await fetch(`/api/links/${slug}`, { method: 'DELETE' })
      if (!res.ok) throw new Error("Failed to revoke link")
      toast.success("Link revoked")
      refetch()
    } catch {
      toast.error("Failed to revoke link")
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Links</h1>

      <div className="bg-surface rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-surface-muted">
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.id}>
                <TableCell className="flex items-center gap-2">
                   <div className="h-3 w-3 rounded-full" style={{ backgroundColor: link.driveColor }} />
                   {link.fileName}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{link.kind}</Badge>
                </TableCell>
                <TableCell>{link.views}</TableCell>
                <TableCell>{new Date(link.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>{link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : "Never"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => copyLink(link.slug, link.kind)}>
                    <Copy className="h-4 w-4 mr-2" /> Copy
                  </Button>
                  <Button variant="ghost" size="sm" className="text-danger hover:text-danger hover:bg-danger/10" onClick={() => revokeLink(link.slug)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Revoke
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {links.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-text-muted">
                  No active links
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
