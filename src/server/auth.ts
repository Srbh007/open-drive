import 'server-only'
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { env } from "@/env"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import { eq } from "drizzle-orm"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!profile?.sub || !profile.email) {
        return false
      }

      const existingUsers = await db.select().from(users).where(eq(users.googleSub, profile.sub)).limit(1)
      let dbUser = existingUsers[0]

      if (!dbUser) {
        const isOwner = profile.email === env.OWNER_EMAIL
        const [newUser] = await db.insert(users).values({
          googleSub: profile.sub,
          email: profile.email,
          name: profile.name || profile.email.split('@')[0],
          image: profile.picture,
          role: isOwner ? "owner" : "viewer",
          status: isOwner ? "approved" : "pending",
        }).returning()
        dbUser = newUser
      } else {
        if (dbUser.name !== profile.name || dbUser.image !== profile.picture) {
           await db.update(users)
            .set({ name: profile.name || dbUser.name, image: profile.picture || dbUser.image })
            .where(eq(users.id, dbUser.id))
        }
      }

      user.id = dbUser.id
      return true
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id
      }

      if (token.id) {
        const [dbUser] = await db.select({ status: users.status }).from(users).where(eq(users.id, token.id as string)).limit(1)
        if (dbUser) {
          token.status = dbUser.status
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string
        // @ts-expect-error custom field
        session.user.status = token.status
      }
      return session
    }
  }
})
