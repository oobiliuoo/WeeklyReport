"use client";

import { useEffect, useState } from "react";

interface Report {
  id: number;
  week_start: string;
  week_end: string;
  content: string;
  created_at: string;
  members?: string[];
}

export default function HomePage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Report | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState<"week-desc" | "week-asc" | "created-desc">("week-desc");

  const [sending, setSending] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState<number | null>(null);

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
    setViewing(null);
  };

  const handleExport = async (id: number) => {
    const res = await fetch(`/api/reports?id=${id}&action=export`).then((r) => r.json());
    alert(`已导出到: ${res.filePath}`);
  };

  const handleDingTalk = async (id: number) => {
    setSending(id);
    try {
      const res = await fetch("/api/dingtalk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id }),
      });
      const data = await res.json();
      if (data.success) {
        alert("已推送到钉钉群");
      } else {
        alert(`推送失败: ${data.error}`);
      }
    } catch {
      alert("推送失败，请检查网络");
    }
    setSending(null);
  };

  const handleRegenerate = async (id: number) => {
    if (!confirm("将重新查询提交记录并覆盖当前周报内容，确定继续？")) return;
    setRegenerating(id);
    try {
      const res = await fetch(`/api/reports?id=${id}&action=regenerate`);
      const data = await res.json();
      if (data.error) {
        alert(`重新生成失败: ${data.error}`);
      } else {
        const updated = { ...data };
        setReports(reports.map((r) => (r.id === id ? updated : r)));
        if (viewing?.id === id) setViewing(updated);
        alert("重新生成完成");
      }
    } catch {
      alert("重新生成失败，请检查网络");
    }
    setRegenerating(null);
  };

  const startEdit = () => {
    setEditContent(viewing!.content);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditContent("");
  };

  const handleSave = async () => {
    if (!viewing) return;
    setSaving(true);
    const res = await fetch("/api/reports", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: viewing.id, content: editContent }),
    });
    const updated = await res.json();
    setReports(reports.map((r) => (r.id === viewing.id ? { ...r, content: editContent } : r)));
    setViewing({ ...viewing, content: editContent });
    setEditing(false);
    setEditContent("");
    setSaving(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const sortOptions: Record<string, { label: string; fn: (a: Report, b: Report) => number }> = {
    "week-desc": { label: "周次 ↓", fn: (a, b) => b.week_start.localeCompare(a.week_start) },
    "week-asc": { label: "周次 ↑", fn: (a, b) => a.week_start.localeCompare(b.week_start) },
    "created-desc": { label: "生成时间 ↓", fn: (a, b) => b.created_at.localeCompare(a.created_at) },
  };

  const sortedReports = [...reports].sort(sortOptions[sortBy].fn);

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-10 animate-fade-in-up">
        <div>
          <p className="section-label">Weekly Report</p>
          <h1 className="page-title">周报</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-[var(--border-subtle)] overflow-hidden">
            {Object.entries(sortOptions).map(([key, opt]) => (
              <button
                key={key}
                onClick={() => setSortBy(key as typeof sortBy)}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${
                  sortBy === key
                    ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] bg-transparent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <a href="/generate" className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            生成本周周报
          </a>
        </div>
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
        {sortedReports.map((report, i) => (
          <div
            key={report.id}
            className={`card p-5 animate-fade-in-up stagger-${Math.min(i + 1, 8)} cursor-pointer`}
            onClick={() => { setViewing(report); setEditing(false); }}
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
                  {report.members && report.members.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      <span className="text-xs text-[var(--text-muted)]">{report.members.join("、")}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => handleDingTalk(report.id)} disabled={sending === report.id} className="btn-ghost" title="推送到钉钉群">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {sending === report.id ? "发送中" : "钉钉"}
                </button>
                <button onClick={() => handleRegenerate(report.id)} disabled={regenerating === report.id} className="btn-ghost" title="重新生成周报">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  {regenerating === report.id ? "生成中" : "重新生成"}
                </button>
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

      {/* Modal overlay */}
      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          onClick={() => { if (!editing) setViewing(null); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl shadow-2xl animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 rounded-full bg-[var(--accent)]" />
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    {formatDate(viewing.week_start)} ~ {formatDate(viewing.week_end)}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {new Date(viewing.created_at).toLocaleString("zh-CN")}
                  </p>
                  {viewing.members && viewing.members.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      <span className="text-xs text-[var(--text-muted)]">{viewing.members.join("、")}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button onClick={handleSave} disabled={saving} className="btn btn-primary text-xs py-1.5 px-3">
                      {saving ? "保存中..." : "保存"}
                    </button>
                    <button onClick={cancelEdit} className="btn btn-secondary text-xs py-1.5 px-3">
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={startEdit} className="btn btn-secondary text-xs py-1.5 px-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      编辑
                    </button>
                    <button onClick={() => handleExport(viewing.id)} className="btn btn-secondary text-xs py-1.5 px-3">
                      导出
                    </button>
                    <button onClick={() => handleDingTalk(viewing.id)} disabled={sending === viewing.id} className="btn btn-secondary text-xs py-1.5 px-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      {sending === viewing.id ? "发送中" : "钉钉"}
                    </button>
                    <button onClick={() => handleRegenerate(viewing.id)} disabled={regenerating === viewing.id} className="btn btn-secondary text-xs py-1.5 px-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                      {regenerating === viewing.id ? "生成中" : "重新生成"}
                    </button>
                    <button onClick={() => { handleDelete(viewing.id); }} className="btn-danger btn text-xs py-1.5 px-3">
                      删除
                    </button>
                    <button
                      onClick={() => setViewing(null)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-all"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6">
              {editing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-[50vh] bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius)] p-4 text-sm text-[var(--text-primary)] font-mono leading-relaxed resize-y focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] outline-none transition-all"
                  autoFocus
                />
              ) : (
                <pre className="text-sm text-[var(--text-primary)] whitespace-pre-wrap font-mono leading-relaxed">
                  {viewing.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
