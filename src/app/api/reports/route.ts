import { NextRequest, NextResponse } from "next/server";
import { getReports, getReportById, saveReport, updateReport, deleteReport, getMembersByIds } from "@/lib/db";
import { exportReportToMarkdown, generateReport } from "@/lib/report";

function resolveMembers(memberIds: number[]) {
  const members = getMembersByIds(memberIds);
  return members.map((m) => m.display_name || m.name);
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
