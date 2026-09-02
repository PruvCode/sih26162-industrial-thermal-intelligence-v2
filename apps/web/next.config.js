/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
