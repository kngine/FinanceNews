import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // jsdom (and Readability) rely on dynamic requires that break when bundled
  // into serverless functions. Keep them external so the runtime loads them
  // from node_modules instead.
  serverExternalPackages: ["jsdom", "@mozilla/readability"],
};

export default nextConfig;
