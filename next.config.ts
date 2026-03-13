import type { NextConfig } from "next";
import withPWA from "next-pwa";

const isExportMode = process.env.DOCKER_BUILD !== "true" && !process.env.VERCEL;
const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === "true" 
    ? "standalone" 
    : (process.env.VERCEL ? undefined : "export"),
    
  compress: true,
  images: {
    unoptimized: true,
  },
  
  // Performance optimizations
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-*",
      "@dnd-kit/*",
      "framer-motion",
      "zustand"
    ],
  },
  
  // Build optimization
  productionBrowserSourceMaps: false,
  
  // 静态资源优化
  generateBuildId: async () => {
    // 使用固定的构建ID，除非有环境变量指定
    return process.env.BUILD_ID || 'development';
  },
  
  // Turbopack configuration
  turbopack: {},
  
  // 添加内容安全策略 (CSP) 和 CDN缓存策略 - 仅在非export模式下生效
  ...(!isExportMode && {
    headers: async () => [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://api.github.com https://*.vercel.com https://cdnjs.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
              "img-src 'self' data: https://*.githubusercontent.com https://*.imgur.com https://*.cloudflare.com https://*.vercel.com https://raw.githubusercontent.com",
              "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
              "connect-src 'self' https://api.github.com https://*.githubusercontent.com https://api.dropboxapi.com https://www.googleapis.com",
              "form-action 'self'",
              "frame-src 'self'"
            ].join(";")
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ],
  }),
};

// PWA配置
const pwaConfig = {
  dest: "public",
  disable: !isProduction || isExportMode,
  register: true,
  skipWaiting: true,
  buildExcludes: [/app-build-manifest\.json$/],
};

export default withPWA(pwaConfig)(nextConfig);