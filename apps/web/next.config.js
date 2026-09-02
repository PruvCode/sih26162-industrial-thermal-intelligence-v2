/** @type {import('next').NextConfig} */
const nextConfig = {
  // `output: 'standalone'` produces a self-contained server used by the
  // self-hosted Dockerfile (`node server.js`). Vercel manages its own build
  // output and a standalone build can interfere with it, so we only enable
  // it for container deploys — set STANDALONE_OUTPUT=1 in the Dockerfile.
  ...(process.env.STANDALONE_OUTPUT === '1' ? { output: 'standalone' } : {}),
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.maptiler.com' },
      { protocol: 'https', hostname: '**.tiles.mapbox.com' },
    ],
  },
  webpack: (config) => {
    config.externals.push('canvas');
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
