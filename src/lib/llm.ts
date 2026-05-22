import OpenAI from "openai";
import { getSetting } from "./db";
import { CommitInfo } from "./git";

const SYSTEM_PROMPT = `你是一个周报生成助手。根据用户提供的 git 提交记录，生成本周工作周报。

要求：
1. 如果涉及多个项目，先用二级标题 ## 按项目名称分组，在每个项目分组内再用三级标题 ### 按以下分类归纳：新功能、修复、重构、文档、其他
2. 如果仅单个项目，直接按以下分类归纳：新功能、修复、重构、文档、其他
3. 每个分类项下用简洁的中文描述工作内容
4. 合并相关的提交（如多个提交属于同一功能）
5. 保留关键的技术细节
6. 在每个分类项后标注贡献者（如 [@name]）
7. 在周报末尾列出参与人员名单
8. 输出格式为 Markdown
9. 如果某个分类没有内容，则不输出该分类`;

function formatCommits(commits: CommitInfo[]): string {
  // Group by repo name for display
  const grouped: Record<string, string[]> = {};
  for (const c of commits) {
    const repo = c.repoName || "default";
    if (!grouped[repo]) grouped[repo] = [];
    grouped[repo].push(`  - [${c.date}] ${c.authorName}: ${c.message}`);
  }

  let result = "";
  for (const [repo, items] of Object.entries(grouped)) {
    result += `[${repo}]\n${items.join("\n")}\n\n`;
  }
  return result.trim();
}

export async function generateReportWithLLM(commits: CommitInfo[], memberNames: string[]): Promise<string> {
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
  const membersText = memberNames.length > 0 ? `\n\n参与人员：${memberNames.join("、")}` : "";
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `以下是本周的 git 提交记录：\n\n${commitsText}${membersText}` },
    ],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content ?? "";
}

// Fallback: rule-based classification when LLM is unavailable
export function classifyCommitsByRules(commits: CommitInfo[], memberNames: string[]): string {
  // Group commits by repo first
  const repos: Record<string, CommitInfo[]> = {};
  for (const commit of commits) {
    const repo = commit.repoName || "default";
    if (!repos[repo]) repos[repo] = [];
    repos[repo].push(commit);
  }

  const patterns: Record<string, RegExp> = {
    "新功能": /^(feat|add|feature|新增|添加)/i,
    "修复": /^(fix|bug|hotfix|修复|修补)/i,
    "重构": /^(refactor|重构|优化)/i,
    "文档": /^(docs|doc|文档|readme)/i,
  };

  let markdown = "";
  const allAuthors = new Set<string>();

  for (const [repoName, repoCommits] of Object.entries(repos)) {
    const categories: Record<string, { items: string[]; authors: Set<string> }> = {
      "新功能": { items: [], authors: new Set() },
      "修复": { items: [], authors: new Set() },
      "重构": { items: [], authors: new Set() },
      "文档": { items: [], authors: new Set() },
      "其他": { items: [], authors: new Set() },
    };

    for (const commit of repoCommits) {
      const msg = commit.message;
      let classified = false;
      for (const [category, pattern] of Object.entries(patterns)) {
        if (pattern.test(msg)) {
          categories[category].items.push(msg);
          categories[category].authors.add(commit.authorName);
          classified = true;
          break;
        }
      }
      if (!classified) {
        categories["其他"].items.push(msg);
        categories["其他"].authors.add(commit.authorName);
      }
      allAuthors.add(commit.authorName);
    }

    if (Object.keys(repos).length > 1) {
      markdown += `## ${repoName}\n\n`;
    }
    for (const [category, { items, authors }] of Object.entries(categories)) {
      if (items.length === 0) continue;
      markdown += `### ${category}\n\n`;
      for (const item of items) {
        markdown += `- ${item}\n`;
      }
      markdown += "\n";
    }
  }

  // Add members section
  const displayNames = memberNames.length > 0 ? memberNames : [...allAuthors];
  markdown += `---\n\n**参与人员：** ${displayNames.join("、")}\n`;

  return markdown.trim();
}
