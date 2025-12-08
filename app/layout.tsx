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
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "Clean Nav - 极简 GitHub 风格导航页 | 开发者起始页",
    template: "%s | Clean Nav",
  },
  description: "Clean Nav 是一个基于 Next.js + Tailwind CSS 构建的极简、免费开源浏览器主页。支持 GitHub 账号直接登录同步数据，无需服务器数据库。具备拖拽排序、自定义壁纸、书签导入等功能。",
  
  keywords: [
    "Clean Nav", "导航页", "起始页", "浏览器主页", "极简导航", "好看的导航", 
    "开源项目", "Next.js", "React", "Tailwind CSS", "GitHub API", 
    "Serverless", "静态网站", "Vercel", "书签管理", "Dashboard", "Startpage"
  ],
  
  authors: [{ name: "XiaoMo", url: "https://nav.ovoxo.cc" }],
  creator: "XiaoMo",
  

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  openGraph: {
    title: "Clean Nav - 极简 GitHub 风格导航页",
    description: "免费、开源、无服务器。利用 GitHub API 同步数据的极简浏览器主页。",
    url: "https://nav.ovoxo.cc",
    siteName: "Clean Nav",
    locale: "zh_CN",
    type: "website",
    images: [
      {
        url: "https://nav.ovoxo.cc/og-image.png", 
        width: 1200,
        height: 630,
        alt: "Clean Nav Preview",
      },
    ],
  },
  

  twitter: {
    card: "summary_large_image",
    title: "Clean Nav - 极简 GitHub 风格导航页",
    description: "支持拖拽排序与 GitHub 数据同步的极简起始页。",
    images: ["https://nav.ovoxo.cc/og-image.png"],
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  

};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}