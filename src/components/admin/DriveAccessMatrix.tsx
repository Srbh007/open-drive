"use client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function DriveAccessMatrix({ userId }: { userId: string | null }) {
  if (!userId) return <div className="text-text-muted mt-4">Select a user to manage Drive access.</div>

  return (
    <div className="mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Drive</TableHead>
            <TableHead>Can see</TableHead>
            <TableHead>Can edit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={3} className="text-center text-text-muted">Loading access list...</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
