import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold">
            HTTP 404 &bull; Record Not Found
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Election Record Unavailable
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            The verification report, claim ID, or resource you requested could not be located in the certified database. It may be pending human review or does not exist.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/claims"
            className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
          >
            <Search className="w-4 h-4" />
            <span>Search Public Claims</span>
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-2 transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Return to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
