import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Evidence photos are served from short-lived signed Supabase Storage URLs.
  // next/image cannot cache-key an expiring query string, so the optimiser
  // would serve stale bytes or 404. We render a plain <img> instead, and the
  // browser already produced a 320px thumbnail alongside the full image.
  images: { unoptimized: true },

  // postgres.js must stay outside the bundler so its native/streaming code is
  // not traced into the serverless bundle.
  serverExternalPackages: ["postgres"],

  experimental: {
    // Server Actions are only used for small JSON mutations. The photo upload
    // is a Route Handler with a signed direct-to-Storage PUT, so it never
    // passes through a function body at all.
    serverActions: { bodySizeLimit: "2mb" },
  },

  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
