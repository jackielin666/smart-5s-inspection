import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "五惠智慧環境5S巡檢系統",
  description: "品保部門每日環境 5S/GMP 巡檢：拍照、缺失追蹤、PDF 報表",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  // iOS 加入主畫面後以獨立視窗開啟（類 App 體驗）
  appleWebApp: { capable: true, statusBarStyle: "default", title: "5S巡檢" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 工廠現場手機操作：避免誤觸縮放
  maximumScale: 1,
  themeColor: "#7a1a1d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
