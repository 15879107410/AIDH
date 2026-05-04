import Database from "better-sqlite3";
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { bookmarks, bookmarkTags, folders, tags } from "./schema";
import type { Bookmark, FolderNode } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(path.join(dataDir, "aidh.sqlite"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);

let initialized = false;

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 18)}`;
}

function favicon(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

const equivalentHostRoots = ["magicui.design"];

const folderRenames = [
  ["fld_ai_coding", "编程"],
  ["fld_model_api", "模型 API"],
  ["fld_model_eval", "评测榜单"],
  ["fld_data_cloud", "数据云"],
  ["fld_ui_design", "UI 组件"],
  ["fld_deploy_growth", "部署增长"],
  ["fld_domain", "域名出海"],
  ["fld_analytics", "反馈分析"],
  ["fld_open_source", "开源源码"],
  ["fld_product_cases", "产品案例"],
  ["fld_learning", "课程阅读"],
  ["fld_agent", "编程"],
  ["fld_gen", "生图视频"],
  ["fld_write", "写作"],
  ["fld_design", "设计"],
  ["fld_docs", "文档"]
] as const;

const folderHierarchy = [
  ["fld_open_source", null, 1],
  ["fld_ai_coding", "fld_open_source", 1],
  ["fld_ui_design", "fld_open_source", 2],
  ["fld_model_api", null, 2],
  ["fld_model_eval", "fld_model_api", 1],
  ["fld_product_cases", "fld_model_api", 2],
  ["fld_data_cloud", null, 3],
  ["fld_deploy_growth", "fld_data_cloud", 1],
  ["fld_domain", "fld_deploy_growth", 1],
  ["fld_analytics", null, 4],
  ["fld_learning", "fld_analytics", 1]
] as const;

export function canonicalBookmarkUrl(value: string) {
  const parsed = new URL(value);
  return parsed.origin;
}

function bookmarkIdentityUrl(value: string) {
  const parsed = new URL(canonicalBookmarkUrl(value));
  const host = parsed.hostname.replace(/^www\./, "");
  const root = equivalentHostRoots.find((candidate) => host === candidate || host.endsWith(`.${candidate}`));
  if (root) return `${parsed.protocol}//${root}`;
  return `${parsed.protocol}//${host}`;
}

export function ensureDb() {
  if (initialized) return;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      logo_url TEXT NOT NULL,
      description TEXT NOT NULL,
      folder_id TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      pinned_order INTEGER,
      visit_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (bookmark_id, tag_id)
    );
  `);
  const columns = sqlite.prepare("PRAGMA table_info(bookmarks)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "visit_count")) {
    sqlite.exec("ALTER TABLE bookmarks ADD COLUMN visit_count INTEGER NOT NULL DEFAULT 0;");
  }

  const existing = sqlite.prepare("SELECT COUNT(*) AS count FROM folders").get() as { count: number };
  if (existing.count === 0) seed();
  migrateFolderNames();
  migrateFolderHierarchy();
  mergeEquivalentBookmarks();
  initialized = true;
}

function migrateFolderNames() {
  const t = now();
  const stmt = sqlite.prepare("UPDATE folders SET name = ?, updated_at = ? WHERE id = ? AND name <> ?");
  folderRenames.forEach(([folderId, name]) => stmt.run(name, t, folderId, name));
}

function migrateFolderHierarchy() {
  const t = now();
  const stmt = sqlite.prepare("UPDATE folders SET parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?");
  folderHierarchy.forEach(([folderId, parentId, sortOrder]) => stmt.run(parentId, sortOrder, t, folderId));
}

function mergeEquivalentBookmarks() {
  const rows = db.select().from(bookmarks).orderBy(desc(bookmarks.pinned), asc(bookmarks.createdAt)).all();
  const seen = new Map<string, string>();
  rows.forEach((bookmark) => {
    const identity = bookmarkIdentityUrl(bookmark.url);
    const existingId = seen.get(identity);
    if (!existingId) {
      seen.set(identity, bookmark.id);
      return;
    }
    db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmark.id)).run();
    db.delete(bookmarks).where(eq(bookmarks.id, bookmark.id)).run();
  });
}

function seed() {
  const t = now();
  const folderRows = [
    { id: "fld_ai", name: "AI 工具", parentId: null, sortOrder: 1, createdAt: t, updatedAt: t },
    { id: "fld_gen", name: "生图生视频", parentId: "fld_ai", sortOrder: 1, createdAt: t, updatedAt: t },
    { id: "fld_write", name: "AI 写作", parentId: "fld_ai", sortOrder: 2, createdAt: t, updatedAt: t },
    { id: "fld_agent", name: "Agent / 编程", parentId: "fld_ai", sortOrder: 3, createdAt: t, updatedAt: t },
    { id: "fld_design", name: "设计灵感", parentId: null, sortOrder: 2, createdAt: t, updatedAt: t },
    { id: "fld_docs", name: "开发文档", parentId: null, sortOrder: 3, createdAt: t, updatedAt: t }
  ];
  db.insert(folders).values(folderRows).run();

  const samples = [
    {
      id: "bm_openai",
      url: "https://openai.com/",
      title: "OpenAI",
      logoUrl: favicon("openai.com"),
      description: "模型、API 与研究动态，适合跟踪 AI 产品和开发能力。",
      folderId: "fld_agent",
      pinned: true,
      pinnedOrder: 1,
      visitCount: 42,
      tags: ["模型", "API", "Agent"]
    },
    {
      id: "bm_jimeng",
      url: "https://jimeng.jianying.com/",
      title: "即梦 AI",
      logoUrl: favicon("jimeng.jianying.com"),
      description: "字节旗下 AI 创作工具，支持文生图、图生图和视频生成。",
      folderId: "fld_gen",
      pinned: true,
      pinnedOrder: 2,
      visitCount: 36,
      tags: ["生图", "生视频", "AIGC"]
    },
    {
      id: "bm_midjourney",
      url: "https://www.midjourney.com/",
      title: "Midjourney",
      logoUrl: favicon("midjourney.com"),
      description: "高质量图片生成工具，适合视觉探索、海报和概念图。",
      folderId: "fld_gen",
      pinned: false,
      pinnedOrder: null,
      visitCount: 28,
      tags: ["生图", "设计", "灵感"]
    },
    {
      id: "bm_krea",
      url: "https://www.krea.ai/",
      title: "Krea",
      logoUrl: favicon("krea.ai"),
      description: "实时生成和图片增强，适合快速预览创意方向。",
      folderId: "fld_gen",
      pinned: false,
      pinnedOrder: null,
      visitCount: 15,
      tags: ["生图", "实时生成"]
    },
    {
      id: "bm_notion",
      url: "https://www.notion.so/",
      title: "Notion",
      logoUrl: favicon("notion.so"),
      description: "知识库、文档与协作工作台，适合整理项目资料。",
      folderId: "fld_docs",
      pinned: true,
      pinnedOrder: 3,
      visitCount: 22,
      tags: ["文档", "知识库"]
    },
    {
      id: "bm_figma",
      url: "https://www.figma.com/",
      title: "Figma",
      logoUrl: favicon("figma.com"),
      description: "协作式设计工具，适合 UI 设计、原型和设计系统。",
      folderId: "fld_design",
      pinned: true,
      pinnedOrder: 4,
      visitCount: 31,
      tags: ["设计", "原型"]
    }
  ];

  samples.forEach((sample) => {
    db.insert(bookmarks)
      .values({
        id: sample.id,
        url: sample.url,
        title: sample.title,
        logoUrl: sample.logoUrl,
        description: sample.description,
        folderId: sample.folderId,
        pinned: sample.pinned,
        pinnedOrder: sample.pinnedOrder,
        visitCount: sample.visitCount,
        createdAt: t,
        updatedAt: t
      })
      .run();
    setBookmarkTags(sample.id, sample.tags);
  });
}

export function listFolders(): FolderNode[] {
  ensureDb();
  const rows = db.select().from(folders).orderBy(asc(folders.sortOrder), asc(folders.name)).all();
  const counts = db
    .select({ folderId: bookmarks.folderId, count: sql<number>`count(*)` })
    .from(bookmarks)
    .groupBy(bookmarks.folderId)
    .all();
  const countMap = new Map(counts.map((row) => [row.folderId, Number(row.count)]));
  const nodeMap = new Map<string, FolderNode>();
  rows.forEach((folder) => {
    nodeMap.set(folder.id, { ...folder, count: countMap.get(folder.id) ?? 0, children: [] });
  });
  const roots: FolderNode[] = [];
  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const rollup = (node: FolderNode): number => {
    node.count += node.children.reduce((sum, child) => sum + rollup(child), 0);
    return node.count;
  };
  roots.forEach(rollup);
  return roots;
}

export function createFolder(input: { name: string; parentId?: string | null }) {
  ensureDb();
  const t = now();
  const max = db
    .select({ value: sql<number>`coalesce(max(${folders.sortOrder}), 0)` })
    .from(folders)
    .where(input.parentId ? eq(folders.parentId, input.parentId) : sql`${folders.parentId} is null`)
    .get();
  const row = {
    id: id("fld"),
    name: input.name.trim(),
    parentId: input.parentId ?? null,
    sortOrder: Number(max?.value ?? 0) + 1,
    createdAt: t,
    updatedAt: t
  };
  db.insert(folders).values(row).run();
  return row;
}

export function updateFolder(folderId: string, input: { name?: string; parentId?: string | null }) {
  ensureDb();
  db.update(folders)
    .set({ ...input, updatedAt: now() })
    .where(eq(folders.id, folderId))
    .run();
}

export function deleteFolder(folderId: string) {
  ensureDb();
  const child = db.select().from(folders).where(eq(folders.parentId, folderId)).limit(1).get();
  const bookmark = db.select().from(bookmarks).where(eq(bookmarks.folderId, folderId)).limit(1).get();
  if (child || bookmark) {
    return { ok: false, message: "请先移动或删除该文件夹内的内容。" };
  }
  db.delete(folders).where(eq(folders.id, folderId)).run();
  return { ok: true };
}

export function listBookmarks(filter: { folderId?: string | null; q?: string; tag?: string; pinned?: boolean } = {}) {
  ensureDb();
  const conditions = [];
  if (filter.folderId) conditions.push(eq(bookmarks.folderId, filter.folderId));
  if (typeof filter.pinned === "boolean") conditions.push(eq(bookmarks.pinned, filter.pinned));
  const q = filter.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        like(bookmarks.title, pattern),
        like(bookmarks.url, pattern),
        like(bookmarks.description, pattern),
        inArray(
          bookmarks.id,
          db
            .select({ bookmarkId: bookmarkTags.bookmarkId })
            .from(bookmarkTags)
            .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
            .where(like(tags.name, pattern))
        )
      )
    );
  }
  if (filter.tag) {
    conditions.push(
      inArray(
        bookmarks.id,
        db
          .select({ bookmarkId: bookmarkTags.bookmarkId })
          .from(bookmarkTags)
          .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
          .where(eq(tags.name, filter.tag))
      )
    );
  }

  const rows = db
    .select({
      id: bookmarks.id,
      url: bookmarks.url,
      title: bookmarks.title,
      logoUrl: bookmarks.logoUrl,
      description: bookmarks.description,
      folderId: bookmarks.folderId,
      folderName: folders.name,
      pinned: bookmarks.pinned,
      pinnedOrder: bookmarks.pinnedOrder,
      visitCount: bookmarks.visitCount,
      createdAt: bookmarks.createdAt,
      updatedAt: bookmarks.updatedAt
    })
    .from(bookmarks)
    .leftJoin(folders, eq(bookmarks.folderId, folders.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(bookmarks.pinned), asc(bookmarks.pinnedOrder), desc(bookmarks.updatedAt))
    .all();
  return rows.map(withTags);
}

function withTags(row: Omit<Bookmark, "tags">): Bookmark {
  const tagRows = db
    .select({ name: tags.name })
    .from(bookmarkTags)
    .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
    .where(eq(bookmarkTags.bookmarkId, row.id))
    .orderBy(asc(tags.name))
    .all();
  return { ...row, tags: tagRows.map((tag) => tag.name) };
}

export function getBookmark(bookmarkId: string) {
  ensureDb();
  const row = db
    .select({
      id: bookmarks.id,
      url: bookmarks.url,
      title: bookmarks.title,
      logoUrl: bookmarks.logoUrl,
      description: bookmarks.description,
      folderId: bookmarks.folderId,
      folderName: folders.name,
      pinned: bookmarks.pinned,
      pinnedOrder: bookmarks.pinnedOrder,
      visitCount: bookmarks.visitCount,
      createdAt: bookmarks.createdAt,
      updatedAt: bookmarks.updatedAt
    })
    .from(bookmarks)
    .leftJoin(folders, eq(bookmarks.folderId, folders.id))
    .where(eq(bookmarks.id, bookmarkId))
    .get();
  return row ? withTags(row) : null;
}

export function createBookmark(input: {
  url: string;
  title: string;
  logoUrl: string;
  description: string;
  folderId?: string | null;
  pinned?: boolean;
  tags?: string[];
}) {
  ensureDb();
  const t = now();
  const url = canonicalBookmarkUrl(input.url);
  const identityUrl = bookmarkIdentityUrl(url);
  const existing = db
    .select()
    .from(bookmarks)
    .where(or(eq(bookmarks.url, url), eq(bookmarks.url, identityUrl)))
    .get();
  if (existing) {
    return updateBookmark(existing.id, {
      title: input.title,
      logoUrl: input.logoUrl,
      description: input.description,
      folderId: input.folderId ?? null,
      pinned: input.pinned,
      tags: input.tags
    });
  }
  const row = {
    id: id("bm"),
    url: identityUrl,
    title: input.title.trim() || url,
    logoUrl: input.logoUrl || favicon(new URL(url).hostname),
    description: input.description.trim(),
    folderId: input.folderId ?? null,
    pinned: Boolean(input.pinned),
    pinnedOrder: input.pinned ? nextPinnedOrder() : null,
    visitCount: 0,
    createdAt: t,
    updatedAt: t
  };
  db.insert(bookmarks).values(row).run();
  setBookmarkTags(row.id, input.tags ?? []);
  return getBookmark(row.id)!;
}

export function updateBookmark(bookmarkId: string, input: Partial<{
  url: string;
  title: string;
  logoUrl: string;
  description: string;
  folderId: string | null;
  pinned: boolean;
  tags: string[];
}>) {
  ensureDb();
  const current = getBookmark(bookmarkId);
  if (!current) return null;
  const pinnedBecameTrue = input.pinned === true && !current.pinned;
  const url = input.url ? bookmarkIdentityUrl(input.url) : current.url;
  db.update(bookmarks)
    .set({
      url,
      title: input.title ?? current.title,
      logoUrl: input.logoUrl ?? current.logoUrl,
      description: input.description ?? current.description,
      folderId: input.folderId === undefined ? current.folderId : input.folderId,
      pinned: input.pinned ?? current.pinned,
      pinnedOrder: pinnedBecameTrue ? nextPinnedOrder() : input.pinned === false ? null : current.pinnedOrder,
      updatedAt: now()
    })
    .where(eq(bookmarks.id, bookmarkId))
    .run();
  if (input.tags) setBookmarkTags(bookmarkId, input.tags);
  return getBookmark(bookmarkId);
}

export function deleteBookmark(bookmarkId: string) {
  ensureDb();
  db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmarkId)).run();
  db.delete(bookmarks).where(eq(bookmarks.id, bookmarkId)).run();
}

export function recordBookmarkVisit(bookmarkId: string) {
  ensureDb();
  const bookmark = getBookmark(bookmarkId);
  if (!bookmark) return null;
  db.update(bookmarks)
    .set({ visitCount: bookmark.visitCount + 1 })
    .where(eq(bookmarks.id, bookmarkId))
    .run();
  return getBookmark(bookmarkId);
}

function nextPinnedOrder() {
  const row = db.select({ value: sql<number>`coalesce(max(${bookmarks.pinnedOrder}), 0)` }).from(bookmarks).get();
  return Number(row?.value ?? 0) + 1;
}

export function setBookmarkTags(bookmarkId: string, names: string[]) {
  const cleaned = [...new Set(names.map((tag) => tag.trim()).filter(Boolean))].slice(0, 8);
  db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmarkId)).run();
  cleaned.forEach((name) => {
    let tag = db.select().from(tags).where(eq(tags.name, name)).get();
    if (!tag) {
      tag = { id: id("tag"), name };
      db.insert(tags).values(tag).run();
    }
    db.insert(bookmarkTags).values({ bookmarkId, tagId: tag.id }).onConflictDoNothing().run();
  });
}

export function listTags() {
  ensureDb();
  return db.select().from(tags).orderBy(asc(tags.name)).all();
}
