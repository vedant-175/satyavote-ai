"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Link2,
  FileText,
  Image as ImageIcon,
  Send,
  Loader2,
  AlertCircle,
  UploadCloud,
  X,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

type TabType = "LINK" | "TEXT" | "IMAGE";

const PRESET_CLAIMS = [
  {
    label: "ECI Voter ID Myth (English)",
    lang: "en",
    text: "ECI has announced that citizens without physical voter ID cards cannot vote under any circumstances in the upcoming general elections.",
  },
  {
    label: "ईवीएम बैटरी दावा (Hindi)",
    lang: "hi",
    text: "सोशल मीडिया पर दावा किया जा रहा है कि 99% बैटरी वाली ईवीएम में पहले से वोट सेट किए गए हैं और केवल 74% बैटरी वाली निष्पक्ष हैं।",
  },
  {
    label: "ਵੋਟਰ ਸੂਚੀ ਨਿਯਮ (Punjabi)",
    lang: "pa",
    text: "ਦਾਅਵਾ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ ਕਿ ਜਿਨ੍ਹਾਂ ਵੋਟਰਾਂ ਕੋਲ ਆਧਾਰ ਕਾਰਡ ਨਹੀਂ ਹੈ, ਉਨ੍ਹਾਂ ਦੇ ਨਾਂ ਵੋਟਰ ਸੂਚੀ ਵਿੱਚੋਂ ਕੱਟ ਦਿੱਤੇ ਗਏ ਹਨ।",
  },
];

export default function SubmitPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>("LINK");
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [language, setLanguage] = useState("en");

  // Image Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle Drag & Drop
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessImage(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessImage(e.target.files[0]);
    }
  };

  const validateAndProcessImage = (file: File) => {
    setErrorMessage(null);
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024; // 5 MB

    if (!validTypes.includes(file.type)) {
      setErrorMessage("Invalid image format. Allowed formats: JPG, PNG, WEBP.");
      return;
    }

    if (file.size > maxSize) {
      setErrorMessage(`Image file is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 5 MB.`);
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side pre-validations
    if (activeTab === "LINK") {
      if (!url.trim()) {
        setErrorMessage("Please enter a valid URL to verify.");
        return;
      }
      try {
        const parsed = new URL(url.trim());
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          setErrorMessage("Only HTTP and HTTPS URLs are supported.");
          return;
        }
      } catch {
        setErrorMessage("Please enter a valid, well-formed URL.");
        return;
      }
    } else if (activeTab === "TEXT") {
      if (!rawText.trim() || rawText.trim().length < 5) {
        setErrorMessage("Claim text must be at least 5 characters long.");
        return;
      }
    } else if (activeTab === "IMAGE") {
      if (!imagePreview && !rawText.trim()) {
        setErrorMessage("Please select or drop an image to verify.");
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        type: activeTab,
        url: activeTab === "LINK" ? url.trim() : null,
        rawText: rawText.trim() || null,
        imageUrl: activeTab === "IMAGE" ? imagePreview : null,
        language,
      };

      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data?.error?.message || "Submission failed. Please check your inputs.");
        setLoading(false);
        return;
      }

      const submissionId = data?.data?.submissionId;
      if (submissionId) {
        router.push(`/result/${submissionId}`);
      } else {
        router.push("/claims");
      }
    } catch {
      setErrorMessage("Network error: failed to submit. Please check your connection.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Header */}
      <div className="space-y-2 border-b border-slate-800 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Multilingual Intake Engine</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
          Submit Election Information
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          Submit public news links, viral text, or election flyers for claim extraction, cross-source evidence grounding, and accredited human review.
        </p>
      </div>

      {/* Main Form Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        {/* Navigation Tabs: LINK, TEXT, IMAGE */}
        <div className="grid grid-cols-3 gap-2 p-1 rounded-lg bg-slate-950 border border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              setActiveTab("LINK");
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "LINK"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>Public Link</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("TEXT");
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "TEXT"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Text Claim</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("IMAGE");
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "IMAGE"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Image / Flyer</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* TAB 1: LINK SUBMISSION */}
          {activeTab === "LINK" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Public News or Social Media Article URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    placeholder="https://example.com/election-news-article"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enforces strict SSRF protections: private ranges, loopback, and cloud metadata targets are rejected.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Additional Notes or Context (Optional)
                </label>
                <textarea
                  rows={2}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Where did you see this link circulating? Any specific statement in question?"
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: TEXT SUBMISSION */}
          {activeTab === "TEXT" && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Claim Text or Viral Message
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {rawText.length} / 15,000 characters
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  required
                  placeholder="Paste viral claim text or speech quote in English, Hindi, or Punjabi..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 leading-relaxed"
                />
              </div>

              {/* Sample Quick Preset Pills */}
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 block mb-2">
                  Sample Election Claims (Click to test):
                </span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_CLAIMS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setRawText(preset.text);
                        setLanguage(preset.lang);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer text-left"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: IMAGE SUBMISSION */}
          {activeTab === "IMAGE" && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-slate-300">
                Election Poster, WhatsApp Screenshot, or Candidate Notice
              </label>

              {!imagePreview ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-blue-500 bg-blue-950/20"
                      : "border-slate-800 hover:border-slate-700 bg-slate-950/60"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 mx-auto mb-3">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-semibold text-slate-200">
                    Click to browse or drag and drop image here
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Supports JPG, PNG, WEBP (Max size: 5 MB)
                  </div>
                </div>
              ) : (
                <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-3">
                  <div className="relative max-h-72 overflow-hidden rounded-lg bg-black flex items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="Upload preview"
                      className="max-h-72 object-contain rounded"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/90 text-slate-300 hover:text-white border border-slate-700 hover:bg-rose-950 transition-colors"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span className="font-mono truncate max-w-xs">{imageFile?.name || "Uploaded Image"}</span>
                    <span>{imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB` : ""}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Image Context or Claim Summary (Optional)
                </label>
                <textarea
                  rows={2}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Provide any additional context regarding who circulated this image or where..."
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Language Selection */}
          <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-slate-300 block">Primary Language</span>
              <span className="text-[11px] text-slate-500">Language of submitted content</span>
            </div>
            <div className="flex items-center gap-2">
              {[
                { code: "en", label: "English" },
                { code: "hi", label: "हिन्दी (Hindi)" },
                { code: "pa", label: "ਪੰਜਾਬੀ (Punjabi)" },
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    language === lang.code
                      ? "bg-blue-600/30 text-blue-300 border-blue-500/50"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Ingesting Content & Enqueueing Pipeline...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit for Election Verification</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* HITL Disclaimer Note */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-200">Ethical Governance Notice:</strong> Submissions are ingested anonymously or tagged to your account if logged in. The verification pipeline extracts factual claims and retrieves authoritative ECI/PIB sources. Final verdicts are published only upon approval by an accredited human reviewer.
        </div>
      </div>
    </div>
  );
}
