import type { NextConfig } from "next";

import { securityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // PDF reports embed these fonts; make sure they ship with the routes that render PDFs.
  outputFileTracingIncludes: {
    "/app/reports": ["./lib/reports/fonts/*.ttf"],
    "/app/reports/*": ["./lib/reports/fonts/*.ttf"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, dev: process.env.NODE_ENV === "development" }) }];
  },
};

export default nextConfig;
