"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  ShieldAlert,
  Clock,
  ArrowRight,
  Filter,
  Sparkles,
  Layers,
  Flame,
  AlertTriangle,
  RefreshCw,
  Search,
  Check,
} from "lucide-react";
import { QueueItem } from "@/lib/reviewer/service";

export default function ReviewerQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & sort state
  const [sort, setSort] = useState<"priority" | "viral" | "confidence_asc" | "recency">("priority");
  const [status, setStatus] = useState<"AI_SUGGESTED" | "IN_REVIEW" | "PUBLISHED" | "ESCALATED" | "ALL">("AI_SUGGESTED");
  const [type, setType] = useState<"ALL" | "TEXT" | "LINK" | "IMAGE">("ALL");
  const [verdict, setVerdict] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const [adjudicatingId, setAdjudicatingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort,
        status,
        type,
        verdict,
        limit: "50",
      });
      const res = await fetch(`/api/reviewer/queue?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load reviewer queue.");
      }
      const data = await res.json();
      setItems(data.data.items || []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching reviewer queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [sort, status, type, verdict]);

  // Inline Quick-Approve handler
  const handleQuickApprove = async (claimId: string) => {
    setAdjudicatingId(claimId);
    try {
      const res = await fetch(`/api/reviewer/claims/${claimId}/adjudicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPROVE",
          note: "Quick approved from reviewer queue desk.",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error?.message || "Failed to approve claim.");
        return;
      }

      // Update state locally
      setItems((prev) =>
        prev.map((item) =>
          item.id === claimId
            ? {
                ...item,
                finalVerdict: item.aiVerdict,
                publishedAt: new Date(),
                submission: { ...item.submission, status: "PUBLISHED" as any },
              }
            : item
        )
      );
    } catch {
      alert("Network error approving claim.");
    } finally {
      setAdjudicatingId(null);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.text.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      (item.submission.url && item.submission.url.toLowerCase().includes(q))
    );
  });

  const getVerdictBadge = (v: string) => {
    switch (v) {
      case "SUPPORTED":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800";
      case "CONTRADICTED":
        return "bg-rose-950/80 text-rose-300 border-rose-800";
      case "MISLEADING":
        return "bg-amber-950/80 text-amber-300 border-amber-800";
      case "NOT_CHECKABLE":
        return "bg-purple-950/80 text-purple-300 border-purple-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Reviewer Queue Desk</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Human-in-the-Loop Adjudication
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Prioritize viral claims, review retrieved authoritative citations, approve verified facts, or override AI suggestions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchQueue()}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
            <span>Refresh Queue</span>
          </button>
          <Link
            href="/admin"
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-800 flex items-center gap-1.5 transition-colors"
          >
            <span>Admin Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Control Bar: Priority Sort Buttons & Status Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
        {/* Sort Pill Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Sort by:</span>
          <button
            onClick={() => setSort("priority")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
              sort === "priority"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-800 text-slate-300 hover:bg-slate-750"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Priority Rank</span>
          </button>
          <button
            onClick={() => setSort("viral")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
              sort === "viral"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-slate-800 text-slate-300 hover:bg-slate-750"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-orange-300" />
            <span>Viral / Duplicate Count</span>
          </button>
          <button
            onClick={() => setSort("confidence_asc")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
              sort === "confidence_asc"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-800 text-slate-300 hover:bg-slate-750"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-200" />
            <span>Low Confidence First</span>
          </button>
          <button
            onClick={() => setSort("recency")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
              sort === "recency"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-800 text-slate-300 hover:bg-slate-750"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Recency</span>
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search claim text or ID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Filter Row: Status, Type, Verdict */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {/* Status Filter */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg">
          {(["AI_SUGGESTED", "IN_REVIEW", "ESCALATED", "PUBLISHED", "ALL"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatus(st)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                status === st
                  ? "bg-slate-800 text-white font-semibold shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {st === "AI_SUGGESTED" ? "Pending AI Suggested" : st}
            </button>
          ))}
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg">
          {(["ALL", "TEXT", "LINK", "IMAGE"] as const).map((tp) => (
            <button
              key={tp}
              onClick={() => setType(tp)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                type === tp
                  ? "bg-slate-800 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tp}
            </button>
          ))}
        </div>

        {/* Verdict Filter */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg">
          {(["ALL", "CONTRADICTED", "SUPPORTED", "MISLEADING", "UNVERIFIED"] as const).map((vd) => (
            <button
              key={vd}
              onClick={() => setVerdict(vd)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                verdict === vd
                  ? "bg-slate-800 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {vd}
            </button>
          ))}
        </div>
      </div>

      {/* Claims List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-16 text-center bg-slate-900/50 border border-slate-800 rounded-xl space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Ranking claims in reviewer queue...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center bg-slate-900/50 border border-slate-800 rounded-xl text-slate-400 space-y-2">
            <p className="text-sm font-semibold text-slate-300">No claims match the active filters.</p>
            <p className="text-xs text-slate-500">Try switching status to ALL or clearing your search query.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-5 rounded-xl border transition-all shadow-sm ${
                item.finalVerdict
                  ? "bg-slate-900/50 border-emerald-900/40"
                  : "bg-slate-900 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  {/* Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      Claim #{item.id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                      Type: {item.submission.type}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${getVerdictBadge(item.aiVerdict)}`}>
                      AI Suggested: {item.aiVerdict}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      Confidence: {(item.aiConfidence * 100).toFixed(0)}%
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                      Priority Score: {item.priorityScore}
                    </span>

                    {/* Viral / Duplicate Counter Badge */}
                    {item.duplicateCount > 1 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1 font-semibold">
                        <Flame className="w-3 h-3 text-orange-400" />
                        <span>Recirculated Media ({item.duplicateCount}x)</span>
                      </span>
                    )}

                    {/* Image Warning Flags */}
                    {item.submission.imageAnalysis?.flags.map((flag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>{flag.length > 40 ? flag.slice(0, 40) + "..." : flag}</span>
                      </span>
                    ))}

                    {/* Published status if already adjudicated */}
                    {item.finalVerdict && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 font-semibold">
                        <Check className="w-3 h-3" />
                        <span>PUBLISHED: {item.finalVerdict}</span>
                      </span>
                    )}
                  </div>

                  {/* Claim Text */}
                  <p className="text-base font-semibold text-slate-100 leading-snug">
                    "{item.text}"
                  </p>

                  {/* AI Grounding Reasoning */}
                  {item.aiReasoning && (
                    <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800/80 leading-relaxed">
                      <strong className="text-blue-400">AI Grounding Reasoning:</strong> {item.aiReasoning}
                    </p>
                  )}

                  {/* Evidence & Submission Info */}
                  <div className="pt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>
                      Evidence: <strong className="text-slate-200">{item.evidenceCount} primary citations</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Language: <strong className="uppercase text-slate-200">{item.language}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Submitted: <strong className="text-slate-200">{new Date(item.createdAt).toLocaleDateString()}</strong>
                    </span>
                    {item.submission.url && (
                      <>
                        <span>&bull;</span>
                        <a
                          href={item.submission.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline max-w-[200px] truncate inline-block"
                        >
                          Source URL: {item.submission.url}
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* Desk Actions */}
                <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 md:min-w-[170px]">
                  <Link
                    href={`/reviewer/claim/${item.id}`}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <span>Review Evidence</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  {!item.finalVerdict ? (
                    <button
                      onClick={() => handleQuickApprove(item.id)}
                      disabled={adjudicatingId === item.id}
                      className="px-3.5 py-2 text-xs font-medium rounded-lg bg-emerald-950 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      title="1-Click Approve AI suggested verdict"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{adjudicatingId === item.id ? "Approving..." : "Quick Approve"}</span>
                    </button>
                  ) : (
                    <div className="text-center text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 py-1.5 rounded-lg">
                      Adjudicated & Public
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
