import { getLiveAnalytics } from "@/lib/analytics/stats";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analytics & Disinformation Trends | SatyaVote AI",
  description:
    "Live statistical dashboard displaying election claim verdict distribution, trending election topics, state-wise disinformation patterns, and AI-vs-human agreement metrics.",
};

export default async function AnalyticsPage() {
  const stats = await getLiveAnalytics();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      <AnalyticsView stats={stats} />
    </div>
  );
}
