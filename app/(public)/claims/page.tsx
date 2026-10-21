"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileCheck2,
  ShieldCheck,
  Search,
  Filter,
  Flame,
  Globe2,
  MapPin,
  ExternalLink,
  Share2,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

interface PublicClaim {
  id: string;
  text: string;
  originalText?: string | null;
  language: string;
  topic: string | null;
  state: string | null;
  repeatCount: number;
  finalVerdict: string;
  finalNote: string | null;
  publishedAt: string;
  reviewedBy: {
    name: string | null;
    role: string;
  } | null;
  evidence: Array<{
    id: string;
    sourceName: string;
    title: string | null;
    snippet: string | null;
    url: string | null;
    stance: string;
  }>;
}

export default function PublicClaimsPage() {
  const { t } = useLanguage();
  const [claims, setClaims] = useState<PublicClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [verdict, setVerdict] = useState("ALL");
  const [topic, setTopic] = useState("ALL");
  const [state, setState] = useState("ALL");
  const [language, setLanguage] = useState("ALL");
  const [sort, setSort] = useState<"recency" | "viral">("recency");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort,
        limit: "40",
      });
      if (search.trim()) params.set("search", search.trim());
      if (verdict !== "ALL") params.set("verdict", verdict);
      if (topic !== "ALL") params.set("topic", topic);
      if (state !== "ALL") params.set("state", state);
      if (language !== "ALL") params.set("language", language);

      const res = await fetch(`/api/claims?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setClaims(json.data?.claims || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [verdict, topic, state, language, sort]);

  const handleCopyLink = (claimId: string) => {
    const url = `${window.location.origin}/claims/${claimId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(claimId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getVerdictStyle = (v: string) => {
    switch (v) {
      case "SUPPORTED":
        return "bg-emerald-950 text-emerald-300 border-emerald-800";
      case "CONTRADICTED":
        return "bg-rose-950 text-rose-300 border-rose-800";
      case "MISLEADING":
        return "bg-amber-950 text-amber-300 border-amber-800";
      case "NOT_CHECKABLE":
        return "bg-purple-950 text-purple-300 border-purple-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Certified Fact-Checking Database &bull; ECI Verified</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            {t.nav.publicClaims}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Browse verified election claims adjudicated by human fact-checkers with primary statutory citations and virality metrics.
          </p>
        </div>
        <Link
          href="/submit"
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-all w-fit shadow-sm"
        >
          <span>{t.nav.submitInfo}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Search & Filter Control Deck */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
        {/* Search Bar & Sort Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchClaims()}
              placeholder={t.common.searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchClaims()}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
            >
              {t.common.search}
            </button>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setSort("recency")}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  sort === "recency" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.common.mostRecent}
              </button>
              <button
                onClick={() => setSort("viral")}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                  sort === "viral" ? "bg-rose-950 text-rose-300 border border-rose-800" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Flame className="w-3 h-3 text-orange-400" />
                <span>{t.common.mostViral}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {/* Verdict Filter */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">{t.common.filter} Verdict:</label>
            <select
              value={verdict}
              onChange={(e) => setVerdict(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">{t.common.allVerdicts}</option>
              <option value="CONTRADICTED">CONTRADICTED ({t.verdicts.CONTRADICTED.label})</option>
              <option value="SUPPORTED">SUPPORTED ({t.verdicts.SUPPORTED.label})</option>
              <option value="MISLEADING">MISLEADING ({t.verdicts.MISLEADING.label})</option>
              <option value="UNVERIFIED">UNVERIFIED ({t.verdicts.UNVERIFIED.label})</option>
            </select>
          </div>

          {/* Topic Filter */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Topic / Category:</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">{t.common.allTopics}</option>
              <option value="EVM & Voting Technology">{t.topics["EVM & Voting Technology"] || "EVM & Voting Technology"}</option>
              <option value="Voter Identification & Rolls">{t.topics["Voter Identification & Rolls"] || "Voter Identification & Rolls"}</option>
              <option value="Model Code of Conduct">{t.topics["Model Code of Conduct"] || "Model Code of Conduct"}</option>
              <option value="Polling Operations & Schedule">{t.topics["Polling Operations & Schedule"] || "Polling Operations & Schedule"}</option>
              <option value="Counting & Results">{t.topics["Counting & Results"] || "Counting & Results"}</option>
              <option value="General Election Information">{t.topics["General Election Information"] || "General Information"}</option>
            </select>
          </div>

          {/* State Jurisdiction Filter */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">State / Jurisdiction:</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">{t.common.allStates}</option>
              <option value="National">{t.states["National"] || "National / ECI"}</option>
              <option value="Maharashtra">{t.states["Maharashtra"] || "Maharashtra"}</option>
              <option value="Uttar Pradesh">{t.states["Uttar Pradesh"] || "Uttar Pradesh"}</option>
              <option value="Punjab">{t.states["Punjab"] || "Punjab"}</option>
              <option value="Delhi">{t.states["Delhi"] || "Delhi"}</option>
              <option value="West Bengal">{t.states["West Bengal"] || "West Bengal"}</option>
              <option value="Bihar">{t.states["Bihar"] || "Bihar"}</option>
              <option value="Karnataka">{t.states["Karnataka"] || "Karnataka"}</option>
              <option value="Tamil Nadu">{t.states["Tamil Nadu"] || "Tamil Nadu"}</option>
              <option value="Rajasthan">{t.states["Rajasthan"] || "Rajasthan"}</option>
            </select>
          </div>

          {/* Language Filter */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Language:</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Languages</option>
              <option value="en">English (EN)</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Claims Records List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-16 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
            <p className="text-xs text-slate-400 font-mono">{t.common.loading}</p>
          </div>
        ) : claims.length === 0 ? (
          <div className="p-16 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400 space-y-2">
            <ShieldCheck className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-300">{t.common.noClaimsFound}</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No published claims match your search criteria. Per platform policy, only claims reviewed and certified by authorized fact-checkers are accessible publicly.
            </p>
          </div>
        ) : (
          claims.map((claim) => (
            <div
              key={claim.id}
              className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all space-y-4 shadow-sm"
            >
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-semibold border ${getVerdictStyle(claim.finalVerdict)}`}>
                    OFFICIAL VERDICT: {claim.finalVerdict}
                  </span>

                  {claim.repeatCount > 1 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1 font-semibold">
                      <Flame className="w-3 h-3 text-orange-400" />
                      <span>Viral Recirculation ({claim.repeatCount}x)</span>
                    </span>
                  )}

                  {claim.topic && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {t.topics[claim.topic] || claim.topic}
                    </span>
                  )}

                  {claim.state && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      <span>{t.states[claim.state] || claim.state}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                  <span>Published: {new Date(claim.publishedAt).toLocaleDateString()}</span>
                  <button
                    onClick={() => handleCopyLink(claim.id)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
                    title={t.common.copyLink}
                  >
                    {copiedId === claim.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 text-[10px]">{t.common.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[10px]">{t.common.share}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Claim Statement & Original Text */}
              <div className="space-y-2">
                <h2 className="text-base font-bold text-slate-100 leading-snug">
                  "{claim.text}"
                </h2>

                {claim.originalText && claim.originalText !== claim.text && (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
                    <span className="text-[10px] uppercase font-mono font-bold text-amber-400 block mb-0.5">
                      Original Text ({claim.language.toUpperCase()} Preserved)
                    </span>
                    <p className="text-slate-300 italic font-medium">"{claim.originalText}"</p>
                  </div>
                )}

                {claim.finalNote && (
                  <div className="text-xs text-slate-200 mt-2 bg-slate-950 p-3 rounded-lg border border-slate-800/80 leading-relaxed">
                    <strong className="text-emerald-400 flex items-center gap-1.5 mb-1">
                      <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                      <span>Reviewer Determination ({claim.reviewedBy?.name || "Election Fact-Check Desk"}):</span>
                    </strong>
                    <p>{claim.finalNote}</p>
                  </div>
                )}
              </div>

              {/* Evidence Section Preview */}
              {claim.evidence.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">
                    Certified Primary Citations ({claim.evidence.length})
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {claim.evidence.slice(0, 4).map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-300">{ev.sourceName}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            {ev.stance}
                          </span>
                        </div>
                        {ev.title && (
                          <p className="text-slate-400 text-[11px] line-clamp-1">{ev.title}</p>
                        )}
                        {ev.url && (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 hover:underline inline-flex items-center gap-1 text-[11px] max-w-full truncate pt-0.5"
                          >
                            <span>{ev.url}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* View Full Report Link */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">Language: {claim.language.toUpperCase()}</span>
                <Link
                  href={`/claims/${claim.id}`}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-1"
                >
                  <span>{t.common.viewReport}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
