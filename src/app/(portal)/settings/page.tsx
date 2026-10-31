"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

  useEffect(() => {
    async function loadDrives() {
      try {
        const res = await fetch("/api/drives")
        if (res.status === 403) return
        const json = await res.json()
        if (json.ok) {
          setDrives(json.data)
          setIsAdmin(true) // for simple mock UI since non-admins wouldn't see all info similarly
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

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      {isAdmin && (
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Drives (Admin)</h2>
            <form action="/api/connect/drive" method="GET">
              <Button type="submit">Connect Drive</Button>
            </form>
          </div>
          <Table>
            <TableHeader>
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
                  <TableCell colSpan={4} className="text-center text-text-muted">No drives connected</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
