import type { NextConfig } from "next";

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
  
  // 添加内容安全策略 (CSP)
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
      ],
    },
  ],
};

export default nextConfig;