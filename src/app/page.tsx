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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">周报</h1>
        <a
          href="/generate"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          生成本周周报
        </a>
      </div>

      {loading && <p className="text-gray-500">加载中...</p>}

      {!loading && reports.length === 0 && (
        <p className="text-gray-500">暂无周报，点击上方按钮生成第一份周报。</p>
      )}

      <div className="space-y-4">
        {reports.map((report) => (
          <div key={report.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">
                {report.week_start} ~ {report.week_end}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport(report.id)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  导出
                </button>
                <button
                  onClick={() => handleDelete(report.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  删除
                </button>
              </div>
            </div>
            <pre className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-4">
              {report.content.slice(0, 200)}...
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
