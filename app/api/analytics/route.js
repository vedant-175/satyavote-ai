import { NextResponse } from "next/server";
import { getLiveAnalytics } from "@/lib/analytics/stats";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics
 * Live statistical dashboard metrics across verified claims, topics, and reviewers.
 * Module 4: Human Review & Public Reporting - Ayush
 */
export async function GET() {
  try {
    const stats = await getLiveAnalytics();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: stats,
    });
  } catch (error) {
    console.error("[Analytics API Error]:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve analytics metrics" },
      { status: 500 }
    );
  }
}
