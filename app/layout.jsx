import "./globals.css";
import { Navbar } from "@/components/navbar";
import { auth } from "@/auth";
import { LanguageProvider } from "@/lib/i18n/context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SatyaVote AI | Election Information Verification Platform",
  description:
    "AI-assisted election fact-checking and public information verification system with human-in-the-loop review, atomic claim extraction, and explainable multi-source evidence grounding.",
};

export default async function RootLayout({ children }) {
  const session = await auth();

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
        <LanguageProvider>
          <Navbar user={session?.user} />
          <main className="flex-1 flex flex-col">{children}</main>
        </LanguageProvider>
        <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-xs text-slate-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="font-semibold text-slate-300">SatyaVote AI</span> &bull; AI-Assisted Election Information Verification Platform
            </div>
            <div className="flex items-center gap-6 text-slate-400">
              <a href="/methodology" className="hover:text-slate-200 transition-colors">
                Methodology & Limitations
              </a>
              <a href="/claims" className="hover:text-slate-200 transition-colors">
                Public Database
              </a>
              <span>ECI Context (English &bull; Hindi &bull; Punjabi)</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
