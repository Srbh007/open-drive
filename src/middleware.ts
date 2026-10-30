import { NextResponse } from "next/server"
import { auth } from "@/server/auth"

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  const isPublicPath =
    nextUrl.pathname === "/login" ||
    nextUrl.pathname.startsWith("/s/") ||
    nextUrl.pathname.startsWith("/i/") ||
    nextUrl.pathname.startsWith("/api/s/") ||
    nextUrl.pathname.startsWith("/api/auth/") ||
    nextUrl.pathname.startsWith("/api/cron/") ||
    nextUrl.pathname === "/manifest.webmanifest" ||
    nextUrl.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)

  if (isPublicPath) {
    if (isLoggedIn && nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/", nextUrl))
    }
    return NextResponse.next()
  }

  if (!isLoggedIn) {
    let from = nextUrl.pathname;
    if (nextUrl.search) {
      from += nextUrl.search;
    }
    return NextResponse.redirect(new URL(`/login?from=${encodeURIComponent(from)}`, nextUrl));
  }

  // @ts-expect-error custom field
  const status = req.auth?.user?.status

  if (status === "suspended") {
    const res = NextResponse.redirect(new URL("/login", nextUrl))
    res.cookies.delete("authjs.session-token")
    res.cookies.delete("__Secure-authjs.session-token")
    return res
  }

  if (status === "pending" && nextUrl.pathname !== "/pending") {
    return NextResponse.redirect(new URL("/pending", nextUrl))
  }

  if (status === "approved" && nextUrl.pathname === "/pending") {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
