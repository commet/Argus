import type { NextConfig } from "next";

// CSP is set dynamically in middleware.ts (nonce-based, per-request).
// Only non-CSP security headers live here.
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  async redirects() {
    // Canonical-host guard. The Vercel project ("overture") also serves on its
    // default *.vercel.app alias, so an auth round-trip or a stale/bookmarked
    // link can strand users on overture-beta.vercel.app instead of the custom
    // domain — the URL then "sticks" because every relative nav keeps that host.
    // 308 the production alias to argus.voyage (path + query preserved).
    //
    // Scoped to the EXACT production alias on purpose: matching all *.vercel.app
    // would also catch PR preview deploys (overture-git-*.vercel.app) and break
    // them. NOTE: the root cause is Supabase Auth "Site URL" pointing at the
    // vercel.app host — fix that in the Supabase dashboard too; this is a net.
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'overture-beta.vercel.app' }],
        destination: 'https://argus.voyage/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
