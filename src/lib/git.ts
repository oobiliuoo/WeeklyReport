import { simpleGit, SimpleGit } from "simple-git";
import fs from "fs";
import { upsertMember } from "./db";

export interface CommitInfo {
  hash: string;
  date: string;
  message: string;
  authorName: string;
  authorEmail: string;
  repoName?: string;
}

export interface ContributorInfo {
  name: string;
  email: string;
}

export async function validateRepo(repoPath: string): Promise<{ valid: boolean; error?: string }> {
  if (!fs.existsSync(repoPath)) {
    return { valid: false, error: "路径不存在" };
  }
  const git: SimpleGit = simpleGit(repoPath);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    return { valid: false, error: "不是有效的 git 仓库" };
  }
  return { valid: true };
}

export async function getContributors(repoPath: string): Promise<ContributorInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);
  const log = await git.log(["--all"]);
  const seen = new Set<string>();
  const contributors: ContributorInfo[] = [];

  for (const entry of log.all) {
    const key = `${entry.author_name}|${entry.author_email}`;
    if (!seen.has(key)) {
      seen.add(key);
      contributors.push({ name: entry.author_name, email: entry.author_email });
    }
  }

  return contributors;
}

export async function syncContributorsToDb(repoId: number, repoPath: string): Promise<void> {
  const contributors = await getContributors(repoPath);
  for (const c of contributors) {
    upsertMember(c.name, c.email, repoId);
  }
}

export async function getCommits(
  repoPath: string,
  authors: string[],
  since: string,
  until: string
): Promise<CommitInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);

  // Git --until is exclusive (<), so add 1 day to make the end date inclusive
  const untilDate = new Date(until);
  untilDate.setDate(untilDate.getDate() + 1);
  const untilInclusive = untilDate.toISOString().slice(0, 10);

  const result = await git.log(["--all", `--since=${since}`, `--until=${untilInclusive}`]);

  const commits: CommitInfo[] = [];
  for (const entry of result.all) {
    if (authors.length > 0 && !authors.includes(entry.author_name) && !authors.includes(entry.author_email)) {
      continue;
    }
    commits.push({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      authorName: entry.author_name,
      authorEmail: entry.author_email,
    });
  }

  return commits;
}
