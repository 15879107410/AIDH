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
export const MAX_DOCK_ITEMS = 20;

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

function pinnedCount() {
  const row = db.select({ value: sql<number>`count(*)` }).from(bookmarks).where(eq(bookmarks.pinned, true)).get();
  return row?.value ?? 0;
}

export function canPinBookmark(bookmarkId?: string | null) {
  ensureDb();
  if (bookmarkId) {
    const current = getBookmark(bookmarkId);
    if (current?.pinned) return true;
  }
  return pinnedCount() < MAX_DOCK_ITEMS;
}

const equivalentHostRoots = ["magicui.design"];

const folderRenames = [
  ["fld_open_source", "AI编程"],
  ["fld_ai_coding", "后端"],
  ["fld_09c8e6d3188e4280b4", "代码管理"],
  ["fld_ui_design", "前端"],
  ["fld_ui_proto", "UI原型库"],
  ["fld_ui_component", "UI组件库"],
  ["fld_data_cloud", "数据存储"],
  ["fld_database", "数据库"],
  ["fld_cloud_storage", "云存储"],
  ["fld_deploy_growth", "部署上线"],
  ["fld_domain", "域名服务器"],
  ["fld_model_api", "API"],
  ["fld_model_eval", "榜单"],
  ["fld_open_source_skill", "skill库"],
  ["fld_open_source_mcp", "mcp库"],
  ["fld_product_cases", "AIGC"],
  ["fld_gen", "图像生成"],
  ["fld_learning", "课程学习"],
  ["fld_analytics", "数据分析"]
] as const;

const folderHierarchy = [
  ["fld_open_source", null, 1],
  ["fld_ai_coding", "fld_open_source", 1],
  ["fld_09c8e6d3188e4280b4", "fld_ai_coding", 1],
  ["fld_ui_design", "fld_open_source", 2],
  ["fld_ui_proto", "fld_ui_design", 1],
  ["fld_ui_component", "fld_ui_design", 2],
  ["fld_data_cloud", "fld_open_source", 3],
  ["fld_database", "fld_data_cloud", 1],
  ["fld_cloud_storage", "fld_data_cloud", 2],
  ["fld_deploy_growth", "fld_open_source", 4],
  ["fld_domain", "fld_deploy_growth", 1],
  ["fld_model_api", "fld_open_source", 5],
  ["fld_model_eval", "fld_model_api", 1],
  ["fld_open_source_skill", "fld_open_source", 6],
  ["fld_open_source_mcp", "fld_open_source", 7],
  ["fld_analytics", "fld_open_source", 8],
  ["fld_product_cases", null, 2],
  ["fld_gen", "fld_product_cases", 1],
  ["fld_learning", null, 3]
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
  migrateBookmarkFolders();
  enforceDockLimit();
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

function migrateBookmarkFolders() {
  const t = now();
  db.update(bookmarks).set({ folderId: "fld_ai_coding", updatedAt: t }).where(eq(bookmarks.folderId, "fld_ai_coding")).run();
  db.update(bookmarks).set({ folderId: "fld_09c8e6d3188e4280b4", updatedAt: t }).where(eq(bookmarks.folderId, "fld_09c8e6d3188e4280b4")).run();
  db.update(bookmarks).set({ folderId: "fld_09c8e6d3188e4280b4", updatedAt: t }).where(sql`lower(title) like '%github%' or lower(url) like '%github%'`).run();
  db.update(bookmarks).set({ folderId: "fld_ui_proto", updatedAt: t }).where(sql`title in ('21st.dev')`).run();
  db.update(bookmarks).set({ folderId: "fld_ui_component", updatedAt: t }).where(sql`title in ('Magic UI', 'Animate UI', 'Aceternity UI', 'Supahero', 'Google Stitch')`).run();
  db.update(bookmarks).set({ folderId: "fld_database", updatedAt: t }).where(sql`title in ('Neon Console', 'Supabase Docs', 'TablePlus')`).run();
  db.update(bookmarks).set({ folderId: "fld_cloud_storage", updatedAt: t }).where(sql`title in ('腾讯云')`).run();
  db.update(bookmarks).set({ folderId: "fld_deploy_growth", updatedAt: t }).where(sql`title in ('Vercel', 'Next.js Showcase')`).run();
  db.update(bookmarks).set({ folderId: "fld_domain", updatedAt: t }).where(sql`title in ('Instant Domain Search', 'Namecheap')`).run();
  db.update(bookmarks).set({ folderId: "fld_model_eval", updatedAt: t }).where(sql`title in ('Arena Leaderboard', 'Artificial Analysis')`).run();
  db.update(bookmarks).set({ folderId: "fld_open_source_skill", updatedAt: t }).where(sql`title in ('skills.sh', 'TRAE 推荐 Skills')`).run();
  db.update(bookmarks).set({ folderId: "fld_open_source_mcp", updatedAt: t }).where(sql`title in ('OpenRouter', 'Postman')`).run();
  db.update(bookmarks).set({ folderId: "fld_gen", updatedAt: t }).where(sql`title in ('即梦 AI', 'Midjourney', 'Krea', 'Runway', 'DALL·E')`).run();
  db.update(bookmarks).set({ folderId: "fld_learning", updatedAt: t }).where(sql`title in ('X 设计彩蛋案例', 'evolink.ai', '生财有术深海圈课程')`).run();
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

function enforceDockLimit() {
  const t = now();
  const pinned = db.select().from(bookmarks).where(eq(bookmarks.pinned, true)).orderBy(asc(bookmarks.pinnedOrder), desc(bookmarks.updatedAt)).all();
  pinned.forEach((bookmark, index) => {
    db.update(bookmarks)
      .set({
        pinned: index < MAX_DOCK_ITEMS,
        pinnedOrder: index < MAX_DOCK_ITEMS ? index + 1 : null,
        updatedAt: t
      })
      .where(eq(bookmarks.id, bookmark.id))
      .run();
  });
}

function folderPathMap() {
  const rows = db.select().from(folders).all();
  const byId = new Map(rows.map((folder) => [folder.id, folder]));
  const cache = new Map<string, string>();
  const pathFor = (folderId: string): string => {
    const cached = cache.get(folderId);
    if (cached) return cached;
    const folder = byId.get(folderId);
    if (!folder) return "";
    const parentPath = folder.parentId ? pathFor(folder.parentId) : "";
    const path = parentPath ? `${parentPath} / ${folder.name}` : folder.name;
    cache.set(folderId, path);
    return path;
  };
  rows.forEach((folder) => pathFor(folder.id));
  return cache;
}

function folderHasDescendant(folderId: string, targetId: string): boolean {
  const children = db.select().from(folders).where(eq(folders.parentId, folderId)).all();
  return children.some((child) => child.id === targetId || folderHasDescendant(child.id, targetId));
}

function siblingFolderExists(name: string, parentId: string | null, exceptId?: string) {
  const trimmed = name.trim();
  const rows = db.select().from(folders).where(parentId ? eq(folders.parentId, parentId) : sql`${folders.parentId} is null`).all();
  return rows.some((folder) => folder.id !== exceptId && folder.name.trim().toLowerCase() === trimmed.toLowerCase());
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
  const name = input.name.trim();
  const parentId = input.parentId ?? null;
  if (!name) return { ok: false as const, message: "文件夹名称不能为空。" };
  if (siblingFolderExists(name, parentId)) {
    return { ok: false as const, message: "同级文件夹已存在同名项。" };
  }
  const max = db
    .select({ value: sql<number>`coalesce(max(${folders.sortOrder}), 0)` })
    .from(folders)
    .where(parentId ? eq(folders.parentId, parentId) : sql`${folders.parentId} is null`)
    .get();
  const row = {
    id: id("fld"),
    name,
    parentId,
    sortOrder: Number(max?.value ?? 0) + 1,
    createdAt: t,
    updatedAt: t
  };
  db.insert(folders).values(row).run();
  return { ok: true as const, folder: row };
}

export function updateFolder(folderId: string, input: { name?: string; parentId?: string | null }) {
  ensureDb();
  const current = db.select().from(folders).where(eq(folders.id, folderId)).get();
  if (!current) return { ok: false as const, message: "文件夹不存在。" };
  const name = input.name?.trim() || current.name;
  const parentId = input.parentId === undefined ? current.parentId : input.parentId;
  if (parentId === folderId || (parentId && folderHasDescendant(folderId, parentId))) {
    return { ok: false as const, message: "不能把文件夹移动到自己的下级。" };
  }
  if (siblingFolderExists(name, parentId ?? null, folderId)) {
    return { ok: false as const, message: "同级文件夹已存在同名项。" };
  }
  db.update(folders)
    .set({ name, parentId: parentId ?? null, updatedAt: now() })
    .where(eq(folders.id, folderId))
    .run();
  return { ok: true as const };
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
  const paths = folderPathMap();
  const tagRows = db
    .select({ name: tags.name })
    .from(bookmarkTags)
    .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
    .where(eq(bookmarkTags.bookmarkId, row.id))
    .orderBy(asc(tags.name))
    .all();
  return { ...row, folderPath: row.folderId ? paths.get(row.folderId) ?? row.folderName ?? null : null, tags: tagRows.map((tag) => tag.name) };
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
  if (input.pinned && !canPinBookmark()) {
    throw new Error("DOCK_LIMIT_REACHED");
  }
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
  pinnedOrder: number | null;
  tags: string[];
}>) {
  ensureDb();
  const current = getBookmark(bookmarkId);
  if (!current) return null;
  const pinnedBecameTrue = input.pinned === true && !current.pinned;
  if (pinnedBecameTrue && !canPinBookmark(bookmarkId)) {
    throw new Error("DOCK_LIMIT_REACHED");
  }
  const url = input.url ? bookmarkIdentityUrl(input.url) : current.url;
  db.update(bookmarks)
    .set({
      url,
      title: input.title ?? current.title,
      logoUrl: input.logoUrl ?? current.logoUrl,
      description: input.description ?? current.description,
      folderId: input.folderId === undefined ? current.folderId : input.folderId,
      pinned: input.pinned ?? current.pinned,
      pinnedOrder:
        input.pinnedOrder !== undefined
          ? input.pinnedOrder
          : pinnedBecameTrue
            ? nextPinnedOrder()
            : input.pinned === false
              ? null
              : current.pinnedOrder,
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

export function reorderPinnedBookmarks(ids: string[]) {
  ensureDb();
  if (ids.length > MAX_DOCK_ITEMS) {
    throw new Error("DOCK_LIMIT_REACHED");
  }
  const t = now();
  ids.forEach((id, index) => {
    db.update(bookmarks)
      .set({ pinned: true, pinnedOrder: index + 1, updatedAt: t })
      .where(eq(bookmarks.id, id))
      .run();
  });
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
