import type { NextConfig } from "next";
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development", 
});

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === "true" 
    ? "standalone" 
    : (process.env.VERCEL ? undefined : "export"),
  compress: true,
  images: {
    unoptimized: true,
  },
};

export default withPWA(nextConfig);