import type { NextConfig } from "next";

import { securityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Profile pictures and logos (up to 2 MB) are sent through a Server Action.
    serverActions: { bodySizeLimit: "3mb" },
  },
  // PDF reports embed these fonts and the logo; make sure they ship with the routes that render PDFs.
  outputFileTracingIncludes: {
    "/app/reports": ["./lib/reports/fonts/*.ttf", "./lib/reports/assets/*.png"],
    "/app/reports/*": ["./lib/reports/fonts/*.ttf", "./lib/reports/assets/*.png"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, dev: process.env.NODE_ENV === "development" }) }];
  },
};

export default nextConfig;
