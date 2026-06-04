# WeeklyReport

基于本地 Git 提交记录，通过 AI 自动生成分类归纳式周报的个人工具。提供 Web 界面管理仓库、成员和周报，支持 Markdown 导出。

## 功能

- 从本地 Git 仓库读取指定成员的提交记录
- 自动发现仓库贡献者，支持多选筛选
- AI 为主进行分类和润色（新功能/修复/重构/文档/其他），LLM 不可用时自动 fallback 到规则分类
- 多仓库支持：按项目分组归纳周报内容
- 周报可在线编辑、保存、导出 Markdown 文件
- 默认成员配置：生成周报时自动勾选常用成员
- 深色编辑风格 UI，响应式布局

## 技术栈

- **框架**: Next.js 16 (App Router, 全栈)
- **前端**: React 19 + Tailwind CSS 4
- **数据存储**: SQLite (better-sqlite3)
- **Git 操作**: simple-git
- **LLM**: OpenAI SDK → bol-api 中转站（OpenAI 兼容协议）
- **语言**: TypeScript

## 快速开始

### 前置要求

- Node.js >= 18
- 本地已安装 Git
- 一个兼容 OpenAI 协议的 LLM 服务（如 bol-api）

### 安装

``bash
git clone <repo-url> WeeklyReport
cd WeeklyReport
npm install
``

### 启动开发服务器

``bash
npm run dev
``

打开 http://localhost:3000 即可使用。

### 配置 LLM

1. 进入 **设置** 页面 (/settings)
2. 填写 LLM 服务地址（如 http://localhost:8088/v1）
3. 填写 API Key
4. 填写模型名称（如 gpt-4o）
5. 点击保存

## 使用流程

1. **添加仓库** — 在「仓库」页面添加本地 Git 仓库路径，系统自动发现贡献者
2. **生成周报** — 在「生成」页面：
   - 选择仓库（多选）
   - 选择成员（多选，可全选）
   - 设置时间范围（默认本周周一 ~ 周五）
   - 查询提交记录 → AI 生成周报 → 预览编辑 → 保存/导出
3. **查看历史** — 首页展示所有已生成的周报，支持按周次/生成时间排序，点击查看详情

## 项目结构

``text
WeeklyReport/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 首页：周报列表 + 查看/编辑/删除/导出
│   │   ├── layout.tsx            # 根布局 + 导航栏
│   │   ├── globals.css           # 全局样式 + 设计变量
│   │   ├── repos/page.tsx        # 仓库管理
│   │   ├── generate/page.tsx     # 生成周报（3 步向导）
│   │   ├── settings/page.tsx     # LLM 配置 + 默认成员
│   │   └── api/
│   │       ├── repos/route.ts    # 仓库 CRUD + 贡献者同步
│   │       ├── members/route.ts  # 成员查询 + 别名更新
│   │       ├── commits/route.ts  # 提交记录查询（多仓库并行）
│   │       ├── reports/route.ts  # 周报 CRUD + 导出
│   │       └── settings/route.ts # 配置读写（API Key 掩码）
│   └── lib/
│       ├── db.ts                 # SQLite 初始化 + 全部 CRUD 操作
│       ├── git.ts                # Git 操作封装（验证仓库/读取提交/同步贡献者）
│       ├── llm.ts                # LLM 调用 + 规则 fallback 分类
│       └── report.ts             # 周报生成 + Markdown 导出
├── data/                         # SQLite 数据文件（gitignored）
├── exports/                      # 导出的 Markdown 文件（gitignored）
└── docs/                         # 设计文档与计划
``

## 数据模型

| 表 | 说明 |
|---|------|
| epositories | 管理的 Git 仓库（别名 + 本地路径） |
| members | 每个仓库的贡献者，display_name 用于跨仓库统一显示 |
| eports | 生成的周报（Markdown 内容 + 关联成员/仓库 ID） |
| settings | 键值对全局配置（LLM 地址、API Key、模型名、默认成员） |

## LLM 集成

使用 OpenAI SDK，ase_url 指向 bol-api 或任何 OpenAI 兼容的中转站。只需配置三个参数即可：

- 服务地址 (llm_base_url)
- API Key (llm_api_key)
- 模型名称 (llm_model)

当 LLM 不可用时，系统自动回退到基于 conventional commits 关键词（eat/ix/efactor/docs）的规则分类，确保周报始终可以生成。

## 脚本

| 命令 | 说明 |
|------|------|
| 
pm run dev | 启动开发服务器 |
| 
pm run build | 构建生产版本 |
| 
pm run start | 启动生产服务器 |
| 
pm run lint | 运行 ESLint |

## License

Private — 个人使用
