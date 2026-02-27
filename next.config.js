/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  allowedDevOrigins: [
    "https://enhancement-scenarios-purchase-has.trycloudflare.com",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
}

module.exports = nextConfig
