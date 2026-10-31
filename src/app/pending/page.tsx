"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import { clearPwaCache } from "@/components/pwa/clear-cache"

export default function PendingPage() {
  const router = useRouter()
  const sessionData = useSession()
  const session = sessionData?.data
  const update = sessionData?.update

  useEffect(() => {
    if (!update) return;
    const interval = setInterval(async () => {
      const newSession = await update()

      if (newSession?.user?.status === "approved") {
        router.refresh()
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [router, update])

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Waiting for approval</CardTitle>
          <CardDescription>
            {session?.user?.email ? `Logged in as ${session.user.email}` : "Please wait..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <Button
            variant="outline"
            onClick={() => { clearPwaCache(); signOut({ callbackUrl: "/login" }); }}
            className="w-full"
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
