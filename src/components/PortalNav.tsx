"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { HardDrive, LayoutDashboard, Link2, LogOut, Settings, Star, UploadCloud, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { clearPwaCache } from "@/components/pwa/clear-cache"

const ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/drive", label: "Files", icon: HardDrive },
  { href: "/upload", label: "Upload", icon: UploadCloud },
  { href: "/links", label: "Links", icon: Link2 },
  { href: "/favorites", label: "Favorites", icon: Star },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
] as const

export function PortalNav() {
  const pathname = usePathname()

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-surface px-3">
      <span className="mr-3 shrink-0 font-semibold">Open Drive</span>
      <nav className="flex flex-1 items-center gap-1" aria-label="Main">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-text-muted hover:bg-surface-muted hover:text-text",
                active && "bg-surface-muted font-medium text-text",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          )
        })}
      </nav>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={() => {
          clearPwaCache()
          void signOut({ callbackUrl: "/login" })
        }}
      >
        <LogOut className="h-4 w-4 sm:mr-1.5" aria-hidden />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </header>
  )
}
