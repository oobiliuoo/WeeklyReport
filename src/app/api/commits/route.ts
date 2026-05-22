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
