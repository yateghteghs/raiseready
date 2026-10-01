/**
 * Security headers for every response (spec section 8).
 *
 * The browser only talks to this app and the Supabase project (sign-in state,
 * direct uploads to Storage, and signed links to profile pictures and logos). Paystack is reached by a full-page redirect,
 * which CSP doesn't restrict. Next.js inlines small bootstrap scripts, and
 * nonces would make every page dynamic, so scripts allow 'unsafe-inline';
 * the other directives still block third-party scripts, framing, plugins and
 * form posts elsewhere.
 */
export function contentSecurityPolicy({ supabaseUrl, dev }: { supabaseUrl?: string; dev: boolean }): string {
  const connect = ["'self'"];
  const images = ["'self'", "data:", "blob:"];
  const supabase = originOf(supabaseUrl);
  if (supabase) {
    connect.push(supabase, supabase.replace(/^http/, "ws"));
    images.push(supabase);
  }
  if (dev) connect.push("ws:");

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": images,
    "font-src": ["'self'", "data:"],
    "connect-src": connect,
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  const policy = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function securityHeaders(options: { supabaseUrl?: string; dev: boolean }) {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
