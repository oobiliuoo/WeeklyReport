"use client";

import { useEffect, useState } from "react";

interface Repo {
  id: number;
  name: string;
  path: string;
}

interface Member {
  id: number;
  name: string;
  email: string;
  repo_id: number;
  display_name: string | null;
}

interface Commit {
  hash: string;
  date: string;
  message: string;
  authorName: string;
  authorEmail: string;
}

export default function GeneratePage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepoIds, setSelectedRepoIds] = useState<number[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [report, setReport] = useState("");
  const [reportId, setReportId] = useState<number | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  // Set default week range
  useEffect(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setSince(fmt(monday));
    setUntil(fmt(friday));
  }, []);

  // Load repos
  useEffect(() => {
    fetch("/api/repos").then((r) => r.json()).then((data) => setRepos(Array.isArray(data) ? data : []));
  }, []);

  // Load members when repos change
  useEffect(() => {
    if (selectedRepoIds.length === 0) {
      setMembers([]);
      return;
    }
    fetch(`/api/members?repoIds=${selectedRepoIds.join(",")}`)
      .then((r) => r.json())
      .then((data) => setMembers(Array.isArray(data) ? data : []));
  }, [selectedRepoIds]);

  const toggleRepo = (id: number) => {
    setSelectedRepoIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const toggleMember = (id: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleFetchCommits = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      repoIds: selectedRepoIds.join(","),
      since,
      until,
    });
    if (selectedMemberIds.length > 0) {
      params.set("memberIds", selectedMemberIds.join(","));
    }
    const res = await fetch(`/api/commits?${params}`).then((r) => r.json());
    setCommits(Array.isArray(res) ? res : []);
    setLoading(false);
    setStep(2);
  };

  const handleGenerate = async () => {
    setLoading(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekStart: since,
        weekEnd: until,
        commits,
        memberIds: selectedMemberIds,
        repoIds: selectedRepoIds,
      }),
    });
    const data = await res.json();
    setReportId(data.id);
    setReport(data.content || "生成失败");
    setLoading(false);
    setStep(3);
  };

  const handleSave = async () => {
    if (!reportId) return;
    await fetch("/api/reports", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reportId, content: report }),
    });
    window.location.href = "/";
  };

  const handleExport = async () => {
    if (!reportId) return;
    const res = await fetch(`/api/reports?id=${reportId}&action=export`).then((r) => r.json());
    alert(`已导出到: ${res.filePath}`);
  };

  const stepLabels = ["选择范围", "确认提交", "周报预览"];

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-fade-in-up">
        <p className="section-label">Generate</p>
        <h1 className="page-title">生成周报</h1>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-0 mb-10 animate-fade-in-up stagger-1">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`step-dot ${step === s ? "active" : step > s ? "completed" : "inactive"}`}>
              {step > s ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : s}
            </div>
            {s < 3 && <div className={`step-line ${step > s ? "active" : ""}`} />}
          </div>
        ))}
        <div className="ml-4 text-sm text-[var(--text-muted)]">{stepLabels[step - 1]}</div>
      </div>

      {/* Step 1: Select repos, members, date range */}
      {step === 1 && (
        <div className="space-y-6 animate-fade-in-up stagger-2">
          {/* Repos */}
          <div className="card p-5">
            <p className="section-label">Repositories</p>
            <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">选择仓库</h2>
            {repos.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[var(--text-muted)] text-sm">
                  暂无仓库，请先
                  <a href="/repos" className="text-[var(--accent)] hover:underline ml-1">添加仓库</a>
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {repos.map((repo) => (
                  <label key={repo.id} className="checkbox-wrapper" onClick={() => toggleRepo(repo.id)}>
                    <div className={`checkbox-custom ${selectedRepoIds.includes(repo.id) ? "checked" : ""}`} />
                    <span className="text-[var(--text-primary)] text-sm">{repo.name}</span>
                    <span className="text-xs text-[var(--text-muted)] font-mono">{repo.path}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Members */}
          {selectedRepoIds.length > 0 && (
            <div className="card p-5 animate-fade-in-up stagger-3">
              <p className="section-label">Members</p>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">选择成员</h2>
                <button
                  onClick={() => setSelectedMemberIds(members.map((m) => m.id))}
                  className="btn-ghost text-xs"
                >
                  全选
                </button>
              </div>
              <div className="space-y-1">
                {members.map((member) => (
                  <label key={member.id} className="checkbox-wrapper" onClick={() => toggleMember(member.id)}>
                    <div className={`checkbox-custom ${selectedMemberIds.includes(member.id) ? "checked" : ""}`} />
                    <span className="text-[var(--text-primary)] text-sm">{member.display_name || member.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">{member.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Date range */}
          <div className="card p-5 animate-fade-in-up stagger-4">
            <p className="section-label">Date Range</p>
            <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">时间范围</h2>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={since}
                onChange={(e) => setSince(e.target.value)}
                className="input"
              />
              <span className="text-[var(--text-muted)]">~</span>
              <input
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <button
            onClick={handleFetchCommits}
            disabled={selectedRepoIds.length === 0 || loading}
            className="btn btn-primary"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"/>
                </svg>
                查询中...
              </span>
            ) : "查询提交记录"}
          </button>
        </div>
      )}

      {/* Step 2: Review commits */}
      {step === 2 && (
        <div className="space-y-5 animate-fade-in-up">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                提交记录
              </h2>
              <span className="badge badge-accent">{commits.length} 条</span>
            </div>
            {commits.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[var(--text-muted)]">所选时间范围内无提交记录</p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {commits.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-[var(--border-subtle)] last:border-0 animate-slide-in" style={{ animationDelay: `${i * 0.02}s` }}>
                    <span className="text-xs text-[var(--text-muted)] font-mono whitespace-nowrap mt-0.5">{c.date.slice(0, 10)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">{c.message}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{c.authorName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn btn-secondary">
              返回修改
            </button>
            <button
              onClick={handleGenerate}
              disabled={commits.length === 0 || loading}
              className="btn btn-primary"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"/>
                  </svg>
                  AI 生成中...
                </span>
              ) : "生成周报"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Edit */}
      {step === 3 && (
        <div className="space-y-5 animate-fade-in-up">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">周报预览</h2>
              <span className="badge badge-accent">可编辑</span>
            </div>
            <textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              className="w-full h-[400px] bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius)] p-4 text-sm text-[var(--text-primary)] font-mono leading-relaxed resize-y focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] outline-none transition-all"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn btn-secondary">
              返回修改
            </button>
            <button onClick={handleSave} className="btn btn-primary">
              保存周报
            </button>
            <button onClick={handleExport} className="btn btn-success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              导出 Markdown
            </button>
          </div>
        </div>
      )}
    </div>
  );
}