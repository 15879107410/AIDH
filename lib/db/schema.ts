import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const folders = sqliteTable("folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  logoUrl: text("logo_url").notNull(),
  description: text("description").notNull(),
  folderId: text("folder_id"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  pinnedOrder: integer("pinned_order"),
  visitCount: integer("visit_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique()
});

export const bookmarkTags = sqliteTable(
  "bookmark_tags",
  {
    bookmarkId: text("bookmark_id").notNull(),
    tagId: text("tag_id").notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bookmarkId, table.tagId] })
  })
);
