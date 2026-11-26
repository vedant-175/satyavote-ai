import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/claims
 * Public claims catalog with search, filtering, and pagination.
 * Only reviewer-approved claims are publicly accessible.
 * Module 4: Human Review & Public Reporting - Ayush
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const verdict = searchParams.get("verdict");
    const topic = searchParams.get("topic");
    const state = searchParams.get("state");
    const language = searchParams.get("language");
    const sort = searchParams.get("sort") || "recency";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const where = {
      finalVerdict: { not: null },
      publishedAt: { not: null },
    };

    if (verdict && verdict !== "ALL") {
      where.finalVerdict = verdict;
    }
    if (topic && topic !== "ALL") {
      where.topic = topic;
    }
    if (state && state !== "ALL") {
      where.state = state;
    }
    if (language && language !== "ALL") {
      where.language = language;
    }
    if (search) {
      where.OR = [
        { text: { contains: search, mode: "insensitive" } },
        { originalText: { contains: search, mode: "insensitive" } },
        { finalNote: { contains: search, mode: "insensitive" } },
        {
          evidence: {
            some: {
              OR: [
                { sourceName: { contains: search, mode: "insensitive" } },
                { title: { contains: search, mode: "insensitive" } },
                { snippet: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    let orderBy = { publishedAt: "desc" };
    if (sort === "viral") {
      orderBy = { repeatCount: "desc" };
    } else if (sort === "oldest") {
      orderBy = { publishedAt: "asc" };
    }

    const [total, claims] = await Promise.all([
      prisma.claim.count({ where }),
      prisma.claim.findMany({
        where,
        include: {
          submission: {
            select: { id: true, type: true, url: true, createdAt: true },
          },
          evidence: {
            orderBy: { createdAt: "asc" },
          },
          reviewedBy: {
            select: { name: true, role: true },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      status: "success",
      data: {
        claims,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load public claims catalog.";
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message } },
      { status: 500 }
    );
  }
}
