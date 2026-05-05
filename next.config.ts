/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,  // Skip type checking en build
  },
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint en build
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'class-variance-authority'], // Next 15 opt
  },
}

module.exports = nextConfig;
