# WeeklyReport - 周报生成工具设计文档

## 概述

基于本地 git 仓库提交记录，通过 AI 自动生成分类归纳式周报的个人工具。提供 Web 页面管理仓库、成员和周报，支持 Markdown 导出。

## 需求

- 从本地 git 仓库读取指定成员的提交记录
- 自动发现仓库贡献者，支持多选
- AI 为主进行分类和润色（规则 fallback）
- 分类归纳式周报（新功能/修复/重构/文档/其他）
- Web 页面管理 + Markdown 导出
- 个人工具，无需登录/权限

## 技术栈

- **框架**: Next.js (App Router, 全栈)
- **数据存储**: SQLite (better-sqlite3)
- **Git 操作**: simple-git
- **LLM**: OpenAI SDK → bol-api 中转站（OpenAI 兼容）
- **前端**: React + Tailwind CSS

## 架构

```
┌─────────────────────────────────────────┐
│           Next.js App (全栈)             │
│                                         │
│  ┌───────────┐  ┌────────────────────┐  │
│  │  前端页面  │  │   API Routes       │  │
│  │  (React)  │  │                    │  │
│  │           │  │ /api/repos         │  │
│  │ - 仓库管理 │  │ /api/members       │  │
│  │ - 周报生成 │  │ /api/commits       │  │
│  │ - 周报预览 │  │ /api/reports       │  │
│  │ - 导出    │  │ /api/llm           │  │
│  └───────────┘  └────────────────────┘  │
│         │              │                │
│         └──────┬───────┘                │
│                │                        │
│  ┌─────────────▼──────────────────┐     │
│  │        Core Services           │     │
│  │                                │     │
│  │  GitService  - 读取本地仓库     │     │
│  │  LLMService  - AI分类/润色     │     │
│  │  ReportService - 周报生成/导出  │     │
│  └────────────────────────────────┘     │
│                │                        │
│  ┌─────────────▼──────────────────┐     │
│  │     SQLite (better-sqlite3)    │     │
│  │                                │     │
│  │  - 仓库配置 (路径/别名)        │     │
│  │  - 成员映射 (name/email)       │     │
│  │  - 周报历史                    │     │
│  └────────────────────────────────┘     │
└─────────────────────────────────────────┘
```

### LLM 集成

使用 OpenAI SDK（Node.js），`base_url` 指向 bol-api 服务地址。bol-api 是已有的 OpenAI 兼容 LLM 中转站，负责路由到具体模型提供商。WeeklyReport 只需配置：

- bol-api 服务地址
- API Key
- 模型名称

不感知底层是 Claude/GPT/本地模型。

## 数据模型

```sql
-- 仓库配置
CREATE TABLE repositories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,          -- 别名，如 "前端项目"
  path        TEXT NOT NULL UNIQUE,   -- 本地绝对路径
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 成员映射（从仓库自动发现后保存）
CREATE TABLE members (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,        -- git author name
  email         TEXT NOT NULL,        -- git author email
  repo_id       INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  display_name  TEXT,                 -- 用户手动设置的显示名别名，用于统一同一人在不同仓库的不同 name
  UNIQUE(name, email, repo_id)
);

-- 周报历史
CREATE TABLE reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start  DATE NOT NULL,          -- 周一日期
  week_end    DATE NOT NULL,          -- 周五日期
  content     TEXT NOT NULL,          -- Markdown 内容
  member_ids  TEXT NOT NULL,          -- JSON数组，关联的成员ID
  repo_ids    TEXT NOT NULL,          -- JSON数组，关联的仓库ID
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 全局配置（键值对）
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

说明：
- `members` 与 `repositories` 是多对一关系
- 同一个人在不同仓库可能用不同 name/email，`display_name` 用于统一显示
- `reports` 存储生成过的周报，可回溯查看
- `settings` 存 LLM 配置（bol-api 地址、API key、模型名）等

## 页面与交互

### 页面结构

| 路由 | 页面 | 功能 |
|------|------|------|
| `/` | 首页 | 本周周报快速生成入口 + 历史周报列表 |
| `/repos` | 仓库管理 | 仓库列表、添加/删除仓库 |
| `/settings` | 设置 | LLM 配置、周报配置 |
| `/generate` | 生成周报 | 选择仓库→选成员→选时间→生成→预览→保存/导出 |

### 核心流程 - 生成周报

1. 点击"生成本周周报"
2. 选择仓库（多选，从已配置的仓库列表勾选）
3. 选择成员（多选，从所选仓库的贡献者中勾选）
4. 选择时间范围（默认本周周一~周五，可调整）
5. 系统读取 git log → 提取提交记录
6. 调用 LLM：将提交信息发送给 AI，AI 返回分类归纳的周报
7. 展示周报预览（可手动编辑调整）
8. 确认保存 → 存入 reports 表
9. 可一键导出 Markdown 文件

### LLM 调用策略

- 将所有选中成员在所选仓库的本周提交信息打包发送给 LLM
- Prompt 要求 LLM 按"新功能/修复/重构/文档/其他"分类归纳
- 每条提交保留原始 message，LLM 负责归纳总结和润色
- 规则 fallback：如果 LLM 不可用，按 conventional commits 关键词自动分类

### LLM Prompt

```
你是一个周报生成助手。根据以下 git 提交记录，生成本周工作周报。

要求：
1. 按以下分类归纳：新功能、修复、重构、文档、其他
2. 每个分类下用简洁的中文描述工作内容
3. 合并相关的提交（如多个提交属于同一功能）
4. 保留关键的技术细节

提交记录：
{commits}
```

### Markdown 导出

- 周报标题格式：`# 周报 YYYY-MM-DD ~ YYYY-MM-DD`
- 文件名格式：`周报_YYYYMMDD-YYYYMMDD.md`
- 导出路径可配置，默认项目根目录下 `exports/`

## 项目结构

```
WeeklyReport/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 首页(周报列表)
│   │   ├── repos/page.tsx      # 仓库管理
│   │   ├── settings/page.tsx   # 设置
│   │   ├── generate/page.tsx   # 生成周报
│   │   └── api/                # API Routes
│   │       ├── repos/route.ts
│   │       ├── members/route.ts
│   │       ├── commits/route.ts
│   │       ├── reports/route.ts
│   │       └── llm/route.ts
│   ├── lib/
│   │   ├── db.ts               # SQLite 初始化和操作
│   │   ├── git.ts              # Git 操作封装
│   │   ├── llm.ts              # LLM 调用封装
│   │   └── report.ts           # 周报生成逻辑
│   └── components/             # React 组件
├── data/
│   └── weekly-report.db        # SQLite 数据文件
└── exports/                    # Markdown 导出目录
```

## Git 提交读取

- 使用 `simple-git` 库执行 `git log`
- 按作者（name/email）+ 日期范围筛选
- 提取字段：hash、date、message、author name、author email
- 支持多仓库并行读取（Promise.all）

## 错误处理

- 仓库路径无效：添加时验证路径存在且为 git 仓库
- LLM 不可用：fallback 到规则分类，提示用户检查 LLM 配置
- 无提交记录：提示所选时间范围内无提交
