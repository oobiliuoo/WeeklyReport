import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "weekly-report.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  migrate(_db);
  return _db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS repositories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      path        TEXT NOT NULL UNIQUE,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS members (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL,
      repo_id       INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      display_name  TEXT,
      UNIQUE(name, email, repo_id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start  TEXT NOT NULL,
      week_end    TEXT NOT NULL,
      content     TEXT NOT NULL,
      member_ids  TEXT NOT NULL,
      repo_ids    TEXT NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// Repositories
export function getRepos() {
  return getDb().prepare("SELECT * FROM repositories ORDER BY created_at DESC").all() as RepoRow[];
}

export function getRepoById(id: number) {
  return getDb().prepare("SELECT * FROM repositories WHERE id = ?").get(id) as RepoRow | undefined;
}

export function addRepo(name: string, path: string) {
  const now = new Date().toISOString();
  const result = getDb().prepare("INSERT INTO repositories (name, path, created_at, updated_at) VALUES (?, ?, ?, ?)").run(name, path, now, now);
  return result.lastInsertRowid;
}

export function deleteRepo(id: number) {
  getDb().prepare("DELETE FROM repositories WHERE id = ?").run(id);
}

// Members
export function getMembersByRepoId(repoId: number) {
  return getDb().prepare("SELECT * FROM members WHERE repo_id = ? ORDER BY name").all(repoId) as MemberRow[];
}

export function getAllMembersByRepoIds(repoIds: number[]) {
  const placeholders = repoIds.map(() => "?").join(",");
  return getDb().prepare(`SELECT * FROM members WHERE repo_id IN (${placeholders}) ORDER BY name`).all(...repoIds) as MemberRow[];
}

export function upsertMember(name: string, email: string, repoId: number, displayName?: string) {
  getDb().prepare(
    "INSERT INTO members (name, email, repo_id, display_name) VALUES (?, ?, ?, ?) ON CONFLICT(name, email, repo_id) DO UPDATE SET display_name = COALESCE(excluded.display_name, members.display_name)"
  ).run(name, email, repoId, displayName ?? null);
}

export function updateMemberDisplayName(id: number, displayName: string) {
  getDb().prepare("UPDATE members SET display_name = ? WHERE id = ?").run(displayName, id);
}

export function getMembersByIds(ids: number[]): MemberRow[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  return getDb().prepare(`SELECT * FROM members WHERE id IN (${placeholders})`).all(...ids) as MemberRow[];
}

// Reports
export function getReports() {
  return getDb().prepare("SELECT * FROM reports ORDER BY week_start DESC").all() as ReportRow[];
}

export function getReportById(id: number) {
  return getDb().prepare("SELECT * FROM reports WHERE id = ?").get(id) as ReportRow | undefined;
}

export function saveReport(weekStart: string, weekEnd: string, content: string, memberIds: number[], repoIds: number[]) {
  const now = new Date().toISOString();
  const result = getDb().prepare(
    "INSERT INTO reports (week_start, week_end, content, member_ids, repo_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(weekStart, weekEnd, content, JSON.stringify(memberIds), JSON.stringify(repoIds), now, now);
  return result.lastInsertRowid;
}

export function updateReport(id: number, content: string) {
  const now = new Date().toISOString();
  getDb().prepare("UPDATE reports SET content = ?, updated_at = ? WHERE id = ?").run(content, now, id);
}

export function deleteReport(id: number) {
  getDb().prepare("DELETE FROM reports WHERE id = ?").run(id);
}

// Settings
export function getSetting(key: string): string | undefined {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string) {
  getDb().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

export function getAllSettings() {
  return getDb().prepare("SELECT * FROM settings").all() as { key: string; value: string }[];
}

// Types
export interface RepoRow {
  id: number;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
}

export interface MemberRow {
  id: number;
  name: string;
  email: string;
  repo_id: number;
  display_name: string | null;
}

export interface ReportRow {
  id: number;
  week_start: string;
  week_end: string;
  content: string;
  member_ids: string;
  repo_ids: string;
  created_at: string;
  updated_at: string;
}
