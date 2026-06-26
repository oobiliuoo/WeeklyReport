import { NextRequest, NextResponse } from "next/server";
import { getReports, getReportById, saveReport, updateReport, deleteReport, getMembersByIds, getRepoById, getMembersByRepoId } from "@/lib/db";
import { exportReportToMarkdown, generateReport } from "@/lib/report";
import { getCommits } from "@/lib/git";

function resolveMembers(memberIds: number[]) {
  const members = getMembersByIds(memberIds);
  const seen = new Set<string>();
  return members
    .map((m) => m.display_name || m.name)
    .filter((name) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
}

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

    if (action === "regenerate") {
      const memberIds = JSON.parse(report.member_ids || "[]") as number[];
      const repoIds = JSON.parse(report.repo_ids || "[]") as number[];

      // Collect author names/emails for filtering
      const authors: string[] = [];
      if (memberIds.length > 0) {
        for (const repoId of repoIds) {
          const members = getMembersByRepoId(repoId);
          for (const m of members) {
            if (memberIds.includes(m.id)) {
              authors.push(m.name);
              authors.push(m.email);
            }
          }
        }
      }

      // Re-fetch commits from all repos
      const allCommits = await Promise.all(
        repoIds.map(async (repoId: number) => {
          const repo = getRepoById(repoId);
          if (!repo) return [];
          const commits = await getCommits(repo.path, authors, report.week_start, report.week_end);
          return commits.map((c) => ({ ...c, repoName: repo.name }));
        })
      );
      const commits = allCommits.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (commits.length === 0) {
        return NextResponse.json({ error: "所选时间范围内无提交记录，无法重新生成" }, { status: 400 });
      }

      // Regenerate report content
      const memberNames = resolveMembers(memberIds);
      const content = await generateReport(commits, report.week_start, report.week_end, memberNames);
      updateReport(report.id, content);

      const updated = getReportById(report.id);
      return NextResponse.json({ ...updated, members: resolveMembers(JSON.parse(updated!.member_ids || "[]") as number[]) });
    }

    const memberIds = JSON.parse(report.member_ids || "[]") as number[];
    return NextResponse.json({ ...report, members: resolveMembers(memberIds) });
  }

  const reports = getReports();
  const enriched = reports.map((r) => {
    const memberIds = JSON.parse(r.member_ids || "[]") as number[];
    return { ...r, members: resolveMembers(memberIds) };
  });
  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { weekStart, weekEnd, commits, memberIds, repoIds } = body;

  if (!weekStart || !weekEnd || !memberIds || !repoIds) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  // If commits are provided, generate report via LLM
  let content = body.content;
  if (commits && Array.isArray(commits) && commits.length > 0) {
    const memberNames = resolveMembers(memberIds as number[]);
    content = await generateReport(commits, weekStart, weekEnd, memberNames);
  }

  if (!content) {
    return NextResponse.json({ error: "生成周报失败" }, { status: 500 });
  }

  const id = saveReport(weekStart, weekEnd, content, memberIds, repoIds);
  const report = getReportById(Number(id));
  const memberNames = resolveMembers(JSON.parse(report!.member_ids || "[]") as number[]);
  return NextResponse.json({ ...report, members: memberNames }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, content } = body;

  if (!id || !content) {
    return NextResponse.json({ error: "缺少 id 或 content" }, { status: 400 });
  }

  updateReport(id, content);
  const report = getReportById(id);
  if (!report) return NextResponse.json({ error: "周报不存在" }, { status: 404 });
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
