import type { NextAuthConfig } from "next-auth";
import { Role } from "@prisma/client";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;
      const { pathname } = nextUrl;

      // 1. Admin paths: require authenticated ADMIN role
      if (pathname.startsWith("/admin")) {
        if (!isLoggedIn) return false; // redirects to /login
        return role === "ADMIN";
      }

      // 2. Reviewer paths: require REVIEWER or ADMIN role
      if (pathname.startsWith("/reviewer")) {
        if (!isLoggedIn) return false; // redirects to /login
        return role === "REVIEWER" || role === "ADMIN";
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
