"use client";

import {
  BookOpen,
  AlertTriangle,
  Scale,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Lock,
  Globe2,
  Eye,
  BrainCircuit,
  Info,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

export default function MethodologyPage() {
  const { t } = useLanguage();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Page Title & Intro */}
      <div className="space-y-4 border-b border-slate-800 pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400">
          <BookOpen className="w-3.5 h-3.5" />
          <span>System Transparency, Ethics & Limitations</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-100">
          {t.methodology.pageTitle}
        </h1>
        <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-3xl">
          {t.methodology.pageSubtitle}
        </p>
      </div>

      {/* Prominent Disclaimer Banner */}
      <div className="p-6 rounded-xl bg-amber-950/30 border border-amber-800/60 text-slate-300 space-y-2">
        <div className="flex items-center gap-2.5 text-amber-300 font-bold text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>{t.methodology.disclaimerTitle}</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {t.methodology.disclaimerContent}
        </p>
      </div>

      {/* Non-Partisanship & Algorithmic Ethics Charter */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3 text-slate-100">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{t.methodology.ethicsNoteTitle}</h2>
            <p className="text-xs text-slate-400">Core commitment to impartial, evidence-bound verification</p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          {t.methodology.ethicsNoteContent}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="font-semibold text-blue-400 block">Zero Political Bias</span>
            <span className="text-slate-400 text-[11px]">Identical criteria applied across all parties, candidates, and electoral alliances.</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="font-semibold text-emerald-400 block">Strict Evidence Citation</span>
            <span className="text-slate-400 text-[11px]">Every verdict requires explicit citations of verifiable URLs and primary gazettes.</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="font-semibold text-purple-400 block">Transparent Audit Trail</span>
            <span className="text-slate-400 text-[11px]">All AI suggestions, human overrides, and administrative actions are logged immutably.</span>
          </div>
        </div>
      </section>

      {/* Pillar 1: Mandatory Human-In-The-Loop */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3 text-slate-100">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">1. Mandatory Human-In-The-Loop (HITL) Architecture</h2>
            <p className="text-xs text-slate-400">AI assists; accredited human fact-checkers decide</p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Artificial intelligence models do not possess editorial autonomy in SatyaVote AI. Every AI-evaluated submission lands in the provisional state of <code className="text-amber-400 font-mono bg-slate-950 px-1.5 py-0.5 rounded">AI_SUGGESTED</code>. It is invisible to the public database until an accredited fact-checker reviews the supporting evidence, assesses context, and issues an explicit <strong className="text-white">Approve</strong> or reasoned <strong className="text-amber-400">Override</strong>.
        </p>
      </section>

      {/* Pillar 2: Strict Verdict Taxonomy */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3 text-slate-100">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">2. Strict 4-Tier Verdict Taxonomy</h2>
            <p className="text-xs text-slate-400">Clear, unambiguous categories mapped to evidence grounding</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">SUPPORTED</span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded">Truthful</span>
            </div>
            <p className="text-xs text-slate-300">
              The claim is directly confirmed by official ECI circulars, statutory election manuals, or corroborated across multiple accredited news organizations.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wide">CONTRADICTED</span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded">False / Debunked</span>
            </div>
            <p className="text-xs text-slate-300">
              Directly refuted by official ECI notices, state Chief Electoral Officer clarifications, or PIB Fact Check rebuttals.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">MISLEADING</span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded">Deceptive Context</span>
            </div>
            <p className="text-xs text-slate-300">
              Contains factual footage or dates cropped out of context, recycled older elections, or manipulated headlines designed to mislead voters.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">UNVERIFIED</span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded">Inconclusive</span>
            </div>
            <p className="text-xs text-slate-300">
              Insufficient authoritative evidence available in real-time. By hard rule, the platform falls back to unverified rather than guessing or hallucinating.
            </p>
          </div>
        </div>
      </section>

      {/* Pillar 3: Indian Election Authority Hierarchy */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3 text-slate-100">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">3. Indian Electoral Source Credibility Hierarchy</h2>
            <p className="text-xs text-slate-400">Precedence order of authoritative documentation</p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          In evaluating claims regarding Indian elections, evidence is evaluated in tiered priority:
        </p>
        <div className="space-y-3 pt-1 text-xs">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 font-mono text-[10px] font-bold shrink-0">TIER 1 (OFFICIAL)</span>
            <p className="text-slate-300 leading-relaxed">
              <strong>Election Commission of India (eci.gov.in) & State CEOs:</strong> Voter roll rules, candidate affidavit portals, Returning Officer handbooks, and Model Code of Conduct orders.
            </p>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] font-bold shrink-0">TIER 1 (FACT-CHECK)</span>
            <p className="text-slate-300 leading-relaxed">
              <strong>PIB Fact Check (pib.gov.in) & IFCN Signatories:</strong> Official debunks issued by the Government of India and accredited independent fact-checking consortia.
            </p>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-400 font-mono text-[10px] font-bold shrink-0">TIER 2 (ESTABLISHED MEDIA)</span>
            <p className="text-slate-300 leading-relaxed">
              <strong>National News Outlets & Wire Services (PTI, ANI):</strong> On-ground reporting, election press briefings, and live counting room updates.
            </p>
          </div>
        </div>
      </section>

      {/* Pillar 4: Multilingual & Multimodal Handling */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3 text-slate-100">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">4. Multilingual Processing & Original Text Preservation</h2>
            <p className="text-xs text-slate-400">English, Hindi (हिन्दी), Punjabi (ਪੰਜਾਬੀ) support</p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Indian election disinformation predominantly circulates in regional languages across private messaging apps. SatyaVote AI identifies source languages automatically, translates text for cross-database evidence matching, and always preserves the original verbatim language alongside the normalized analysis.
        </p>
      </section>

      {/* Pillar 5: Stated Limitations */}
      <section className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3 text-rose-300">
          <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">5. Stated Technical & Systemic Limitations</h2>
            <p className="text-xs text-slate-400">Transparent boundaries of automated assistance</p>
          </div>
        </div>
        <ul className="text-xs sm:text-sm text-slate-300 space-y-3 list-disc list-inside ml-1">
          <li>
            <strong>Sarcasm, Satire, & Colloquialisms:</strong> Satirical memes or regional slang may mislead automated entailment engines. Reviewers inspect full cultural contexts.
          </li>
          <li>
            <strong>Zero-Hallucination Guardrail:</strong> When evidence is absent, the AI model is forbidden from using internalized priors to speculate. It will always return <code className="text-slate-300 font-mono">UNVERIFIED</code>.
          </li>
          <li>
            <strong>Opinions & Subjective Predictions:</strong> Political rhetoric, rally attendance debates, and speculative predictions are flagged as <span className="text-purple-400 font-mono">NOT_CHECKABLE</span> and excluded from factual verdicts.
          </li>
          <li>
            <strong>Privacy & Redaction:</strong> When processing forwarded ballot images or voter IDs, EXIF GPS coordinates and personal voter identifiers are stripped to protect voter secrecy.
          </li>
        </ul>
      </section>
    </div>
  );
}
