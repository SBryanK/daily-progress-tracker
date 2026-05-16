import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { authConfig } from "@/lib/auth.config";

// Login is now username-based. We keep storing the value in the existing
// `User.email` column (it's just a `String @unique` in Prisma — perfect
// for a unique username) so no DB migration is needed when we flip the
// UI from "email" to "username". Usernames are normalised to lowercase
// to keep lookups consistent with how they were seeded.
const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username is required")
    .max(64, "Username is too long")
    // Allow letters, digits, dot, dash, underscore — covers common
    // shell usernames like `sbryank` while rejecting whitespace and
    // other characters that would never appear in a real account.
    .regex(/^[a-zA-Z0-9._-]+$/, "Invalid characters in username"),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const username = parsed.data.username.toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email: username },
        });
        if (!user) {
          logger.warn("auth.failed", { username, reason: "no-such-user" });
          return null;
        }

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) {
          logger.warn("auth.failed", { username, reason: "bad-password" });
          return null;
        }

        return {
          id: user.id,
          // NextAuth's User type expects `email`, and several places in
          // the app read `session.user.email` for display. We surface
          // the username through that field so all existing UI keeps
          // working without per-component edits.
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        // Default to VIEWER (not ADMIN) when the underlying record has no
        // explicit role — never silently grant admin power.
        token.role = (user as { role?: string }).role ?? "VIEWER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as { id?: string }).id = token.id as string;
        (session.user as unknown as { role?: string }).role =
          (token.role as string) ?? "VIEWER";
      }
      return session;
    },
  },
});
