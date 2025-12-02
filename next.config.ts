import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pdf-parse', 'chromadb'],
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude chromadb from client bundle
      config.externals = config.externals || [];
      config.externals.push('chromadb');
    }
    return config;
  },
};

export default nextConfig;
