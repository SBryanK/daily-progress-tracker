// Edge-compatible NextAuth configuration used by `src/middleware.ts`.
// Must not import bcrypt, Prisma, or any Node-only modules.
import type { NextAuthConfig } from "next-auth";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    // Keep the owner signed in for a full year — matches the
    // `dpt.role` welcome cookie. Without this NextAuth defaults to 30
    // days, which forces Bryan to retype credentials every month and
    // contradicts the "remember me for a year" promise on /welcome.
    maxAge: ONE_YEAR_SECONDS,
    updateAge: 60 * 60 * 24, // refresh the JWT once per day on activity
  },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [], // real providers live in src/lib/auth.ts (Node runtime)
  callbacks: {
    authorized({ auth: session }) {
      return !!session;
    },
  },
};
