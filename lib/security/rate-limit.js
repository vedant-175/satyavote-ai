// In-memory token bucket store with automatic expiration
const memoryStore = new Map();

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

/**
 * Extracts client IP address from Next.js request headers.
 */
export function getClientIp(req) {
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
  identifier,
  options = { limit: 10, windowSeconds: 60 }
) {
  const { limit, windowSeconds } = options;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const key = `rate_limit:${identifier}`;
  const record = memoryStore.get(key);

  if (!record) {
    memoryStore.set(key, { tokens: limit - 1, lastRefill: now });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetAt: now + windowMs,
    };
  }

  // Refill tokens proportionally based on elapsed time
  const elapsed = now - record.lastRefill;
  const tokensToAdd = (elapsed / windowMs) * limit;
  const currentTokens = Math.min(limit, record.tokens + tokensToAdd);

  if (currentTokens >= 1) {
    record.tokens = currentTokens - 1;
    record.lastRefill = now;
    return {
      success: true,
      limit,
      remaining: Math.floor(record.tokens),
      resetAt: now + windowMs,
    };
  }

  return {
    success: false,
    limit,
    remaining: 0,
    resetAt: now + Math.ceil(((1 - currentTokens) / limit) * windowMs),
  };
}
