import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "周报生成工具",
  description: "基于 Git 提交记录自动生成周报",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
          <a href="/" className="text-lg font-bold text-gray-900">周报工具</a>
          <a href="/repos" className="text-gray-600 hover:text-gray-900">仓库管理</a>
          <a href="/generate" className="text-gray-600 hover:text-gray-900">生成周报</a>
          <a href="/settings" className="text-gray-600 hover:text-gray-900">设置</a>
        </nav>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
