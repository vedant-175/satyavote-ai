import { NextRequest } from "next/server";

interface RateLimitRecord {
  tokens: number;
  lastRefill: number;
}

// In-memory token bucket store with automatic expiration
const memoryStore = new Map<string, RateLimitRecord>();

// Clean up expired buckets periodically (every 5 minutes)
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      if (now - record.lastRefill > 10 * 60 * 1000) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (typeof cleanupTimer.unref === "function") {
    cleanupTimer.unref();
  }
}

export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Extracts client IP address from Next.js request headers.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "127.0.0.1";
}

/**
 * Token-bucket sliding window rate limiter.
 * Tracks requests per identifier (IP or User ID).
 */
export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { limit: 10, windowSeconds: 60 }
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = options;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const key = `rate_limit:${identifier}`;
  const record = memoryStore.get(key);

  if (!record) {
    memoryStore.set(key, {
      tokens: limit - 1,
      lastRefill: now,
    });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetAt: now + windowMs,
    };
  }

  // Calculate elapsed time and replenish tokens
  const elapsed = now - record.lastRefill;
  const tokensToAdd = Math.floor((elapsed / windowMs) * limit);

  if (tokensToAdd > 0) {
    record.tokens = Math.min(limit, record.tokens + tokensToAdd);
    record.lastRefill = now;
  }

  if (record.tokens > 0) {
    record.tokens -= 1;
    return {
      success: true,
      limit,
      remaining: record.tokens,
      resetAt: record.lastRefill + windowMs,
    };
  }

  // Rate limit exceeded
  return {
    success: false,
    limit,
    remaining: 0,
    resetAt: record.lastRefill + windowMs,
  };
}
