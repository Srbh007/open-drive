import { ReactNode } from "react"

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
        <div className="text-sm font-semibold">Open Drive</div>
        <div className="text-sm text-text-muted">Top Bar Shell</div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[280px] shrink-0 border-r border-border bg-surface p-4">
          <nav className="text-sm text-text-muted">
            Left Nav Shell
          </nav>
        </aside>

        <main className="flex-1 overflow-auto bg-bg">
          {children}
        </main>
      </div>
    </div>
  )
}
