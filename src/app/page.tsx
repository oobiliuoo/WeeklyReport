"use client";

import { useEffect, useState } from "react";

interface Report {
  id: number;
  week_start: string;
  week_end: string;
  content: string;
  created_at: string;
}

export default function HomePage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((data) => {
        setReports(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此周报？")) return;
    await fetch(`/api/reports?id=${id}`, { method: "DELETE" });
    setReports(reports.filter((r) => r.id !== id));
  };

  const handleExport = async (id: number) => {
    const res = await fetch(`/api/reports?id=${id}&action=export`).then((r) => r.json());
    alert(`已导出到: ${res.filePath}`);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-10 animate-fade-in-up">
        <div>
          <p className="section-label">Weekly Report</p>
          <h1 className="page-title">周报</h1>
        </div>
        <a
          href="/generate"
          className="btn btn-primary"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          生成本周周报
        </a>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && reports.length === 0 && (
        <div className="animate-fade-in-up stagger-2">
          <div className="card p-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent-glow)] mb-6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <p className="text-[var(--text-secondary)] text-base mb-1">暂无周报</p>
            <p className="text-[var(--text-muted)] text-sm">点击上方按钮生成第一份周报</p>
          </div>
        </div>
      )}

      {/* Report list */}
      <div className="space-y-4">
        {reports.map((report, i) => (
          <div
            key={report.id}
            className={`card p-5 animate-fade-in-up stagger-${Math.min(i + 1, 8)}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-10 rounded-full bg-[var(--accent)]" />
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    {formatDate(report.week_start)} ~ {formatDate(report.week_end)}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {new Date(report.created_at).toLocaleString("zh-CN")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleExport(report.id)} className="btn-ghost">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  导出
                </button>
                <button onClick={() => handleDelete(report.id)} className="btn-ghost" style={{ color: "var(--danger)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  删除
                </button>
              </div>
            </div>
            <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap line-clamp-4 pl-4 border-l border-[var(--border-subtle)] font-mono leading-relaxed">
              {report.content.slice(0, 300)}{report.content.length > 300 ? "..." : ""}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
