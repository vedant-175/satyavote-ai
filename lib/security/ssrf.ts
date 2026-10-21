import dns from "dns/promises";
import net from "net";

export interface SsrfValidationResult {
  valid: boolean;
  reason?: string;
  normalizedUrl?: string;
  resolvedIp?: string;
}

/**
 * Checks if an IPv4 address is within private, loopback, or reserved IP blocks.
 */
function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // invalid IP treated as unsafe
  }

  const [a, b] = parts;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (Private)
  if (a === 10) return true;

  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-local & Cloud Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 100.64.0.0/10 (Carrier grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 192.0.0.0/24, 192.0.2.0/24 (Documentation / Test-net)
  if (a === 192 && b === 0) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && parts[2] === 113) return true;

  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (a >= 224) return true;

  return false;
}

/**
 * Checks if an IPv6 address is loopback, unique local, or link-local.
 */
function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // ::1 loopback
  if (normalized === "::1" || normalized === "0000:0000:0000:0000:0000:0000:0000:0001") return true;

  // :: unspecified
  if (normalized === "::") return true;

  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (normalized.startsWith("::ffff:")) {
    const ipv4Part = normalized.slice(7);
    if (net.isIPv4(ipv4Part)) {
      return isPrivateOrReservedIpv4(ipv4Part);
    }
  }

  // fc00::/7 (Unique Local Address)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  // fe80::/10 (Link-Local)
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }

  return false;
}

/**
 * Validates a user-supplied URL against Server-Side Request Forgery (SSRF).
 * Blocks private IP ranges, localhost, cloud metadata endpoints, non-http(s) schemes.
 */
export async function validateUrlForSsrf(urlString: string): Promise<SsrfValidationResult> {
  if (!urlString || typeof urlString !== "string") {
    return { valid: false, reason: "URL string is required." };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, reason: "Malformed or invalid URL format." };
  }

  // 1. Enforce scheme: only http and https allowed
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      reason: `Unsupported URL protocol '${parsed.protocol}'. Only HTTP and HTTPS are permitted.`,
    };
  }

  // 2. Reject credentials in URL
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      reason: "URLs with embedded username or password credentials are not permitted.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Block literal local / metadata hostnames
  const blockedHostnames = new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "metadata.google.internal",
    "instance-data",
  ]);

  if (blockedHostnames.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return {
      valid: false,
      reason: `Blocked target host '${hostname}' (forbidden internal or loopback address).`,
    };
  }

  // 4. Resolve DNS to ensure the hostname does not map to private IPs
  try {
    const lookup = await dns.lookup(hostname, { all: true });

    if (!lookup || lookup.length === 0) {
      return { valid: false, reason: `Failed to resolve domain name '${hostname}'.` };
    }

    for (const record of lookup) {
      const { address, family } = record;
      if (family === 4 && isPrivateOrReservedIpv4(address)) {
        return {
          valid: false,
          reason: `Target host '${hostname}' resolves to private/restricted IPv4 (${address}).`,
          resolvedIp: address,
        };
      }
      if (family === 6 && isPrivateOrReservedIpv6(address)) {
        return {
          valid: false,
          reason: `Target host '${hostname}' resolves to private/restricted IPv6 (${address}).`,
          resolvedIp: address,
        };
      }
    }

    return {
      valid: true,
      normalizedUrl: parsed.toString(),
      resolvedIp: lookup[0]?.address,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      reason: `DNS lookup failed for '${hostname}': ${message}`,
    };
  }
}

/**
 * SSRF-Safe fetch wrapper with timeout and max size controls.
 */
export async function safeFetch(
  urlString: string,
  options: { timeoutMs?: number; maxBytes?: number; headers?: Record<string, string> } = {}
): Promise<{ status: number; text: string; contentType: string }> {
  const { timeoutMs = 8000, maxBytes = 5 * 1024 * 1024, headers = {} } = options;

  const validation = await validateUrlForSsrf(urlString);
  if (!validation.valid) {
    throw new Error(`SSRF Guard Blocked Request: ${validation.reason}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(urlString, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SatyaVote-FactCheck-Crawler/1.0 (+https://electionverify.org/methodology)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        ...headers,
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      throw new Error(`Response exceeds maximum size limit of ${maxBytes} bytes.`);
    }

    const text = await response.text();
    if (text.length > maxBytes) {
      throw new Error(`Payload length (${text.length} bytes) exceeds limit of ${maxBytes} bytes.`);
    }

    return {
      status: response.status,
      text,
      contentType,
    };
  } finally {
    clearTimeout(timer);
  }
}
