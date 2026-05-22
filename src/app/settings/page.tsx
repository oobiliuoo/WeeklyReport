"use client";

import { useEffect, useState } from "react";

interface Member {
  id: number;
  name: string;
  email: string;
  display_name: string | null;
  repo_id: number;
}

interface Settings {
  llm_base_url?: string;
  llm_api_key?: string;
  llm_model?: string;
  default_member_ids?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load settings and members
  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/repos").then((r) => r.json()),
    ]).then(([settingsData, repos]) => {
      setSettings(settingsData);
      if (settingsData.default_member_ids) {
        try {
          setSelectedMemberIds(JSON.parse(settingsData.default_member_ids));
        } catch {}
      }
      if (Array.isArray(repos) && repos.length > 0) {
        const ids = repos.map((r: any) => r.id).join(",");
        return fetch(`/api/members?repoIds=${ids}`).then((r) => r.json());
      }
      return [];
    }).then((members) => {
      setAllMembers(Array.isArray(members) ? members : []);
      setLoadingMembers(false);
    }).catch(() => setLoadingMembers(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settings,
        default_member_ids: JSON.stringify(selectedMemberIds),
      }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const toggleMember = (id: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  return (
    <div>
      <div className="mb-10 animate-fade-in-up">
        <p className="section-label">Configuration</p>
        <h1 className="page-title">设置</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
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

          <div className="space-y-5">
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
          </div>
        </div>

        {/* Default Members */}
        <div className="card p-6 animate-fade-in-up stagger-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent-glow)] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <p className="section-label mb-0">Default Members</p>
              <p className="text-xs text-[var(--text-muted)]">生成周报时自动选中的成员</p>
            </div>
          </div>

          {loadingMembers ? (
            <div className="skeleton h-20" />
          ) : allMembers.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">暂无成员，请先添加仓库。</p>
          ) : (
            <div className="space-y-1">
              {allMembers.map((member) => (
                <label
                  key={member.id}
                  className="checkbox-wrapper"
                  onClick={() => toggleMember(member.id)}
                >
                  <div className={`checkbox-custom ${selectedMemberIds.includes(member.id) ? "checked" : ""}`} />
                  <span className="text-[var(--text-primary)] text-sm">
                    {member.display_name || member.name}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{member.email}</span>
                </label>
              ))}
            </div>
          )}
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
  );
}
