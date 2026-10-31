"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

type DriveAccount = {
  id: string
  label: string
  email: string
  color: string
  status: string
  quotaUsed: number
  quotaTotal: number | null
}

export default function SettingsPage() {
  const [drives, setDrives] = useState<DriveAccount[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [linkDefault, setLinkDefault] = useState<"edit" | "view">("edit")
  const [linkExpiry, setLinkExpiry] = useState<string>("never")

  useEffect(() => {
    async function loadDrives() {
      try {
        const res = await fetch("/api/drives")
        if (res.status === 403) return
        const json = await res.json()
        if (json.ok) {
          setDrives(json.data)
          setIsAdmin(true)
        }
      } catch {
        toast.error("Failed to load drives")
      }
    }
    loadDrives()
  }, [])

  const disconnect = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this drive?")) return
    try {
      const res = await fetch(`/api/drives/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.ok) {
        toast.success("Drive disconnected")
        setDrives(prev => prev.filter(d => d.id !== id))
      } else {
        toast.error("Failed to disconnect", { description: json.error.message })
      }
    } catch {
      toast.error("Network error")
    }
  }

  const saveSettings = async (updates: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success("Settings updated")
      } else {
         toast.error("Failed to update settings", { description: json.error.message })
      }
    } catch {
       toast.error("Network error")
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Links</h2>
        <div className="flex flex-col gap-4 max-w-sm">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">&quot;Copy link&quot; gives</label>
            <Select 
              value={linkDefault} 
              onValueChange={(val: string | null) => {
                 if (!val) return;

                 setLinkDefault(val as "edit" | "view")
                 saveSettings({ copy_link_default: val })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="edit">Edit</SelectItem>
                <SelectItem value="view">View</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Edit-link expiry</label>
            <Select 
              value={linkExpiry} 
              onValueChange={(val: string | null) => {
                 if (!val) return;

                 setLinkExpiry(val)
                 const days = val === "never" ? null : parseInt(val, 10)
                 saveSettings({ copy_link_expiry_days: days })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Drives (Admin)</h2>
            <form action="/api/connect/drive" method="GET">
              <Button type="submit">Connect Drive</Button>
            </form>
          </div>
          <div className="bg-surface rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-surface-muted">
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drives.map(drive => (
                  <TableRow key={drive.id}>
                    <TableCell className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: drive.color }} />
                      {drive.label}
                    </TableCell>
                    <TableCell>
                      {drive.quotaTotal ? (
                        `${(drive.quotaUsed / 1e9).toFixed(1)} GB / ${(drive.quotaTotal / 1e9).toFixed(1)} GB`
                      ) : (
                        `${(drive.quotaUsed / 1e9).toFixed(1)} GB`
                      )}
                    </TableCell>
                    <TableCell>
                      {drive.status === 'reconnect' ? (
                        <Badge variant="destructive">Reconnect</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <form className="inline" action="/api/connect/drive" method="GET">
                        <Button variant="outline" size="sm" type="submit" className="mr-2">Reconnect</Button>
                      </form>
                      <Button variant="destructive" size="sm" onClick={() => disconnect(drive.id)}>Disconnect</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {drives.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-text-muted py-4">No drives connected</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
