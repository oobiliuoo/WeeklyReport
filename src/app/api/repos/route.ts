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
