import Link from "next/link";
import { ShieldAlert, ArrowLeft, LogIn } from "lucide-react";
import { auth } from "@/auth";

export default async function UnauthorizedPage() {
  const session = await auth();

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-100 mb-2">Access Restricted (403 Forbidden)</h1>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          You do not have the required role privileges to access this area.
          {session?.user ? (
            <span className="block mt-2 font-mono text-xs text-amber-400 bg-amber-950/40 py-1 px-2 rounded border border-amber-800/40">
              Current Session: {session.user.email} (Role: {session.user.role})
            </span>
          ) : (
            <span className="block mt-2 text-xs text-slate-400">
              You are currently browsing as an unauthenticated guest.
            </span>
          )}
        </p>

        <div className="flex flex-col gap-2.5">
          <Link
            href="/login"
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>Switch Role or Login</span>
          </Link>
          <Link
            href="/"
            className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium flex items-center justify-center gap-2 transition-colors border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Public Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
