import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    'pdf-parse',
    'chromadb',
    '@xenova/transformers',
    'onnxruntime-node',
    'pdfkit',
  ],
  // Include PDFKit font files in standalone output (required for PDF generation)
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/pdfkit/js/data/**/*'],
  },
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

export default withSerwist(nextConfig);
