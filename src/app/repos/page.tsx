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
      <h1 className="text-2xl font-bold mb-6">仓库管理</h1>

      <form onSubmit={handleAdd} className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="font-semibold mb-3">添加仓库</h2>
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="仓库名称（别名）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            required
          />
          <input
            type="text"
            placeholder="本地路径（如 E:/project/my-repo）"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={adding}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? "添加中..." : "添加"}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {repos.map((repo) => (
          <div key={repo.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{repo.name}</p>
              <p className="text-sm text-gray-500">{repo.path}</p>
            </div>
            <button
              onClick={() => handleDelete(repo.id)}
              className="text-red-600 text-sm hover:underline"
            >
              删除
            </button>
          </div>
        ))}
        {repos.length === 0 && <p className="text-gray-500">暂无仓库，请添加。</p>}
      </div>
    </div>
  );
}
