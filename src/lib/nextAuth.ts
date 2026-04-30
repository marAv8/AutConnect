import type { NextAuthOptions } from "next-auth";
import AppleProvider from "next-auth/providers/apple";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/db";

const providers: NextAuthOptions["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  providers.push(
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    })
  );
}

function splitName(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

export const authOptions: NextAuthOptions = {
  // APPLICATION IS IN DEVELOPMENT MODE:
  // Email/password remains permissive for fake, test, and company emails.
  // OAuth is optional and must not block the existing custom login flow.
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers,
  callbacks: {
    async signIn({ account, user }) {
      const email = user.email?.toLowerCase();
      const authType = account?.provider === "apple" ? "apple" : "google";

      if (!email || !account || !["google", "apple"].includes(account.provider)) {
        return false;
      }

      const existing = await db.provider.findFirst({
        where: {
          email: {
            equals: email,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });

      if (existing) {
        try {
          await db.$executeRaw`
            UPDATE "Provider"
            SET "authType" = ${authType}
            WHERE "id" = ${existing.id}
          `;
        } catch (error) {
          console.warn("Optional auth metadata columns are not available.", error);
        }
        return true;
      }

      const { firstName, lastName } = splitName(user.name);

      const provider = await db.provider.create({
        data: {
          email,
          firstName,
          lastName,
          role: "",
          passwordHash: "",
        },
        select: {
          id: true,
        },
      });

      try {
        await db.$executeRaw`
          UPDATE "Provider"
          SET "providerRole" = NULL, "authType" = ${authType}
          WHERE "id" = ${provider.id}
        `;
      } catch (error) {
        console.warn("Optional auth metadata columns are not available.", error);
      }

      return true;
    },
  },
  pages: {
    signIn: "/login",
  },
};
