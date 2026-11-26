"use client";

import React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Flame,
  Scale,
  Users,
  BrainCircuit,
  ArrowUpRight,
  Info,
  TrendingUp,
} from "lucide-react";
import { VerdictChart } from "./verdict-chart";
import { TopicChart } from "./topic-chart";
import { StateChart } from "./state-chart";
import { useLanguage } from "@/lib/i18n/context";
import Link from "next/link";

export function AnalyticsView({ stats }) {
  const { t } = useLanguage();

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Public Transparency Dashboard &bull; Live DB Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
            {t.analytics.pageTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            {t.analytics.pageSubtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/claims"
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span>{t.nav.publicClaims}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/methodology"
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1.5 transition-all"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{t.nav.methodology}</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>{t.analytics.verifiedClaims}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-100">
            {stats.publishedClaims}
          </div>
          <p className="text-[11px] text-slate-400">
            Out of <span className="font-mono text-slate-200">{stats.totalClaims}</span> atomic claims extracted
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>{t.analytics.aiHumanAgreement}</span>
            <BrainCircuit className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-blue-400">
            {stats.aiHumanAgreementRate}%
          </div>
          <p className="text-[11px] text-slate-400">
            <span className="font-mono text-emerald-400">{stats.totalReviewed - stats.overriddenCount}</span> agreed &bull;{" "}
            <span className="font-mono text-amber-400">{stats.overriddenCount}</span> reviewer overrides
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>{t.analytics.avgReviewTime}</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-purple-400">
            ~{stats.avgReviewTimeMinutes}m
          </div>
          <p className="text-[11px] text-slate-400">
            From ingestion to accredited publication
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>{t.analytics.viralIncidents}</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-rose-400">
            {stats.viralIncidents}
          </div>
          <p className="text-[11px] text-slate-400">
            Spikes with &ge; 3 repeat submissions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-400" />
              <span>{t.analytics.verdictDistributionTitle}</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              {stats.publishedClaims} verified
            </span>
          </div>
          <VerdictChart data={stats.verdictDistribution} />
        </div>

        <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>{t.analytics.trendingTopicsTitle}</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Top Election Subjects
            </span>
          </div>
          <TopicChart data={stats.trendingTopics} />
        </div>

        <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              <span>{t.analytics.geographicBreakdownTitle}</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Jurisdiction Spread
            </span>
          </div>
          <StateChart data={stats.claimsByState} />
        </div>

        <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 space-y-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-amber-400" />
                <span>{t.analytics.agreementInsightsTitle}</span>
              </h2>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {stats.aiHumanAgreementRate}% Concordance
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              In accordance with our <strong>Mandatory Human-in-the-Loop (HITL)</strong> governance contract, AI does not publish claims autonomously. When AI evidence grounding concurs with accredited human fact-checkers, claims receive 1-click authorization. When evidence is ambiguous or context is missed, human reviewers override the verdict with documented justification notes.
            </p>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Concordant AI Predictions</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {stats.totalReviewed - stats.overriddenCount} ({stats.aiHumanAgreementRate}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, stats.aiHumanAgreementRate)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-300">Reviewer Overrides (Reasoned Corrections)</span>
                <span className="font-mono text-amber-400 font-bold">
                  {stats.overriddenCount} ({stats.totalReviewed > 0 ? (100 - stats.aiHumanAgreementRate).toFixed(1) : 0}%)
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Users className="w-4 h-4 text-blue-400" />
              <span>Editorial Governance Team</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Currently maintained by <span className="text-white font-mono font-bold">{stats.activeReviewers}</span> accredited human reviewers and system administrators adhering to the Election Commission of India (ECI) verification standards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
