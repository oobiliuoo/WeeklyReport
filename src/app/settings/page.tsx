"use client";

import { useEffect, useState } from "react";

interface Settings {
  llm_base_url?: string;
  llm_api_key?: string;
  llm_model?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings(data));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">设置</h1>

      <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <h2 className="font-semibold">LLM 配置（bol-api 中转站）</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">服务地址</label>
          <input
            type="text"
            placeholder="http://localhost:8088/v1"
            value={settings.llm_base_url || ""}
            onChange={(e) => setSettings({ ...settings, llm_base_url: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <input
            type="password"
            placeholder="bol-xxxxxxxxx"
            value={settings.llm_api_key || ""}
            onChange={(e) => setSettings({ ...settings, llm_api_key: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">模型名称</label>
          <input
            type="text"
            placeholder="gpt-4o / claude-3-opus-20240229 / ..."
            value={settings.llm_model || ""}
            onChange={(e) => setSettings({ ...settings, llm_model: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
          {saved && <span className="text-green-600 text-sm">已保存</span>}
        </div>
      </form>
    </div>
  );
}
