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
