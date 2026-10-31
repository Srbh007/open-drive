import { ReactNode } from "react"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/Providers"
import { PortalNav } from "@/components/PortalNav"

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg">
      <PortalNav />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto bg-bg">
          <Providers>{children}</Providers>
        </main>
      </div>
      <Toaster />
    </div>
  )
}
