"use client";

import { useEffect, useState } from "react";

interface Repo {
  id: number;
  name: string;
  path: string;
  created_at: string;
}

export default function ReposPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const loadRepos = () => {
    fetch("/api/repos")
      .then((r) => r.json())
      .then((data) => setRepos(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    loadRepos();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setAdding(true);

    const res = await fetch("/api/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, path }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "添加失败");
      setAdding(false);
      return;
    }

    setName("");
    setPath("");
    setAdding(false);
    loadRepos();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此仓库？关联的成员数据也会被删除。")) return;
    await fetch(`/api/repos?id=${id}`, { method: "DELETE" });
    loadRepos();
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-10 animate-fade-in-up">
        <p className="section-label">Repositories</p>
        <h1 className="page-title">仓库管理</h1>
      </div>

      {/* Add form */}
      <div className="card p-6 mb-8 animate-fade-in-up stagger-1">
        <p className="section-label">Add Repository</p>
        <form onSubmit={handleAdd} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[rgba(204,68,68,0.1)] border border-[var(--danger-dim)] text-[var(--danger)] text-sm animate-fade-in">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="仓库名称（别名）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              required
            />
            <input
              type="text"
              placeholder="本地路径（如 E:/project/my-repo）"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="input"
              required
            />
            <button
              type="submit"
              disabled={adding}
              className="btn btn-primary flex-shrink-0"
            >
              {adding ? "添加中..." : "添加"}
            </button>
          </div>
        </form>
      </div>

      {/* Repo list */}
      {repos.length === 0 ? (
        <div className="card p-12 text-center animate-fade-in-up stagger-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--bg-card-hover)] mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">暂无仓库，请添加</p>
        </div>
      ) : (
        <div className="space-y-3">
          {repos.map((repo, i) => (
            <div
              key={repo.id}
              className={`card px-5 py-4 flex items-center justify-between animate-fade-in-up stagger-${Math.min(i + 1, 8)}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-glow)] flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{repo.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">{repo.path}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(repo.id)} className="btn-danger btn text-xs px-3 py-1.5">
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
