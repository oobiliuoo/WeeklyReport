import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "周报生成工具",
  description: "基于 Git 提交记录自动生成周报",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <nav className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-8">
            <a href="/" className="flex items-center gap-2.5 text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <span className="text-base font-semibold tracking-tight">WeeklyReport</span>
            </a>
            <div className="flex items-center gap-1">
              {[
                { href: "/", label: "周报" },
                { href: "/repos", label: "仓库" },
                { href: "/generate", label: "生成" },
                { href: "/settings", label: "设置" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
