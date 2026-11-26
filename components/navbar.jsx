"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, LogIn, LogOut, CheckCircle2, AlertTriangle, Globe } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

export function Navbar({ user }) {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();

  const navLinks = [
    { href: "/", label: t.nav.home },
    { href: "/claims", label: t.nav.publicClaims },
    { href: "/submit", label: t.nav.submitInfo },
    { href: "/analytics", label: t.nav.analytics },
    { href: "/methodology", label: t.nav.methodology },
  ];

  const languages = [
    { code: "en", label: "EN" },
    { code: "hi", label: "हिन्दी" },
    { code: "pa", label: "ਪੰਜਾਬੀ" },
  ];

  const getRoleBadge = (role) => {
    switch (role) {
      case "ADMIN":
        return "bg-purple-900/60 text-purple-300 border-purple-700";
      case "REVIEWER":
        return "bg-amber-900/60 text-amber-300 border-amber-700";
      case "SUBMITTER":
        return "bg-blue-900/60 text-blue-300 border-blue-700";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border-b border-slate-800/80 px-4 py-1.5 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>{t.prototypeDisclaimer}</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="font-bold text-slate-100 tracking-tight leading-tight flex items-center gap-1.5">
              <span>{t.appName}</span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono border border-blue-500/30">
                AI Platform
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight hidden sm:block">{t.appSubtitle}</p>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "text-blue-400 bg-blue-500/10 border border-blue-500/20"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {(user?.role === "REVIEWER" || user?.role === "ADMIN") && (
            <Link
              href="/reviewer"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                pathname.startsWith("/reviewer")
                  ? "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                  : "text-amber-300/80 hover:text-amber-300 hover:bg-amber-950/40"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t.nav.reviewQueue}</span>
            </Link>
          )}

          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname.startsWith("/admin")
                  ? "text-purple-400 bg-purple-500/10 border border-purple-500/20"
                  : "text-purple-300/80 hover:text-purple-300 hover:bg-purple-950/40"
              }`}
            >
              {t.nav.adminPortal}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5" role="group" aria-label="Select Language">
            <div className="px-1.5 text-slate-400 hidden sm:block">
              <Globe className="w-3.5 h-3.5" />
            </div>
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                  language === lang.code
                    ? "bg-blue-600 text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                aria-pressed={language === lang.code}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-medium text-slate-200 truncate max-w-[120px]">{user.name || user.email}</span>
                <span
                  className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded border w-fit ml-auto ${getRoleBadge(
                    user.role
                  )}`}
                >
                  {user.role}
                </span>
              </div>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.nav.logout}</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t.nav.login}</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
