// Edge-compatible NextAuth configuration used by `src/middleware.ts`.
// Must not import bcrypt, Prisma, or any Node-only modules.
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/?signin=1" },
  providers: [], // real providers live in src/lib/auth.ts (Node runtime)
  callbacks: {
    authorized({ auth: session }) {
      return !!session;
    },
  },
};
