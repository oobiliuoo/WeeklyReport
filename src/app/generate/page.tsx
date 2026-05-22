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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">生成周报</h1>

      {/* Step indicators */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= s ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
            }`}
          >
            {s}
          </div>
        ))}
      </div>

      {/* Step 1: Select repos, members, date range */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold mb-3">选择仓库</h2>
            {repos.map((repo) => (
              <label key={repo.id} className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={selectedRepoIds.includes(repo.id)}
                  onChange={() => toggleRepo(repo.id)}
                />
                <span>{repo.name}</span>
                <span className="text-sm text-gray-500">{repo.path}</span>
              </label>
            ))}
            {repos.length === 0 && (
              <p className="text-gray-500">暂无仓库，请先<a href="/repos" className="text-blue-600">添加仓库</a>。</p>
            )}
          </div>

          {selectedRepoIds.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-semibold mb-3">选择成员</h2>
              {members.map((member) => (
                <label key={member.id} className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.includes(member.id)}
                    onChange={() => toggleMember(member.id)}
                  />
                  <span>{member.display_name || member.name}</span>
                  <span className="text-sm text-gray-500">{member.email}</span>
                </label>
              ))}
              <button
                onClick={() => setSelectedMemberIds(members.map((m) => m.id))}
                className="text-sm text-blue-600 hover:underline mt-2"
              >
                全选
              </button>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold mb-3">时间范围</h2>
            <div className="flex gap-3">
              <input
                type="date"
                value={since}
                onChange={(e) => setSince(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <span className="py-2">~</span>
              <input
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            onClick={handleFetchCommits}
            disabled={selectedRepoIds.length === 0 || loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "查询中..." : "查询提交记录"}
          </button>
        </div>
      )}

      {/* Step 2: Review commits */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold mb-3">提交记录 ({commits.length} 条)</h2>
            {commits.length === 0 ? (
              <p className="text-gray-500">所选时间范围内无提交记录。</p>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {commits.map((c, i) => (
                  <div key={i} className="text-sm border-b border-gray-100 pb-2">
                    <span className="text-gray-500">{c.date.slice(0, 10)}</span>{" "}
                    <span className="text-gray-400">{c.authorName}</span>{" "}
                    <span>{c.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="border border-gray-300 px-4 py-2 rounded text-sm">
              返回修改
            </button>
            <button
              onClick={handleGenerate}
              disabled={commits.length === 0 || loading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "生成中..." : "生成周报"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Edit */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold mb-3">周报预览</h2>
            <textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              className="w-full h-96 border border-gray-300 rounded p-3 text-sm font-mono"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="border border-gray-300 px-4 py-2 rounded text-sm">
              返回修改
            </button>
            <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              保存
            </button>
            <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              导出 Markdown
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
