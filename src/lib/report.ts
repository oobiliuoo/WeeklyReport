import fs from "fs";
import path from "path";
import { CommitInfo } from "./git";
import { generateReportWithLLM, classifyCommitsByRules } from "./llm";

export async function generateReport(commits: CommitInfo[], weekStart: string, weekEnd: string, memberNames: string[]): Promise<string> {
  if (commits.length === 0) {
    return "本周无提交记录。";
  }

  try {
    const content = await generateReportWithLLM(commits, memberNames);
    return `# 周报 ${weekStart} ~ ${weekEnd}\n\n${content}`;
  } catch {
    // Fallback to rule-based classification
    const content = classifyCommitsByRules(commits, memberNames);
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
