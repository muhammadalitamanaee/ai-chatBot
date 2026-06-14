import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { db } from "@/db/index";
import { users } from "@/db/schema";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // The login page we'll build — NextAuth redirects here when not logged in
  pages: {
    signIn: "/login",
  },

  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],

  callbacks: {
    // This runs every time a user logs in
    // We use it to save/update the user in our own database
    async signIn({ user }) {
      if (!user.email) return false; // reject if no email

      try {
        // Upsert — insert if new user, update if existing
        // This way we always have the latest name/image from their provider
        await db
          .insert(users)
          .values({
            id: user.email, // use email as ID — consistent across providers
            name: user.name ?? "",
            email: user.email,
            image: user.image ?? "",
          })
          .onConflictDoUpdate({
            target: users.email,
            set: {
              name: user.name ?? "",
              image: user.image ?? "",
            },
          });
      } catch (err) {
        console.error("[auth] Failed to save user:", err);
        return false;
      }

      return true;
    },

    // Add userId to the session so we can access it in route handlers
    async session({ session }) {
      if (session.user?.email) {
        session.user.id = session.user.email;
      }
      return session;
    },
  },
});
