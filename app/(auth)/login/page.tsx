"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, UserCheck, ShieldAlert, KeyRound, Loader2, ArrowRight } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPassword?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const loginEmail = customEmail ?? email;
    const loginPassword = customPassword ?? password;

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: loginEmail,
        password: loginPassword,
        callbackUrl,
      });

      if (!res?.error) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        setError("Invalid email or password. Please verify credentials.");
      }
    } catch {
      setError("An unexpected authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    {
      role: "SUBMITTER",
      name: "Citizen Submitter",
      email: "submitter@electionverify.org",
      password: "Submitter@123",
      desc: "Submit links/text/images for AI verification & view own pending status.",
      badge: "bg-blue-900/60 text-blue-300 border-blue-700",
      icon: UserCheck,
    },
    {
      role: "REVIEWER",
      name: "Fact-Check Reviewer",
      email: "reviewer@electionverify.org",
      password: "Reviewer@123",
      desc: "Access Reviewer Queue, inspect evidence, approve/override verdicts.",
      badge: "bg-amber-900/60 text-amber-300 border-amber-700",
      icon: ShieldCheck,
    },
    {
      role: "ADMIN",
      name: "Chief Administrator",
      email: "admin@electionverify.org",
      password: "Admin@123",
      desc: "Manage users, inspect system audit logs, configure source allowlists.",
      badge: "bg-purple-900/60 text-purple-300 border-purple-700",
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-8">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto mb-3">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Sign in to SatyaVote AI</h1>
          <p className="text-xs text-slate-400 mt-1">
            Access role-gated election verification workflows or test with pre-seeded demo accounts.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs text-center">
            {error}
          </div>
        )}

        {/* 1-Click Demo Accounts */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-3">
            ⚡ Quick Demo Login (One-Click)
          </span>
          <div className="grid grid-cols-1 gap-2.5">
            {demoAccounts.map((acc) => {
              const Icon = acc.icon;
              return (
                <button
                  key={acc.role}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                    handleLogin(undefined, acc.email, acc.password);
                  }}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-slate-300 group-hover:text-blue-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">{acc.name}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${acc.badge}`}>
                          {acc.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{acc.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Manual Credentials Form */}
        <form onSubmit={handleLogin} className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-6 space-y-4">
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-3 text-slate-400 text-[11px] uppercase tracking-wider">or sign in manually</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="e.g. reviewer@electionverify.org"
              className="w-full px-3.5 py-2 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            <span>Sign In with Credentials</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs">
          Loading sign in...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
