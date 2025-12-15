import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === "true" 
    ? "standalone" 
    : (process.env.VERCEL ? undefined : "export"),
    
  compress: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;