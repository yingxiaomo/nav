import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "Clean Nav - 极简 Homelab 导航与仪表盘 | 个人主页",
    template: "%s | Clean Nav",
  },
  description: "Clean Nav 是一个专为 Homelab 打造的极速个人导航页与轻量级服务器管理面板。Go + React 重构，15MB Docker 镜像。支持书签管理、内网服务监控、Docker 容器控制、多端数据同步、自定义壁纸。开源免费，隐私安全。",

  keywords: [
    "Nav", "导航页", "起始页", "浏览器主页", "极简导航", "好看的导航",
    "开源项目", "Next.js", "React", "Tailwind CSS", "Go",
    "Homelab", "Dashboard", "Startpage", "服务器监控", "Docker管理",
    "书签管理", "个人主页", "自部署", "Serverless", "Vercel",
    "self-hosted", "navigation dashboard", "homelab dashboard"
  ],

  authors: [{ name: "XiaoMo", url: "https://nav.ovoxo.cc" }],
  creator: "XiaoMo",
  publisher: "XiaoMo",

  alternates: {
    canonical: "https://nav.ovoxo.cc",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://nav.ovoxo.cc",
    title: "Clean Nav - 极简 Homelab 导航与仪表盘",
    description: "轻量级自部署导航页 | 内网监控 | Docker 管理 | 多端同步。Go + React 重构，15MB 镜像，毫秒级响应。",
    siteName: "Clean Nav",
    images: [
      {
        url: "https://nav.ovoxo.cc/og-image.png",
        width: 1200,
        height: 630,
        alt: "Clean Nav 预览图",
        type: "image/png",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Clean Nav - 极简 Homelab 导航与仪表盘",
    description: "轻量级自部署导航页 | 内网监控 | Docker 管理 | 多端同步。",
    images: ["https://nav.ovoxo.cc/og-image.png"],
    creator: "@XiaoMo",
  },

  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/icon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "android-chrome-192x192", url: "/android-chrome-192x192.png" },
      { rel: "android-chrome-512x512", url: "/android-chrome-512x512.png" },
    ],
  },

  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Clean Nav" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.github.com" crossOrigin="anonymous" />
        {/* CSP 由 next.config.ts 的 headers() 统一管理，仅在非 export 模式下生效 */}
        {/* 静态导出模式下如需 CSP，请在托管平台（Vercel/Cloudflare）的自定义响应头中配置 */}
        {/* 注意：各组件自行管理 contextmenu 事件（如 SystemStatusFloater） */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {/* 跳转到主内容的链接 — 键盘用户专用 */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          跳转到主内容
        </a>
        {children}
      </body>
    </html>
  );
}
