import { db } from "@/server/db"
import { driveAccounts } from "@/server/db/schema"
import { requireUser } from "@/server/guard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default async function SettingsPage() {
  const user = await requireUser()
  const isAdmin = user.role === "admin" || user.role === "owner"
  let drives: typeof driveAccounts.$inferSelect[] = []

  if (isAdmin) {
    drives = await db.select().from(driveAccounts)
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
                    <Button variant="outline" size="sm" className="mr-2">Reconnect</Button>
                    <Button variant="destructive" size="sm">Disconnect</Button>
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
