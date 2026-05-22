# WeeklyReport 周报生成工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal web tool that reads git commits from local repositories, uses AI (via bol-api) to generate categorized weekly reports, and provides a web UI for management and Markdown export.

**Architecture:** Next.js full-stack app with App Router. SQLite for persistence, simple-git for reading repos, OpenAI SDK pointing at bol-api for LLM. All state managed server-side via API routes.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS 4, better-sqlite3, simple-git, openai SDK, TypeScript

---

## File Structure

```
WeeklyReport/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with nav
│   │   ├── page.tsx                # Home: report list + quick generate
│   │   ├── repos/
│   │   │   └── page.tsx            # Repository management
│   │   ├── settings/
│   │   │   └── page.tsx            # LLM & report config
│   │   ├── generate/
│   │   │   └── page.tsx            # Generate report wizard
│   │   └── api/
│   │       ├── repos/
│   │       │   └── route.ts        # GET/POST/DELETE repos
│   │       ├── members/
│   │       │   └── route.ts        # GET members by repo
│   │       ├── commits/
│   │       │   └── route.ts        # GET commits by repo/member/date
│   │       ├── reports/
│   │       │   └── route.ts        # GET/POST/DELETE reports, GET export
│   │       └── settings/
│   │           └── route.ts        # GET/PUT settings
│   ├── lib/
│   │   ├── db.ts                   # SQLite init + table creation
│   │   ├── git.ts                  # Git operations (log, contributors)
│   │   ├── llm.ts                  # LLM call via OpenAI SDK → bol-api
│   │   └── report.ts              # Report generation + Markdown export
│   └── components/
│       ├── RepoList.tsx            # Repository list with add/delete
│       ├── MemberSelect.tsx        # Multi-select member picker
│       ├── ReportPreview.tsx       # Markdown preview with edit
│       └── DateRangePicker.tsx     # Week date range selector
├── data/                           # SQLite data dir (gitignored)
├── exports/                        # Markdown export dir (gitignored)
├── package.json
├── tsconfig.json
├── next.config.ts
└── .gitignore
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `.gitignore`
- Create: `src/app/layout.tsx`

- [ ] **Step 1: Initialize Next.js project**

Run:
```bash
cd E:/person/project/WeeklyReport
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

Accept defaults. This creates `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, etc.

- [ ] **Step 2: Install core dependencies**

Run:
```bash
npm install better-sqlite3 simple-git openai
npm install -D @types/better-sqlite3
```

- [ ] **Step 3: Update .gitignore**

Append to `.gitignore`:
```
data/
exports/
*.db
```

- [ ] **Step 4: Verify dev server starts**

Run:
```bash
npm run dev
```

Expected: Server starts on http://localhost:3000, default Next.js page loads.

- [ ] **Step 5: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js project with core dependencies"
```

---

### Task 2: Database Layer

**Files:**
- Create: `src/lib/db.ts`

- [ ] **Step 1: Write the database module**

Create `src/lib/db.ts`:

```typescript
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "weekly-report.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  migrate(_db);
  return _db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS repositories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      path        TEXT NOT NULL UNIQUE,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS members (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL,
      repo_id       INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      display_name  TEXT,
      UNIQUE(name, email, repo_id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start  TEXT NOT NULL,
      week_end    TEXT NOT NULL,
      content     TEXT NOT NULL,
      member_ids  TEXT NOT NULL,
      repo_ids    TEXT NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// Repositories
export function getRepos() {
  return getDb().prepare("SELECT * FROM repositories ORDER BY created_at DESC").all() as RepoRow[];
}

export function getRepoById(id: number) {
  return getDb().prepare("SELECT * FROM repositories WHERE id = ?").get(id) as RepoRow | undefined;
}

export function addRepo(name: string, path: string) {
  const now = new Date().toISOString();
  const result = getDb().prepare("INSERT INTO repositories (name, path, created_at, updated_at) VALUES (?, ?, ?, ?)").run(name, path, now, now);
  return result.lastInsertRowid;
}

export function deleteRepo(id: number) {
  getDb().prepare("DELETE FROM repositories WHERE id = ?").run(id);
}

// Members
export function getMembersByRepoId(repoId: number) {
  return getDb().prepare("SELECT * FROM members WHERE repo_id = ? ORDER BY name").all(repoId) as MemberRow[];
}

export function getAllMembersByRepoIds(repoIds: number[]) {
  const placeholders = repoIds.map(() => "?").join(",");
  return getDb().prepare(`SELECT * FROM members WHERE repo_id IN (${placeholders}) ORDER BY name`).all(...repoIds) as MemberRow[];
}

export function upsertMember(name: string, email: string, repoId: number, displayName?: string) {
  getDb().prepare(
    "INSERT INTO members (name, email, repo_id, display_name) VALUES (?, ?, ?, ?) ON CONFLICT(name, email, repo_id) DO UPDATE SET display_name = COALESCE(excluded.display_name, members.display_name)"
  ).run(name, email, repoId, displayName ?? null);
}

export function updateMemberDisplayName(id: number, displayName: string) {
  getDb().prepare("UPDATE members SET display_name = ? WHERE id = ?").run(displayName, id);
}

// Reports
export function getReports() {
  return getDb().prepare("SELECT * FROM reports ORDER BY week_start DESC").all() as ReportRow[];
}

export function getReportById(id: number) {
  return getDb().prepare("SELECT * FROM reports WHERE id = ?").get(id) as ReportRow | undefined;
}

export function saveReport(weekStart: string, weekEnd: string, content: string, memberIds: number[], repoIds: number[]) {
  const now = new Date().toISOString();
  const result = getDb().prepare(
    "INSERT INTO reports (week_start, week_end, content, member_ids, repo_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(weekStart, weekEnd, content, JSON.stringify(memberIds), JSON.stringify(repoIds), now, now);
  return result.lastInsertRowid;
}

export function updateReport(id: number, content: string) {
  const now = new Date().toISOString();
  getDb().prepare("UPDATE reports SET content = ?, updated_at = ? WHERE id = ?").run(content, now, id);
}

export function deleteReport(id: number) {
  getDb().prepare("DELETE FROM reports WHERE id = ?").run(id);
}

// Settings
export function getSetting(key: string): string | undefined {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string) {
  getDb().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

export function getAllSettings() {
  return getDb().prepare("SELECT * FROM settings").all() as { key: string; value: string }[];
}

// Types
export interface RepoRow {
  id: number;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
}

export interface MemberRow {
  id: number;
  name: string;
  email: string;
  repo_id: number;
  display_name: string | null;
}

export interface ReportRow {
  id: number;
  week_start: string;
  week_end: string;
  content: string;
  member_ids: string;
  repo_ids: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Verify database initializes without error**

Run:
```bash
cd E:/person/project/WeeklyReport
node -e "const db = require('./src/lib/db'); console.log(db.getRepos()); console.log('DB OK')"
```

This will fail because TypeScript needs compilation. Instead, verify by starting the dev server and importing db in an API route (done in Task 3).

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: add SQLite database layer with all tables and CRUD"
```

---

### Task 3: Git Service

**Files:**
- Create: `src/lib/git.ts`

- [ ] **Step 1: Write the git service module**

Create `src/lib/git.ts`:

```typescript
import { simpleGit, SimpleGit } from "simple-git";
import fs from "fs";
import { upsertMember, getMembersByRepoId } from "./db";

export interface CommitInfo {
  hash: string;
  date: string;
  message: string;
  authorName: string;
  authorEmail: string;
}

export interface ContributorInfo {
  name: string;
  email: string;
}

export async function validateRepo(repoPath: string): Promise<{ valid: boolean; error?: string }> {
  if (!fs.existsSync(repoPath)) {
    return { valid: false, error: "路径不存在" };
  }
  const git: SimpleGit = simpleGit(repoPath);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    return { valid: false, error: "不是有效的 git 仓库" };
  }
  return { valid: true };
}

export async function getContributors(repoPath: string): Promise<ContributorInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);
  const log = await git.log(["--format=%aN <%aE>", "--all"]);
  const seen = new Set<string>();
  const contributors: ContributorInfo[] = [];

  for (const entry of log.all) {
    const key = `${entry.author_name}|${entry.author_email}`;
    if (!seen.has(key)) {
      seen.add(key);
      contributors.push({ name: entry.author_name, email: entry.author_email });
    }
  }

  return contributors;
}

export async function syncContributorsToDb(repoId: number, repoPath: string): Promise<void> {
  const contributors = await getContributors(repoPath);
  for (const c of contributors) {
    upsertMember(c.name, c.email, repoId);
  }
}

export async function getCommits(
  repoPath: string,
  authors: string[],
  since: string,
  until: string
): Promise<CommitInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);
  const args = ["--all", `--since=${since}`, `--until=${until}`, "--format=%H%n%aI%n%s%n%aN%n%aE%n---END---"];

  const result = await git.log(args);

  const commits: CommitInfo[] = [];
  for (const entry of result.all) {
    if (authors.length > 0 && !authors.includes(entry.author_name) && !authors.includes(entry.author_email)) {
      continue;
    }
    commits.push({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      authorName: entry.author_name,
      authorEmail: entry.author_email,
    });
  }

  return commits;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/git.ts
git commit -m "feat: add git service for reading commits and contributors"
```

---

### Task 4: LLM Service

**Files:**
- Create: `src/lib/llm.ts`

- [ ] **Step 1: Write the LLM service module**

Create `src/lib/llm.ts`:

```typescript
import OpenAI from "openai";
import { getSetting } from "./db";
import { CommitInfo } from "./git";

const SYSTEM_PROMPT = `你是一个周报生成助手。根据用户提供的 git 提交记录，生成本周工作周报。

要求：
1. 按以下分类归纳：新功能、修复、重构、文档、其他
2. 每个分类下用简洁的中文描述工作内容
3. 合并相关的提交（如多个提交属于同一功能）
4. 保留关键的技术细节
5. 输出格式为 Markdown，每个分类用二级标题
6. 如果某个分类没有内容，则不输出该分类`;

function formatCommits(commits: CommitInfo[]): string {
  return commits
    .map((c) => `- [${c.date}] ${c.authorName}: ${c.message}`)
    .join("\n");
}

export async function generateReportWithLLM(commits: CommitInfo[]): Promise<string> {
  const baseUrl = getSetting("llm_base_url");
  const apiKey = getSetting("llm_api_key");
  const model = getSetting("llm_model");

  if (!baseUrl || !apiKey || !model) {
    throw new Error("LLM 未配置，请在设置页面配置 bol-api 地址、API Key 和模型名称");
  }

  const client = new OpenAI({
    baseURL: baseUrl,
    apiKey: apiKey,
  });

  const commitsText = formatCommits(commits);
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `以下是本周的 git 提交记录：\n\n${commitsText}` },
    ],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content ?? "";
}

// Fallback: rule-based classification when LLM is unavailable
export function classifyCommitsByRules(commits: CommitInfo[]): string {
  const categories: Record<string, string[]> = {
    "新功能": [],
    "修复": [],
    "重构": [],
    "文档": [],
    "其他": [],
  };

  const patterns: Record<string, RegExp> = {
    "新功能": /^(feat|add|feature|新增|添加)/i,
    "修复": /^(fix|bug|hotfix|修复|修补)/i,
    "重构": /^(refactor|refactor|重构|优化)/i,
    "文档": /^(docs|doc|文档|readme)/i,
  };

  for (const commit of commits) {
    const msg = commit.message;
    let classified = false;
    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(msg)) {
        categories[category].push(msg);
        classified = true;
        break;
      }
    }
    if (!classified) {
      categories["其他"].push(msg);
    }
  }

  let markdown = "";
  for (const [category, items] of Object.entries(categories)) {
    if (items.length === 0) continue;
    markdown += `## ${category}\n\n`;
    for (const item of items) {
      markdown += `- ${item}\n`;
    }
    markdown += "\n";
  }

  return markdown.trim();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/llm.ts
git commit -m "feat: add LLM service with bol-api integration and rule fallback"
```

---

### Task 5: Report Service

**Files:**
- Create: `src/lib/report.ts`

- [ ] **Step 1: Write the report service module**

Create `src/lib/report.ts`:

```typescript
import fs from "fs";
import path from "path";
import { CommitInfo } from "./git";
import { generateReportWithLLM, classifyCommitsByRules } from "./llm";

export async function generateReport(commits: CommitInfo[], weekStart: string, weekEnd: string): Promise<string> {
  if (commits.length === 0) {
    return "本周无提交记录。";
  }

  try {
    const content = await generateReportWithLLM(commits);
    return `# 周报 ${weekStart} ~ ${weekEnd}\n\n${content}`;
  } catch {
    // Fallback to rule-based classification
    const content = classifyCommitsByRules(commits);
    return `# 周报 ${weekStart} ~ ${weekEnd}\n\n> ⚠️ LLM 不可用，以下为规则自动分类结果\n\n${content}`;
  }
}

export function exportReportToMarkdown(content: string, weekStart: string, weekEnd: string): string {
  const exportsDir = path.join(process.cwd(), "exports");
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const filename = `周报_${weekStart.replace(/-/g, "")}-${weekEnd.replace(/-/g, "")}.md`;
  const filePath = path.join(exportsDir, filename);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

export function getWeekRange(date?: Date): { start: string; end: string } {
  const d = date ?? new Date();
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(friday) };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/report.ts
git commit -m "feat: add report generation and Markdown export service"
```

---

### Task 6: API Routes - Repos

**Files:**
- Create: `src/app/api/repos/route.ts`

- [ ] **Step 1: Write the repos API route**

Create `src/app/api/repos/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRepos, addRepo, deleteRepo, getRepoById } from "@/lib/db";
import { validateRepo, syncContributorsToDb } from "@/lib/git";

export async function GET() {
  const repos = getRepos();
  return NextResponse.json(repos);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, path: repoPath } = body;

  if (!name || !repoPath) {
    return NextResponse.json({ error: "名称和路径不能为空" }, { status: 400 });
  }

  const validation = await validateRepo(repoPath);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const id = addRepo(name, repoPath);

  // Auto-discover contributors
  await syncContributorsToDb(Number(id), repoPath);

  const repo = getRepoById(Number(id));
  return NextResponse.json(repo, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少 id 参数" }, { status: 400 });
  }

  deleteRepo(Number(id));
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/repos/route.ts
git commit -m "feat: add repos API route with validation and contributor sync"
```

---

### Task 7: API Routes - Members

**Files:**
- Create: `src/app/api/members/route.ts`

- [ ] **Step 1: Write the members API route**

Create `src/app/api/members/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getMembersByRepoId, getAllMembersByRepoIds, updateMemberDisplayName } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repoId = searchParams.get("repoId");
  const repoIds = searchParams.get("repoIds");

  if (repoIds) {
    const ids = repoIds.split(",").map(Number);
    const members = getAllMembersByRepoIds(ids);
    return NextResponse.json(members);
  }

  if (repoId) {
    const members = getMembersByRepoId(Number(repoId));
    return NextResponse.json(members);
  }

  return NextResponse.json({ error: "缺少 repoId 或 repoIds 参数" }, { status: 400 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, displayName } = body;

  if (!id || displayName === undefined) {
    return NextResponse.json({ error: "缺少 id 或 displayName" }, { status: 400 });
  }

  updateMemberDisplayName(id, displayName);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/members/route.ts
git commit -m "feat: add members API route"
```

---

### Task 8: API Routes - Commits

**Files:**
- Create: `src/app/api/commits/route.ts`

- [ ] **Step 1: Write the commits API route**

Create `src/app/api/commits/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCommits } from "@/lib/git";
import { getRepoById, getMembersByRepoId } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repoIds = searchParams.get("repoIds");
  const memberIds = searchParams.get("memberIds");
  const since = searchParams.get("since");
  const until = searchParams.get("until");

  if (!repoIds || !since || !until) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  const ids = repoIds.split(",").map(Number);
  const selectedMemberIds = memberIds ? memberIds.split(",").map(Number) : [];

  // Collect author names/emails for filtering
  const authors: string[] = [];
  if (selectedMemberIds.length > 0) {
    for (const repoId of ids) {
      const members = getMembersByRepoId(repoId);
      for (const m of members) {
        if (selectedMemberIds.includes(m.id)) {
          authors.push(m.name);
          authors.push(m.email);
        }
      }
    }
  }

  // Fetch commits from all repos in parallel
  const allCommits = await Promise.all(
    ids.map(async (repoId) => {
      const repo = getRepoById(repoId);
      if (!repo) return [];
      return getCommits(repo.path, authors, since, until);
    })
  );

  const commits = allCommits.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json(commits);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/commits/route.ts
git commit -m "feat: add commits API route with multi-repo parallel fetch"
```

---

### Task 9: API Routes - Reports

**Files:**
- Create: `src/app/api/reports/route.ts`

- [ ] **Step 1: Write the reports API route**

Create `src/app/api/reports/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getReports, getReportById, saveReport, updateReport, deleteReport } from "@/lib/db";
import { exportReportToMarkdown } from "@/lib/report";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const action = searchParams.get("action");

  if (id) {
    const report = getReportById(Number(id));
    if (!report) {
      return NextResponse.json({ error: "周报不存在" }, { status: 404 });
    }

    if (action === "export") {
      const filePath = exportReportToMarkdown(report.content, report.week_start, report.week_end);
      return NextResponse.json({ filePath });
    }

    return NextResponse.json(report);
  }

  const reports = getReports();
  return NextResponse.json(reports);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { weekStart, weekEnd, content, memberIds, repoIds } = body;

  if (!weekStart || !weekEnd || !content || !memberIds || !repoIds) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  const id = saveReport(weekStart, weekEnd, content, memberIds, repoIds);
  const report = getReportById(Number(id));
  return NextResponse.json(report, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, content } = body;

  if (!id || !content) {
    return NextResponse.json({ error: "缺少 id 或 content" }, { status: 400 });
  }

  updateReport(id, content);
  const report = getReportById(id);
  return NextResponse.json(report);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少 id 参数" }, { status: 400 });
  }

  deleteReport(Number(id));
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/reports/route.ts
git commit -m "feat: add reports API route with CRUD and export"
```

---

### Task 10: API Routes - Settings

**Files:**
- Create: `src/app/api/settings/route.ts`

- [ ] **Step 1: Write the settings API route**

Create `src/app/api/settings/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAllSettings, getSetting, setSetting } from "@/lib/db";

export async function GET() {
  const settings = getAllSettings();
  const config: Record<string, string> = {};
  for (const s of settings) {
    // Mask API key for display
    if (s.key === "llm_api_key" && s.value.length > 8) {
      config[s.key] = s.value.slice(0, 4) + "****" + s.value.slice(-4);
    } else {
      config[s.key] = s.value;
    }
  }
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string" && value.trim() !== "") {
      // Don't overwrite API key with masked value
      if (key === "llm_api_key" && value.includes("****")) {
        continue;
      }
      setSetting(key, value);
    }
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/settings/route.ts
git commit -m "feat: add settings API route with masked key display"
```

---

### Task 11: Root Layout with Navigation

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace default layout with navigation layout**

Replace the contents of `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "周报生成工具",
  description: "基于 Git 提交记录自动生成周报",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
          <a href="/" className="text-lg font-bold text-gray-900">周报工具</a>
          <a href="/repos" className="text-gray-600 hover:text-gray-900">仓库管理</a>
          <a href="/generate" className="text-gray-600 hover:text-gray-900">生成周报</a>
          <a href="/settings" className="text-gray-600 hover:text-gray-900">设置</a>
        </nav>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add root layout with navigation"
```

---

### Task 12: Home Page - Report List

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write the home page**

Replace the contents of `src/app/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify home page loads**

Run:
```bash
npm run dev
```

Open http://localhost:3000 — should show empty report list with "生成本周周报" button.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add home page with report list"
```

---

### Task 13: Repos Page

**Files:**
- Create: `src/app/repos/page.tsx`

- [ ] **Step 1: Write the repos management page**

Create `src/app/repos/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify repos page works**

Open http://localhost:3000/repos — should show add form and empty list. Try adding a real local git repo.

- [ ] **Step 3: Commit**

```bash
git add src/app/repos/page.tsx
git commit -m "feat: add repos management page"
```

---

### Task 14: Settings Page

**Files:**
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: Write the settings page**

Create `src/app/settings/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify settings page works**

Open http://localhost:3000/settings — should show LLM config form. Try saving values.

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add settings page for LLM configuration"
```

---

### Task 15: Generate Report Page (Core Feature)

**Files:**
- Create: `src/app/generate/page.tsx`

- [ ] **Step 1: Write the generate report page**

Create `src/app/generate/page.tsx`:

```tsx
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
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
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

  const [reportId, setReportId] = useState<number | null>(null);

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
        {[1, 2, 3, 4].map((s) => (
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
```

- [ ] **Step 2: Update reports API to handle generation with LLM**

We need to modify `src/app/api/reports/route.ts` to accept `commits` in POST and call LLM before saving. Update the POST handler:

In `src/app/api/reports/route.ts`, replace the POST function:

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { weekStart, weekEnd, commits, memberIds, repoIds } = body;

  if (!weekStart || !weekEnd || !memberIds || !repoIds) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  // If commits are provided, generate report via LLM
  let content = body.content;
  if (commits && Array.isArray(commits) && commits.length > 0) {
    const { generateReport } = require("@/lib/report");
    content = await generateReport(commits, weekStart, weekEnd);
  }

  if (!content) {
    return NextResponse.json({ error: "生成周报失败" }, { status: 500 });
  }

  const id = saveReport(weekStart, weekEnd, content, memberIds, repoIds);
  const report = getReportById(Number(id));
  return NextResponse.json(report, { status: 201 });
}
```

- [ ] **Step 3: Verify the full flow**

1. Add a repo on `/repos`
2. Configure LLM on `/settings`
3. Go to `/generate`, select repo + member + date range
4. Click "查询提交记录" → see commits
5. Click "生成周报" → see AI-generated report
6. Edit if needed → Save

- [ ] **Step 4: Commit**

```bash
git add src/app/generate/page.tsx src/app/api/reports/route.ts
git commit -m "feat: add generate report page with full wizard flow"
```

---

### Task 16: next.config.ts for native modules

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Configure Next.js for better-sqlite3 native module**

`better-sqlite3` is a native Node module and needs special handling in Next.js. Replace `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
```

- [ ] **Step 2: Verify dev server still works**

Run:
```bash
npm run dev
```

Open http://localhost:3000 — should load without errors.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: configure Next.js for better-sqlite3 native module"
```

---

### Task 17: End-to-End Verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Configure LLM settings**

Open http://localhost:3000/settings, fill in:
- 服务地址: `http://localhost:8088/v1` (or wherever bol-api runs)
- API Key: your bol-api key
- 模型名称: e.g. `gpt-4o`

- [ ] **Step 3: Add a repository**

Open http://localhost:3000/repos, add a local git repo.

- [ ] **Step 4: Generate a report**

Open http://localhost:3000/generate:
1. Select the repo
2. Select members
3. Set date range
4. Query commits → verify commits appear
5. Generate report → verify AI-generated content appears
6. Edit if needed → Save

- [ ] **Step 5: Verify home page shows the saved report**

Open http://localhost:3000 — should show the saved report in the list.

- [ ] **Step 6: Test export**

Click "导出" on the home page report card. Verify the Markdown file is created in `exports/`.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete WeeklyReport v1 - end-to-end verification passed"
```
