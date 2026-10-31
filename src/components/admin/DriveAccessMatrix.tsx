"use client"
import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

type DriveAccess = {
  driveAccountId: string
  label: string
  email: string
  canSee: boolean
  canEdit: boolean
}

export function DriveAccessMatrix({ userId }: { userId: string | null }) {
  const [access, setAccess] = useState<DriveAccess[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    async function fetchAccess() {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/users/${userId}/drive-access`)
        const json = await res.json()
        if (json.ok) {
          setAccess(json.data)
        } else {
          toast.error("Error loading access", { description: json.error.message })
        }
      } catch {
        toast.error("Network error")
      } finally {
        setLoading(false)
      }
    }
    fetchAccess()
  }, [userId])

  if (!userId) return <div className="text-text-muted mt-4">Select a user to manage Drive access.</div>

  const toggleSee = (driveId: string) => {
    setAccess(prev => prev.map(d => {
      if (d.driveAccountId === driveId) {
        const newSee = !d.canSee
        return { ...d, canSee: newSee, canEdit: newSee ? d.canEdit : false }
      }
      return d
    }))
  }

  const toggleEdit = (driveId: string) => {
    setAccess(prev => prev.map(d => {
      if (d.driveAccountId === driveId) {
        const newEdit = !d.canEdit
        return { ...d, canEdit: newEdit, canSee: newEdit ? true : d.canSee }
      }
      return d
    }))
  }

  const selectAll = () => {
    setAccess(prev => prev.map(d => ({ ...d, canSee: true, canEdit: true })))
  }

  const clearAll = () => {
    setAccess(prev => prev.map(d => ({ ...d, canSee: false, canEdit: false })))
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/drive-access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(access.map(a => ({ driveAccountId: a.driveAccountId, canSee: a.canSee, canEdit: a.canEdit })))
      })
      const json = await res.json()
      if (json.ok) {
        toast.success("Drive access saved")
      } else {
        toast.error("Failed to save", { description: json.error.message })
      }
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4">
      <div className="flex gap-2 mb-4 justify-end">
        <Button variant="outline" size="sm" onClick={selectAll}>Select all</Button>
        <Button variant="outline" size="sm" onClick={clearAll}>Clear</Button>
        <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Drive</TableHead>
            <TableHead>Can see</TableHead>
            <TableHead>Can edit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-text-muted">Loading access list...</TableCell>
            </TableRow>
          ) : access.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-text-muted">No drives available</TableCell>
            </TableRow>
          ) : (
            access.map(d => (
              <TableRow key={d.driveAccountId}>
                <TableCell>
                  <div className="font-medium">{d.label}</div>
                  <div className="text-xs text-text-muted">{d.email}</div>
                </TableCell>
                <TableCell>
                  <Checkbox checked={d.canSee} onCheckedChange={() => toggleSee(d.driveAccountId)} />
                </TableCell>
                <TableCell>
                  <Checkbox checked={d.canEdit} onCheckedChange={() => toggleEdit(d.driveAccountId)} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
