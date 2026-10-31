import { type DefaultSession } from "next-auth"


declare module "next-auth" {
  interface Session {
    user: {
      id: string
      status: "pending" | "approved" | "suspended"
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    status: "pending" | "approved" | "suspended"
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    status: "pending" | "approved" | "suspended"
  }
}
