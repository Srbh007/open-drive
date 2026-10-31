"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { DriveAccessMatrix } from "./DriveAccessMatrix"

type User = {
  id: string
  name: string
  email: string
  image: string | null
  status: "pending" | "approved" | "suspended"
  role: "viewer" | "editor" | "admin" | "owner"
  createdAt: string
}

export function TeamTable() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/admin/users")
        const json = await res.json()
        if (json.ok) {
          setUsers(json.data)
        } else {
          toast.error("Error fetching users", { description: json.error.message })
        }
      } catch {
        toast.error("Error", { description: "Network error" })
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  async function updateUser(id: string, updates: Partial<User>) {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      })
      const json = await res.json()
      if (json.ok) {
        toast.success("User updated")
        // would normally refetch here for simplicity we skip in this mock component
      } else {
        toast.error("Error", { description: json.error.message })
      }
    } catch {
      toast.error("Error", { description: "Network error" })
    }
  }

  const pendingUsers = users.filter(u => u.status === "pending")
  const members = users.filter(u => u.status !== "pending")

  if (loading) return <div>Loading...</div>

  return (
    <Tabs defaultValue="members" className="w-full">
      <TabsList>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="pending">
          Pending {pendingUsers.length > 0 && <Badge variant="secondary" className="ml-2">{pendingUsers.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="access">Drive access</TabsTrigger>
      </TabsList>

      <TabsContent value="members">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map(user => (
              <TableRow key={user.id}>
                <TableCell className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image || ""} />
                    <AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-text-muted">{user.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  {user.role === "owner" ? (
                    <Badge variant="outline">Owner</Badge>
                  ) : (
                    <Select
                      defaultValue={user.role}
                      onValueChange={(val) => updateUser(user.id, { role: val as User["role"] })}
                    >
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  {user.status === "suspended" ? (
                    <Badge variant="destructive">Suspended</Badge>
                  ) : (
                    <Badge variant="secondary">Active</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {user.role !== "owner" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateUser(user.id, { status: user.status === "suspended" ? "approved" : "suspended" })}
                    >
                      {user.status === "suspended" ? "Unsuspend" : "Suspend"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center">No members found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="pending">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingUsers.map(user => (
              <TableRow key={user.id}>
                <TableCell className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image || ""} />
                    <AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-text-muted">{user.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-text-muted">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateUser(user.id, { status: "suspended" })} // Deny = suspend for now
                  >
                    Deny
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => updateUser(user.id, { status: "approved" })}
                  >
                    Approve
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {pendingUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center">No pending requests</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="access" className="flex gap-6 mt-4">
        <div className="w-1/3 border-r border-border pr-4">
          <h3 className="font-semibold mb-2">Members</h3>
          <div className="flex flex-col gap-2">
            {members.map(user => (
              <Button
                key={user.id}
                variant={selectedUser === user.id ? "default" : "ghost"}
                className="justify-start w-full text-left"
                onClick={() => setSelectedUser(user.id)}
              >
                {user.name}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <DriveAccessMatrix userId={selectedUser} />
        </div>
      </TabsContent>
    </Tabs>
  )
}
