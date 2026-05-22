import { NextRequest, NextResponse } from "next/server";
import { getReports, getReportById, saveReport, updateReport, deleteReport } from "@/lib/db";
import { exportReportToMarkdown, generateReport } from "@/lib/report";

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
  const { weekStart, weekEnd, commits, memberIds, repoIds } = body;

  if (!weekStart || !weekEnd || !memberIds || !repoIds) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  // If commits are provided, generate report via LLM
  let content = body.content;
  if (commits && Array.isArray(commits) && commits.length > 0) {
    content = await generateReport(commits, weekStart, weekEnd);
  }

  if (!content) {
    return NextResponse.json({ error: "生成周报失败" }, { status: 500 });
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
