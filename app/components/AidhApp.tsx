"use client";

import {
  ChevronDown,
  ChevronRight,
  Clock3,
  FolderClosed,
  FolderPlus,
  Grid2X2,
  Home,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Tag,
  Trash2,
  X
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AiPreview, Bookmark, FolderNode } from "@/lib/types";
import { SpotlightSearch } from "./SpotlightSearch";

type ViewMode = "all" | "pinned" | "recent" | "folder";
type AiState = "idle" | "loading" | "success" | "error";
type WorkbenchMode = "bookmark" | "folder" | null;

type BookmarkForm = {
  id?: string;
  url: string;
  title: string;
  logoUrl: string;
  description: string;
  folderId: string | null;
  tags: string;
  pinned: boolean;
};

const emptyForm: BookmarkForm = {
  url: "",
  title: "",
  logoUrl: "",
  description: "",
  folderId: null,
  tags: "",
  pinned: false
};

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function flattenFolders(nodes: FolderNode[]): FolderNode[] {
  return nodes.flatMap((node) => [node, ...flattenFolders(node.children)]);
}

export function AidhApp() {
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [query, setQuery] = useState("");
  const [workbenchMode, setWorkbenchMode] = useState<WorkbenchMode>(null);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [form, setForm] = useState<BookmarkForm>(emptyForm);
  const [folderForm, setFolderForm] = useState({ id: "", name: "", parentId: "" });
  const [aiState, setAiState] = useState<AiState>("idle");
  const [aiMessage, setAiMessage] = useState("输入网址后，AI 会先模拟识别标题、Logo、简介和标签。");
  const [toast, setToast] = useState("");
  const dockItemRefs = useRef<(HTMLElement | null)[]>([]);
  const dockCenters = useRef<number[]>([]);
  const dockFrame = useRef<number | null>(null);
  const dockMouseX = useRef<number | null>(null);

  const flatFolders = useMemo(() => flattenFolders(folders), [folders]);
  const pinnedBookmarks = bookmarks.filter((bookmark) => bookmark.pinned).slice(0, 8);
  const recentBookmarks = [...bookmarks]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  const visibleBookmarks = useMemo(() => {
    const base =
      viewMode === "pinned"
        ? bookmarks.filter((bookmark) => bookmark.pinned)
        : viewMode === "recent"
          ? recentBookmarks
          : viewMode === "folder" && selectedFolderId
            ? bookmarks.filter((bookmark) => bookmark.folderId === selectedFolderId)
            : bookmarks;
    const needle = query.trim().toLowerCase();
    if (!needle) return base;
    return base.filter((bookmark) =>
      [bookmark.title, bookmark.url, bookmark.description, bookmark.folderName ?? "", ...bookmark.tags]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [bookmarks, query, recentBookmarks, selectedFolderId, viewMode]);

  const refresh = useCallback(async () => {
    const [folderRes, bookmarkRes] = await Promise.all([fetch("/api/folders"), fetch("/api/bookmarks")]);
    const folderJson = await folderRes.json();
    const bookmarkJson = await bookmarkRes.json();
    setFolders(folderJson.folders);
    setBookmarks(bookmarkJson.bookmarks);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSpotlightOpen(true);
      }
      if (event.key === "Escape") {
        setSpotlightOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    return () => {
      if (dockFrame.current) cancelAnimationFrame(dockFrame.current);
    };
  }, []);

  function cacheDockCenters() {
    dockCenters.current = dockItemRefs.current.map((node) => {
      if (!node) return 0;
      const rect = node.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
  }

  function updateDockMagnification() {
    dockFrame.current = null;
    const mouseX = dockMouseX.current;
    dockItemRefs.current.forEach((node, index) => {
      if (!node) return;
      let scale = 1;
      let lift = 0;
      if (mouseX !== null) {
        const center = dockCenters.current[index] || 0;
        const distance = Math.abs(mouseX - center);
        const influence = Math.max(0, 1 - distance / 168);
        const eased = 1 - Math.pow(1 - influence, 2.4);
        scale = 1 + eased * 0.44;
        lift = -eased * 24;
      }
      node.style.setProperty("--dock-scale", scale.toFixed(4));
      node.style.setProperty("--dock-lift", `${lift.toFixed(2)}px`);
    });
  }

  function scheduleDockUpdate(mouseX: number | null) {
    dockMouseX.current = mouseX;
    if (dockFrame.current) return;
    dockFrame.current = requestAnimationFrame(updateDockMagnification);
  }

  function enterDock(target: HTMLElement) {
    target.classList.add("is-active");
    cacheDockCenters();
  }

  function leaveDock(target: HTMLElement) {
    target.classList.remove("is-active");
    scheduleDockUpdate(null);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2000);
  }

  function openAdd() {
    setForm({ ...emptyForm, folderId: selectedFolderId });
    setAiState("idle");
    setAiMessage("输入网址后，AI 会先模拟识别标题、Logo、简介和标签。");
    setWorkbenchMode("bookmark");
  }

  function openEdit(bookmark: Bookmark) {
    setForm({
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title,
      logoUrl: bookmark.logoUrl,
      description: bookmark.description,
      folderId: bookmark.folderId,
      tags: bookmark.tags.join(", "),
      pinned: bookmark.pinned
    });
    setAiState("success");
    setAiMessage("正在编辑已保存收藏。");
    setWorkbenchMode("bookmark");
  }

  async function inspectUrl() {
    const url = normalizeUrl(form.url);
    if (!url) {
      setAiState("error");
      setAiMessage("先输入一个网址，AI 才能开始识别。");
      return;
    }
    setAiState("loading");
    setAiMessage("AI 正在读取网页线索并生成标签建议...");
    const response = await fetch("/api/ai/preview-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    if (!response.ok) {
      setAiState("error");
      setAiMessage("这个网址暂时无法识别，你仍然可以手动填写后保存。");
      return;
    }
    const json = (await response.json()) as { preview: AiPreview };
    setForm((current) => ({
      ...current,
      url,
      title: json.preview.title,
      logoUrl: json.preview.logoUrl,
      description: json.preview.description,
      folderId: json.preview.suggestedFolderId ?? current.folderId,
      tags: json.preview.tags.join(", ")
    }));
    setAiState("success");
    setAiMessage(
      json.preview.suggestedFolderName
        ? `建议放入「${json.preview.suggestedFolderName}」，置信度 ${Math.round(json.preview.confidence * 100)}%。`
        : "已生成基础信息，建议手动选择文件夹。"
    );
  }

  async function saveBookmark(event: FormEvent) {
    event.preventDefault();
    const payload = {
      url: normalizeUrl(form.url),
      title: form.title,
      logoUrl: form.logoUrl,
      description: form.description,
      folderId: form.folderId || null,
      pinned: form.pinned,
      tags: form.tags
        .split(/[，,]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    };
    const response = await fetch(form.id ? `/api/bookmarks/${form.id}` : "/api/bookmarks", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const json = await response.json();
      showToast(json.message ?? "保存失败");
      return;
    }
    setWorkbenchMode(null);
    await refresh();
    showToast(form.id ? "收藏已更新" : "已保存到收藏");
  }

  async function togglePinned(bookmark: Bookmark) {
    await fetch(`/api/bookmarks/${bookmark.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !bookmark.pinned })
    });
    await refresh();
    showToast(bookmark.pinned ? "已从 Dock 移除" : "已加入 Dock 常用");
  }

  async function removeBookmark(bookmark: Bookmark) {
    await fetch(`/api/bookmarks/${bookmark.id}`, { method: "DELETE" });
    await refresh();
    showToast("收藏已删除");
  }

  function openFolderSheet(folder?: FolderNode) {
    setFolderForm({
      id: folder?.id ?? "",
      name: folder?.name ?? "",
      parentId: folder?.parentId ?? selectedFolderId ?? ""
    });
    setWorkbenchMode("folder");
  }

  async function saveFolder(event: FormEvent) {
    event.preventDefault();
    const payload = { name: folderForm.name, parentId: folderForm.parentId || null };
    const response = await fetch(folderForm.id ? `/api/folders/${folderForm.id}` : "/api/folders", {
      method: folderForm.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const json = await response.json();
      showToast(json.message ?? "保存失败");
      return;
    }
    setWorkbenchMode(null);
    await refresh();
    showToast(folderForm.id ? "文件夹已更新" : "文件夹已创建");
  }

  async function removeFolder(folder: FolderNode) {
    const response = await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
    if (!response.ok) {
      const json = await response.json();
      showToast(json.message);
      return;
    }
    if (selectedFolderId === folder.id) {
      setViewMode("all");
      setSelectedFolderId(null);
    }
    await refresh();
    showToast("文件夹已删除");
  }

  const spotlightResults = query.trim() ? visibleBookmarks : bookmarks.filter((bookmark) => bookmark.tags.includes("生图"));

  return (
    <main className="desktop-shell">
      <div className="wallpaper-grid" />
      <section className="mac-window" aria-label="AIDH Mac 风格收藏导航站">
        <header className="window-bar">
          <div />
          <div className="window-title">
            <span className="app-mark">A</span>
            <strong>AIDH</strong>
            <span>收藏导航</span>
          </div>
          <div className="window-actions">
            <button className="icon-button" aria-label="视图">
              <Grid2X2 size={18} />
            </button>
            <button className="icon-button" aria-label="设置">
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className="workspace">
          <aside className="sidebar">
            <button className="sidebar-search" onClick={() => setSpotlightOpen(true)}>
              <Search size={19} />
              <span>搜索收藏、标签或文件夹</span>
              <kbd>⌘K</kbd>
            </button>

            <nav className="nav-section">
              <p className="section-label">个人</p>
              <NavButton
                active={viewMode === "all"}
                icon={<Home size={17} />}
                label="全部收藏"
                count={bookmarks.length}
                onClick={() => {
                  setViewMode("all");
                  setSelectedFolderId(null);
                }}
              />
              <NavButton
                active={viewMode === "pinned"}
                icon={<Star size={17} />}
                label="常用网址"
                count={bookmarks.filter((bookmark) => bookmark.pinned).length}
                onClick={() => setViewMode("pinned")}
              />
              <NavButton
                active={viewMode === "recent"}
                icon={<Clock3 size={17} />}
                label="最近添加"
                count={recentBookmarks.length}
                onClick={() => setViewMode("recent")}
              />
            </nav>

            <nav className="nav-section folder-scroll">
              <div className="section-row">
                <p className="section-label">文件夹</p>
                <button className="tiny-button" onClick={() => openFolderSheet()} aria-label="新建文件夹">
                  <FolderPlus size={15} />
                </button>
              </div>
              {folders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  activeId={selectedFolderId}
                  onSelect={(id) => {
                    setViewMode("folder");
                    setSelectedFolderId(id);
                  }}
                  onEdit={openFolderSheet}
                  onDelete={removeFolder}
                />
              ))}
            </nav>

            <section className="nav-section">
              <p className="section-label">智能标签</p>
              <div className="tag-cloud">
                {["生图", "生视频", "AIGC", "写作", "设计", "文档"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setQuery(tag);
                      setSpotlightOpen(true);
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <section className="content">
            <div className="hero-search">
              <SpotlightSearch value={query} onChange={setQuery} results={visibleBookmarks} onFocusSearch={() => {}} />
            </div>

            {workbenchMode === "bookmark" && (
              <section className="inline-workbench" aria-label={form.id ? "编辑收藏" : "添加网址"}>
                <form className="workbench-card bookmark-workbench" onSubmit={saveBookmark}>
                  <WorkbenchHeader
                    eyebrow="AI Import"
                    title={form.id ? "编辑收藏" : "添加网址"}
                    onClose={() => setWorkbenchMode(null)}
                  />
                  <div className={`ai-callout ${aiState}`}>
                    {aiState === "loading" ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
                    <span>{aiMessage}</span>
                    {!form.id && (
                      <button type="button" className="mini-button" onClick={inspectUrl} disabled={aiState === "loading"}>
                        {aiState === "loading" ? "识别中" : "AI 识别"}
                      </button>
                    )}
                  </div>
                  <label className="field wide">
                    <span>网址</span>
                    <input
                      value={form.url}
                      onChange={(event) => setForm({ ...form, url: event.target.value })}
                      onBlur={() => setForm((current) => ({ ...current, url: normalizeUrl(current.url) }))}
                      placeholder="https://example.com"
                      required
                    />
                  </label>
                  <div className="form-grid">
                    <label className="field">
                      <span>标题</span>
                      <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
                    </label>
                    <label className="field">
                      <span>文件夹</span>
                      <select value={form.folderId ?? ""} onChange={(event) => setForm({ ...form, folderId: event.target.value || null })}>
                        <option value="">未分类</option>
                        {flatFolders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field wide">
                      <span>Logo</span>
                      <input value={form.logoUrl} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} placeholder="自动使用 favicon" />
                    </label>
                    <label className="field wide">
                      <span>简介</span>
                      <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
                    </label>
                    <label className="field wide">
                      <span>标签</span>
                      <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="用逗号分隔，例如 生图, AIGC" />
                    </label>
                  </div>
                  <footer className="sheet-footer">
                    <label className="pin-toggle">
                      <input type="checkbox" checked={form.pinned} onChange={(event) => setForm({ ...form, pinned: event.target.checked })} />
                      加入底部 Dock 常用
                    </label>
                    <button className="primary-button" type="submit">
                      保存收藏
                    </button>
                  </footer>
                </form>
              </section>
            )}

            {workbenchMode === "folder" && (
              <section className="inline-workbench" aria-label={folderForm.id ? "编辑文件夹" : "新建文件夹"}>
                <form className="workbench-card folder-workbench" onSubmit={saveFolder}>
                  <WorkbenchHeader
                    eyebrow="Finder Folder"
                    title={folderForm.id ? "编辑文件夹" : "新建文件夹"}
                    onClose={() => setWorkbenchMode(null)}
                  />
                  <div className="folder-form-row">
                    <label className="field">
                      <span>名称</span>
                      <input value={folderForm.name} onChange={(event) => setFolderForm({ ...folderForm, name: event.target.value })} required autoFocus />
                    </label>
                    <label className="field">
                      <span>父级文件夹</span>
                      <select value={folderForm.parentId} onChange={(event) => setFolderForm({ ...folderForm, parentId: event.target.value })}>
                        <option value="">顶层</option>
                        {flatFolders
                          .filter((folder) => folder.id !== folderForm.id)
                          .map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button className="primary-button" type="submit">
                      保存文件夹
                    </button>
                  </div>
                </form>
              </section>
            )}

            <section className="content-section">
              {visibleBookmarks.length ? (
                <div className="bookmark-grid">
                  {visibleBookmarks.map((bookmark) => (
                    <BookmarkCard
                      key={bookmark.id}
                      bookmark={bookmark}
                      onEdit={openEdit}
                      onDelete={removeBookmark}
                      onTogglePinned={togglePinned}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Sparkles size={30} />
                  <h3>这里还没有收藏</h3>
                  <p>添加一个网址，或换个关键词搜索。AI 原型会帮你补全初始信息。</p>
                  <button className="primary-button" onClick={openAdd}>
                    <Plus size={18} />
                    添加网址
                  </button>
                </div>
              )}
            </section>
          </section>
        </div>
      </section>

      <nav
        className="dock"
        aria-label="常用网址 Dock"
        onMouseEnter={(event) => enterDock(event.currentTarget)}
        onMouseMove={(event) => scheduleDockUpdate(event.clientX)}
        onMouseLeave={(event) => leaveDock(event.currentTarget)}
      >
        {pinnedBookmarks.map((bookmark, index) => (
          <a
            key={bookmark.id}
            ref={(node) => {
              dockItemRefs.current[index] = node;
            }}
            className="dock-item"
            href={bookmark.url}
            target="_blank"
            rel="noreferrer"
            style={{ ["--label" as string]: `"${bookmark.title}"` }}
          >
            <img src={bookmark.logoUrl} alt="" />
          </a>
        ))}
        <span className="dock-divider" />
        <button
          ref={(node) => {
            dockItemRefs.current[pinnedBookmarks.length] = node;
          }}
          className="dock-item add-dock"
          onClick={openAdd}
          aria-label="添加网址"
        >
          <Plus size={28} />
        </button>
      </nav>

      {spotlightOpen && (
        <div className="spotlight-backdrop" onMouseDown={() => setSpotlightOpen(false)}>
          <section className="spotlight-panel" onMouseDown={(event) => event.stopPropagation()}>
            <div className="spotlight-input">
              <Search size={24} />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索网址、标签或文件夹" />
              <kbd>esc</kbd>
            </div>
            <div className="spotlight-results">
              <p className="result-label">{query ? "智能匹配" : "推荐：生图相关"}</p>
              {spotlightResults.length ? (
                spotlightResults.slice(0, 8).map((bookmark) => (
                  <a key={bookmark.id} className="result-row" href={bookmark.url} target="_blank" rel="noreferrer">
                    <img src={bookmark.logoUrl} alt="" />
                    <span>
                      <strong>{bookmark.title}</strong>
                      <small>{bookmark.tags.join("、") || bookmark.description}</small>
                    </span>
                    <em>{bookmark.folderName ?? "未分类"}</em>
                  </a>
                ))
              ) : (
                <div className="spotlight-empty">没有找到相关收藏。</div>
              )}
            </div>
          </section>
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}
    </main>
  );
}

function NavButton({
  active,
  icon,
  label,
  count,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}

function FolderItem({
  folder,
  activeId,
  level = 0,
  onSelect,
  onEdit,
  onDelete
}: {
  folder: FolderNode;
  activeId: string | null;
  level?: number;
  onSelect: (id: string) => void;
  onEdit: (folder: FolderNode) => void;
  onDelete: (folder: FolderNode) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div className={`folder-row ${activeId === folder.id ? "active" : ""}`} style={{ paddingLeft: 10 + level * 18 }}>
        <button className="disclosure" onClick={() => setOpen(!open)} aria-label="展开文件夹">
          {folder.children.length ? open ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : <span />}
        </button>
        <button className="folder-main" onClick={() => onSelect(folder.id)}>
          <FolderClosed size={16} />
          <span>{folder.name}</span>
          <strong>{folder.count}</strong>
        </button>
        <button className="row-action" onClick={() => onEdit(folder)} aria-label="编辑文件夹">
          <Pencil size={13} />
        </button>
        <button className="row-action" onClick={() => onDelete(folder)} aria-label="删除文件夹">
          <Trash2 size={13} />
        </button>
      </div>
      {open &&
        folder.children.map((child) => (
          <FolderItem key={child.id} folder={child} activeId={activeId} level={level + 1} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />
        ))}
    </div>
  );
}

function BookmarkCard({
  bookmark,
  onEdit,
  onDelete,
  onTogglePinned
}: {
  bookmark: Bookmark;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
  onTogglePinned: (bookmark: Bookmark) => void;
}) {
  return (
    <article className="bookmark-card">
      <div className="card-top">
        <img src={bookmark.logoUrl} alt="" />
        <div className="card-actions">
          <button className={`star ${bookmark.pinned ? "active" : ""}`} onClick={() => onTogglePinned(bookmark)} aria-label="切换 Dock 常用">
            <Star size={17} fill={bookmark.pinned ? "currentColor" : "none"} />
          </button>
          <button onClick={() => onEdit(bookmark)} aria-label="编辑">
            <MoreHorizontal size={17} />
          </button>
        </div>
      </div>
      <a href={bookmark.url} target="_blank" rel="noreferrer" className="card-link">
        <h3>{bookmark.title}</h3>
        <p>{bookmark.description || bookmark.url}</p>
      </a>
      <div className="tags">
        {bookmark.tags.map((tag) => (
          <span key={tag}>
            <Tag size={12} />
            {tag}
          </span>
        ))}
      </div>
      <footer className="card-footer">
        <span>{bookmark.folderName ?? "未分类"}</span>
        <button onClick={() => onDelete(bookmark)}>删除</button>
      </footer>
    </article>
  );
}

function WorkbenchHeader({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
  return (
    <header className="sheet-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">
        <X size={18} />
      </button>
    </header>
  );
}
