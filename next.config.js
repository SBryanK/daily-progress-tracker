/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // xlsx is a large CJS module; keep it out of the server bundle.
  serverExternalPackages: ["xlsx", "jspdf", "jspdf-autotable"],
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  devIndicators: false
};

module.exports = nextConfig;
