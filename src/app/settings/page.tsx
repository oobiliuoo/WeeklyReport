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
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-10 animate-fade-in-up">
        <p className="section-label">Configuration</p>
        <h1 className="page-title">设置</h1>
      </div>

      {/* LLM Config */}
      <div className="card p-6 animate-fade-in-up stagger-1">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-[var(--accent-glow)] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 0-4 4c0 2 2 3 2 6H14c0-3 2-4 2-6a4 4 0 0 0-4-4z"/>
              <line x1="10" y1="16" x2="14" y2="16"/>
              <line x1="10" y1="19" x2="14" y2="19"/>
              <line x1="11" y1="22" x2="13" y2="22"/>
            </svg>
          </div>
          <div>
            <p className="section-label mb-0">LLM Configuration</p>
            <p className="text-xs text-[var(--text-muted)]">通过 bol-api 中转站连接 AI 模型</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">服务地址</label>
            <input
              type="text"
              placeholder="http://localhost:8088/v1"
              value={settings.llm_base_url || ""}
              onChange={(e) => setSettings({ ...settings, llm_base_url: e.target.value })}
              className="input font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">API Key</label>
            <input
              type="password"
              placeholder="sk-xxxxxxxxx"
              value={settings.llm_api_key || ""}
              onChange={(e) => setSettings({ ...settings, llm_api_key: e.target.value })}
              className="input font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">模型名称</label>
            <input
              type="text"
              placeholder="gpt-4o / claude-3-opus-20240229 / ..."
              value={settings.llm_model || ""}
              onChange={(e) => setSettings({ ...settings, llm_model: e.target.value })}
              className="input"
            />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "保存中..." : "保存配置"}
            </button>
            {saved && (
              <span className="text-[var(--success)] text-sm flex items-center gap-1.5 animate-fade-in">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                已保存
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
