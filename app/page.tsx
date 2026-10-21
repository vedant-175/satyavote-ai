import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Database,
  Users,
  FileText,
  AlertTriangle,
  ArrowRight,
  Server,
  KeyRound,
  ExternalLink,
} from "lucide-react";

export default async function HomePage() {
  const session = await auth();

  // Fetch live system counts from PostgreSQL
  const [userCount, claimCount, sourceCount, auditCount] = await Promise.all([
    prisma.user.count(),
    prisma.claim.count(),
    prisma.sourceProfile.count(),
    prisma.auditLog.count(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-xs font-semibold text-blue-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Academic Project &bull; Phase 0 Foundation Complete</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-100 leading-tight">
          AI-Assisted Election Information Verification Platform
        </h1>
        <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
          A human-in-the-loop verification system for Indian elections (ECI, PIB Fact Check, State CEOs). The AI extracts atomic claims and retrieves grounded evidence; accredited human reviewers make the final verdict.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/claims"
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md transition-all"
          >
            <span>Explore Public Claims</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/analytics"
            className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-300 text-xs font-semibold border border-emerald-900/50 flex items-center gap-2 transition-all"
          >
            <span>Live Analytics & Trends</span>
          </Link>
          <Link
            href="/submit"
            className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 flex items-center gap-2 transition-all"
          >
            <span>Submit Info</span>
          </Link>
          <Link
            href="/methodology"
            className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 flex items-center gap-2 transition-all"
          >
            <span>Methodology & Ethics</span>
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-semibold border border-amber-900/50 flex items-center gap-2 transition-all"
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Switch Role / Login</span>
          </Link>
        </div>
      </div>

      {/* Phase 0 Deliverables & Live System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Database & Schema Status */}
        <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-200">PostgreSQL + Prisma</h2>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              Synced & Seeded
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            All 9 schema models (§3.5) deployed with indexes, relations, and pgvector compatibility:
          </p>
          <ul className="text-xs text-slate-300 space-y-1 font-mono">
            <li>&bull; Users: <strong className="text-emerald-400">{userCount} seeded</strong></li>
            <li>&bull; Authoritative Sources: <strong className="text-emerald-400">{sourceCount} seeded</strong></li>
            <li>&bull; Atomic Claims: <strong className="text-emerald-400">{claimCount} seeded</strong></li>
            <li>&bull; Audit Trail Logs: <strong className="text-emerald-400">{auditCount} seeded</strong></li>
          </ul>
        </div>

        {/* Auth & RBAC Security Status */}
        <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-bold text-slate-200">Auth & RBAC Guards</h2>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
              Active
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Multi-role authentication with server-side RBAC enforcement across 3 core roles:
          </p>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-blue-300 font-semibold">SUBMITTER</span>
              <span className="text-slate-400 text-[11px]">Submit & view own items</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-amber-300 font-semibold">REVIEWER</span>
              <span className="text-slate-400 text-[11px]">Audit queue & approve</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-purple-300 font-semibold">ADMIN</span>
              <span className="text-slate-400 text-[11px]">System & user governance</span>
            </div>
          </div>
        </div>

        {/* Current Active Session */}
        <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-bold text-slate-200">Active Test Session</h2>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {session?.user ? "Logged In" : "Guest Mode"}
            </span>
          </div>
          {session?.user ? (
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Signed in as:</div>
                <div className="font-semibold text-slate-200 text-sm">{session.user.name || session.user.email}</div>
                <div className="font-mono text-[11px] text-slate-400 mt-0.5">{session.user.email}</div>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                  Role: {session.user.role}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-2">
              <p>Browsing anonymously. Log in with a demo role to test RBAC gates.</p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-medium"
              >
                <span>Login with 1-Click Demo Accounts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Interactive RBAC Verification Suite */}
      <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            Interactive Phase 0 RBAC Testing Suite
          </h2>
        </div>
        <p className="text-xs text-slate-400">
          Click the links below to test server-side and middleware route protections:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <Link
            href="/reviewer"
            className="p-3.5 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition-colors flex items-center justify-between group"
          >
            <div>
              <div className="text-xs font-semibold text-amber-300">/reviewer (Queue)</div>
              <div className="text-[11px] text-slate-400">Requires REVIEWER or ADMIN</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all" />
          </Link>

          <Link
            href="/admin"
            className="p-3.5 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition-colors flex items-center justify-between group"
          >
            <div>
              <div className="text-xs font-semibold text-purple-300">/admin (Dashboard)</div>
              <div className="text-[11px] text-slate-400">Requires ADMIN strictly</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-300 group-hover:translate-x-0.5 transition-all" />
          </Link>

          <a
            href="/api/test-rbac?role=ADMIN"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition-colors flex items-center justify-between group"
          >
            <div>
              <div className="text-xs font-semibold text-blue-300">/api/test-rbac (API Guard)</div>
              <div className="text-[11px] text-slate-400">Returns 401/403 if unauthorized</div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-blue-300 transition-all" />
          </a>
        </div>
      </div>
    </div>
  );
}
