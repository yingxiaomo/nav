import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING = "1";

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
    // 使用时间戳作为默认构建ID，确保每次部署生成不同的缓存键
    return process.env.BUILD_ID || `build-${Date.now().toString(36)}`;
  },
  
  // Turbopack configuration
  turbopack: {},
  
  // 开发环境：将 /api/v1 代理到后端，避免浏览器跨域问题
  ...(isExportMode && !process.env.VERCEL && !process.env.DOCKER_BUILD ? {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8642/api/:path*',
        },
      ];
    },
  } : {}),

  // 添加内容安全策略 (CSP) 和 CDN缓存策略 - 仅在非export模式下生效
  ...(!isExportMode && {
    headers: async () => [
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: "/icon/(.*)",
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              // 'unsafe-inline' 是 Next.js hydration 和 PWA 注册所必需的
              // TODO: 未来可考虑迁移到 nonce-based CSP 以增强安全性
              `script-src 'self' 'unsafe-inline'${!isProduction ? " 'unsafe-eval'" : ""} https://fonts.googleapis.com https://api.github.com https://*.vercel.com https://cdnjs.cloudflare.com https://static.cloudflareinsights.com`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
              // img-src: GitHub avatars/raw, Imgur, Cloudflare, Vercel, favicon API
              "img-src 'self' data: https://raw.githubusercontent.com https://avatars.githubusercontent.com https://*.githubusercontent.com https://*.imgur.com https://*.cloudflare.com https://*.vercel.com https://iconapi.396638.xyz",
              "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
              "connect-src 'self' https://api.github.com https://*.githubusercontent.com https://api.dropboxapi.com https://www.googleapis.com https://iconapi.396638.xyz http://localhost:* http://127.0.0.1:*",
              "form-action 'self'",
              "frame-src 'self'"
            ].join(";")
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

// PWA 配置 - 使用 @serwist/next
// skipWaiting 和 clientsClaim 在 app/sw.ts 中配置
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: !isProduction || isExportMode,
  register: true,
});

export default withSerwist(nextConfig);
