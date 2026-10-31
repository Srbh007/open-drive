import { ReactNode } from "react"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/Providers"

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4 hidden">
        {/* Hiding the old top bar shell, since Explorer has its own full-screen layout */}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto bg-bg">
          <Providers>
            {children}
          </Providers>
        </main>
      </div>
      <Toaster />
    </div>
  )
}
