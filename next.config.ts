import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    'pdf-parse',
    'chromadb',
    '@xenova/transformers',
    'onnxruntime-node',
  ],
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude native modules from server bundle
      config.externals = config.externals || [];
      config.externals.push('chromadb', '@xenova/transformers', 'onnxruntime-node');
    }
    return config;
  },
};

export default nextConfig;
