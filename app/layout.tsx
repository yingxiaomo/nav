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
    default: "Clean Nav - 极简风格导航页 | 开发者起始页",
    template: "%s | Clean Nav",
  },
  description: "Clean Nav 是一个基于 Next.js + Tailwind CSS 构建的极简、免费开源浏览器主页。支持 GitHub 账号直接登录同步数据，无需服务器数据库。具备拖拽排序、自定义壁纸、书签导入等功能。",

  keywords: [
    "Nav", "导航页", "起始页", "浏览器主页", "极简导航", "好看的导航",
    "开源项目", "Next.js", "React", "Tailwind CSS", "GitHub API",
    "Serverless", "静态网站", "Vercel", "书签管理", "Dashboard", "Startpage"
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
    title: "Clean Nav - 极简风格导航页",
    description: "免费、开源、无服务器。利用 GitHub API 同步数据的极简浏览器主页。",
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
    title: "Clean Nav - 极简风格导航页",
    description: "支持拖拽排序与 GitHub 数据同步的极简起始页。",
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
        <meta httpEquiv="Content-Security-Policy" content={`default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ""} https://fonts.googleapis.com https://api.github.com https://*.vercel.com https://cdnjs.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; img-src 'self' data: https://*.githubusercontent.com https://*.imgur.com https://*.cloudflare.com https://*.vercel.com https://raw.githubusercontent.com https://iconapi.396638.xyz https://icons.duckduckgo.com https://bing.img.run https://source.unsplash.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; connect-src 'self' https://api.github.com https://*.githubusercontent.com https://api.dropboxapi.com https://www.googleapis.com https://iconapi.396638.xyz http://localhost:* http://127.0.0.1:*; form-action 'self'; frame-src 'self'`} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {children}
      </body>
    </html>
  );
}
