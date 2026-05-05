"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  FolderClosed,
  FolderPlus,
  Grid2X2,
  Home,
  List,
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
  Upload,
  X
} from "lucide-react";
import { type DragEvent, FormEvent, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AiPreview, Bookmark, FolderNode } from "@/lib/types";
import { SpotlightSearch } from "./SpotlightSearch";

type ViewMode = "all" | "pinned" | "recent" | "folder";
type ViewLayout = "grid" | "list";
type SortMode = "default" | "visits";
type AiState = "idle" | "loading" | "success" | "error";
type WorkbenchMode = "bookmark" | "folder" | null;
type ExportPayload = {
  version: 1;
  exportedAt: string;
  bookmarks: Bookmark[];
};
type FolderOption = FolderNode & {
  depth: number;
  path: string;
};

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
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    return withProtocol;
  }
}

function flattenFolders(nodes: FolderNode[]): FolderNode[] {
  return nodes.flatMap((node) => [node, ...flattenFolders(node.children)]);
}

function flattenFolderOptions(nodes: FolderNode[], depth = 0, parentPath = ""): FolderOption[] {
  return nodes.flatMap((node) => {
    const path = parentPath ? `${parentPath} / ${node.name}` : node.name;
    return [{ ...node, depth, path }, ...flattenFolderOptions(node.children, depth + 1, path)];
  });
}

function collectFolderIds(folder: FolderNode): string[] {
  return [folder.id, ...folder.children.flatMap(collectFolderIds)];
}

export function AidhApp() {
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [viewLayout, setViewLayout] = useState<ViewLayout>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [query, setQuery] = useState("");
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const [workbenchMode, setWorkbenchMode] = useState<WorkbenchMode>(null);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [form, setForm] = useState<BookmarkForm>(emptyForm);
  const [folderForm, setFolderForm] = useState({ id: "", name: "", parentId: "" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [pendingBookmarkDelete, setPendingBookmarkDelete] = useState<Bookmark | null>(null);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<FolderNode | null>(null);
  const [aiState, setAiState] = useState<AiState>("idle");
  const [aiMessage, setAiMessage] = useState("输入网址后，AI 会先模拟识别标题、Logo、简介和标签。");
  const [toast, setToast] = useState("");
  const [folderMenu, setFolderMenu] = useState<{ folder: FolderNode; x: number; y: number } | null>(null);
  const [draggingBookmarkId, setDraggingBookmarkId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ type: "dock" | "folder"; id?: string } | null>(null);
  const dockItemRefs = useRef<(HTMLElement | null)[]>([]);
  const dockCenters = useRef<number[]>([]);
  const dockFrame = useRef<number | null>(null);
  const dockMouseX = useRef<number | null>(null);

  const flatFolders = useMemo(() => flattenFolders(folders), [folders]);
  const folderOptions = useMemo(() => flattenFolderOptions(folders), [folders]);
  const selectedFolder = flatFolders.find((folder) => folder.id === selectedFolderId);
  const editingFolder = flatFolders.find((folder) => folder.id === folderForm.id);
  const blockedParentIds = useMemo(() => {
    if (!editingFolder) return new Set<string>();
    return new Set(collectFolderIds(editingFolder));
  }, [editingFolder]);
  const selectedFolderIds = useMemo(() => {
    if (!selectedFolder) return new Set<string>();
    return new Set(collectFolderIds(selectedFolder));
  }, [selectedFolder]);
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
            ? bookmarks.filter((bookmark) => bookmark.folderId && selectedFolderIds.has(bookmark.folderId))
            : bookmarks;
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? base.filter((bookmark) =>
          [bookmark.title, bookmark.url, bookmark.description, bookmark.folderName ?? "", ...bookmark.tags]
            .join(" ")
            .toLowerCase()
            .includes(needle)
        )
      : base;
    if (sortMode === "visits") {
      return [...filtered].sort((a, b) => b.visitCount - a.visitCount || b.updatedAt.localeCompare(a.updatedAt));
    }
    return filtered;
  }, [bookmarks, query, recentBookmarks, selectedFolderId, selectedFolderIds, sortMode, viewMode]);

  const folderFilterLabel = selectedFolder ? selectedFolder.name : "全部文件夹";
  const selectedFolderPath = selectedFolderId
    ? folderOptions.find((folder) => folder.id === selectedFolderId)?.path ?? selectedFolder?.name
    : null;

  const toolbarStateText = useMemo(() => {
    const parts = [viewLayout === "grid" ? "网格视图" : "列表视图"];
    if (selectedFolderPath) parts.push(`文件夹：${selectedFolderPath}`);
    if (sortMode === "visits") parts.push("按访问量排序");
    if (viewMode === "pinned") parts.push("只看重点标记");
    return parts.join(" / ");
  }, [selectedFolderPath, sortMode, viewLayout, viewMode]);

  const spotlightResults = query.trim() ? visibleBookmarks : bookmarks.filter((bookmark) => bookmark.tags.includes("生图"));

  function selectFolderFilter(folderId: string | null) {
    setSelectedFolderId(folderId);
    setViewMode(folderId ? "folder" : "all");
    setFolderMenuOpen(false);
  }

  function handleShortcut(shortcut: "layout" | "folder" | "popular" | "pinned") {
    if (shortcut === "layout") {
      setViewLayout((current) => (current === "grid" ? "list" : "grid"));
      return;
    }
    if (shortcut === "folder") {
      setFolderMenuOpen((current) => !current);
      return;
    }
    if (shortcut === "popular") {
      setSortMode((current) => (current === "visits" ? "default" : "visits"));
      return;
    }
    setViewMode((current) => (current === "pinned" ? "all" : "pinned"));
    if (viewMode !== "pinned") setSelectedFolderId(null);
  }

  async function recordVisit(bookmark: Bookmark) {
    setBookmarks((current) =>
      current.map((item) => (item.id === bookmark.id ? { ...item, visitCount: item.visitCount + 1 } : item))
    );
    await fetch(`/api/bookmarks/${bookmark.id}`, { method: "POST" });
  }

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

  useEffect(() => {
    const closeMenu = () => setFolderMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
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

  async function moveBookmark(bookmarkId: string, input: { folderId: string | null; pinned: boolean }) {
    const response = await fetch(`/api/bookmarks/${bookmarkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      const json = await response.json();
      showToast(json.message ?? "移动失败");
      return false;
    }
    await refresh();
    showToast(input.pinned ? "已加入 Dock" : "已移动到文件夹");
    return true;
  }

  function exportBookmarks() {
    const payload: ExportPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      bookmarks
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `aidh-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
    showToast("收藏备份已导出");
  }

  async function importBookmarks(event: FormEvent) {
    event.preventDefault();
    try {
      const parsed = JSON.parse(importText) as Partial<ExportPayload> | Bookmark[];
      const items = Array.isArray(parsed) ? parsed : parsed.bookmarks;
      if (!Array.isArray(items)) throw new Error("Invalid import payload");
      let imported = 0;
      for (const item of items) {
        if (!item.url || !item.title) continue;
        const response = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: item.url,
            title: item.title,
            logoUrl: item.logoUrl,
            description: item.description,
            folderId: item.folderId ?? null,
            pinned: item.pinned,
            tags: item.tags
          })
        });
        if (response.ok) imported += 1;
      }
      setImportText("");
      await refresh();
      showToast(`已导入 ${imported} 条收藏`);
    } catch {
      showToast("导入失败，请检查 JSON 格式");
    }
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
    const response = await fetch(`/api/bookmarks/${bookmark.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !bookmark.pinned })
    });
    if (!response.ok) {
      const json = await response.json();
      showToast(json.message ?? "保存失败");
      return;
    }
    await refresh();
    showToast(bookmark.pinned ? "已取消重点标记" : "已标记为重点");
  }

  async function removeBookmark(bookmark: Bookmark) {
    await fetch(`/api/bookmarks/${bookmark.id}`, { method: "DELETE" });
    setPendingBookmarkDelete(null);
    await refresh();
    showToast("收藏已删除");
  }

  function openFolderSheet(folder?: FolderNode, parentId?: string | null) {
    setFolderForm({
      id: folder?.id ?? "",
      name: folder?.name ?? "",
      parentId: folder?.parentId ?? parentId ?? selectedFolderId ?? ""
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

  function openFolderMenu(folder: FolderNode, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setFolderMenu({ folder, x: event.clientX, y: event.clientY });
  }

  function beginDrag(bookmarkId: string, event: DragEvent<Element>) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", bookmarkId);
    setDraggingBookmarkId(bookmarkId);
    setDropTarget(null);
  }

  function endDrag() {
    setDraggingBookmarkId(null);
    setDropTarget(null);
  }

  async function dropToDock(event: DragEvent<Element>) {
    event.preventDefault();
    const bookmarkId = event.dataTransfer.getData("text/plain") || draggingBookmarkId;
    if (!bookmarkId) return;
    await moveBookmark(bookmarkId, { folderId: null, pinned: true });
    endDrag();
  }

  async function dropToFolder(folderId: string, event: DragEvent<Element>) {
    event.preventDefault();
    const bookmarkId = event.dataTransfer.getData("text/plain") || draggingBookmarkId;
    if (!bookmarkId) return;
    await moveBookmark(bookmarkId, { folderId, pinned: false });
    endDrag();
  }

  function handleFolderContextAction(action: "edit" | "add" | "delete") {
    if (!folderMenu) return;
    const folder = folderMenu.folder;
    setFolderMenu(null);
    if (action === "edit") openFolderSheet(folder);
    if (action === "add") openFolderSheet(undefined, folder.id);
    if (action === "delete") setPendingFolderDelete(folder);
  }

  async function removeFolder(folder: FolderNode) {
    const response = await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
    if (!response.ok) {
      const json = await response.json();
      setPendingFolderDelete(null);
      showToast(json.message);
      return;
    }
    if (selectedFolderId === folder.id) {
      setViewMode("all");
      setSelectedFolderId(null);
    }
    setPendingFolderDelete(null);
    await refresh();
    showToast("文件夹已删除");
  }

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
            <button className="icon-button" aria-label="切换视图" onClick={() => setViewLayout((current) => (current === "grid" ? "list" : "grid"))}>
              {viewLayout === "grid" ? <List size={18} /> : <Grid2X2 size={18} />}
            </button>
            <button className="icon-button" aria-label="设置" onClick={() => setSettingsOpen(true)}>
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
                  dropTargetId={dropTarget?.type === "folder" ? dropTarget.id ?? null : null}
                  onSelect={(id) => {
                    setViewMode("folder");
                    setSelectedFolderId(id);
                  }}
                  onEdit={openFolderSheet}
                  onAddChild={(folder) => openFolderSheet(undefined, folder.id)}
                  onDelete={setPendingFolderDelete}
                  onDropBookmark={dropToFolder}
                  onDragTargetChange={(id) => setDropTarget(id ? { type: "folder", id } : null)}
                  onContextMenu={openFolderMenu}
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
              <SpotlightSearch
                value={query}
                onChange={setQuery}
                results={visibleBookmarks}
                onFocusSearch={() => {}}
                layout={viewLayout}
                folderFilterLabel={folderFilterLabel}
                popularActive={sortMode === "visits"}
                pinnedActive={viewMode === "pinned"}
                onShortcut={handleShortcut}
                folderMenu={
                  folderMenuOpen ? (
                    <div className="folder-filter-menu" role="menu" aria-label="文件夹筛选">
                      <button className={!selectedFolderId ? "active" : ""} onClick={() => selectFolderFilter(null)}>
                        <span>全部文件夹</span>
                        <strong>{bookmarks.length}</strong>
                      </button>
                      {folderOptions.map((folder) => (
                        <button
                          key={folder.id}
                          className={selectedFolderId === folder.id ? "active" : ""}
                          style={{ paddingLeft: 11 + folder.depth * 18 }}
                          onClick={() => selectFolderFilter(folder.id)}
                        >
                          <span>{folder.name}</span>
                          <strong>{folder.count}</strong>
                        </button>
                      ))}
                    </div>
                  ) : null
                }
              />
            </div>

            {workbenchMode === "bookmark" && (
              <div className="modal-backdrop" onMouseDown={() => setWorkbenchMode(null)}>
                <section
                  className="modal-panel bookmark-modal"
                  aria-label={form.id ? "编辑收藏" : "添加网址"}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <form className="workbench-card bookmark-workbench modal-workbench" onSubmit={saveBookmark}>
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
                        {folderOptions.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {"-- ".repeat(folder.depth)}
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
              </div>
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
                        {folderOptions
                          .filter((folder) => !blockedParentIds.has(folder.id))
                          .map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {"-- ".repeat(folder.depth)}
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

            {folderMenu && (
              <div
                className="folder-context-menu"
                style={{ left: folderMenu.x, top: folderMenu.y }}
                onClick={(event) => event.stopPropagation()}
              >
                <button type="button" onClick={() => handleFolderContextAction("edit")}>
                  <Pencil size={14} />
                  编辑文件夹
                </button>
                <button type="button" onClick={() => handleFolderContextAction("add")}>
                  <FolderPlus size={14} />
                  新建子文件夹
                </button>
                <button type="button" className="danger" onClick={() => handleFolderContextAction("delete")}>
                  <Trash2 size={14} />
                  删除文件夹
                </button>
              </div>
            )}

            <section className="content-section">
              <div className="view-state-row">
                <span>{toolbarStateText}</span>
                <strong>{visibleBookmarks.length} 个收藏</strong>
              </div>
              {visibleBookmarks.length ? (
                <div className={viewLayout === "grid" ? "bookmark-grid" : "bookmark-list"}>
                  {visibleBookmarks.map((bookmark) => (
                    <BookmarkCard
                      key={bookmark.id}
                      bookmark={bookmark}
                      layout={viewLayout}
                      dragging={draggingBookmarkId === bookmark.id}
                      onEdit={openEdit}
                      onDelete={setPendingBookmarkDelete}
                      onTogglePinned={togglePinned}
                      onVisit={recordVisit}
                      onDragStart={beginDrag}
                      onDragEnd={endDrag}
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
        onDragOver={(event) => {
          if (!draggingBookmarkId) return;
          event.preventDefault();
          setDropTarget({ type: "dock" });
        }}
        onDrop={dropToDock}
      >
        {pinnedBookmarks.map((bookmark, index) => (
          <a
            key={bookmark.id}
            ref={(node) => {
              dockItemRefs.current[index] = node;
            }}
            className={`dock-item ${draggingBookmarkId === bookmark.id ? "is-dragging" : ""}`}
            href={bookmark.url}
            target="_blank"
            rel="noreferrer"
            onClick={() => recordVisit(bookmark)}
            style={{ ["--label" as string]: `"${bookmark.title}"` }}
            draggable
            onDragStart={(event) => beginDrag(bookmark.id, event)}
            onDragEnd={endDrag}
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
                  <a
                    key={bookmark.id}
                    className="result-row"
                    href={bookmark.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => recordVisit(bookmark)}
                  >
                    <img src={bookmark.logoUrl} alt="" />
                    <span>
                      <strong>{bookmark.title}</strong>
                      <small>{bookmark.tags.join("、") || bookmark.description}</small>
                    </span>
                    <em>{bookmark.folderPath ?? bookmark.folderName ?? "未分类"}</em>
                  </a>
                ))
              ) : (
                <div className="spotlight-empty">没有找到相关收藏。</div>
              )}
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}>
          <section className="modal-panel settings-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="设置">
            <WorkbenchHeader eyebrow="Library Control" title="设置" onClose={() => setSettingsOpen(false)} />
            <div className="settings-grid">
              <section className="settings-block">
                <CheckCircle2 size={20} />
                <div>
                  <strong>{bookmarks.length} 个收藏</strong>
                  <span>{flatFolders.length} 个文件夹，{bookmarks.filter((bookmark) => bookmark.pinned).length} 个常用网址</span>
                </div>
              </section>
              <button className="settings-action" onClick={exportBookmarks}>
                <Download size={18} />
                <span>导出收藏 JSON</span>
              </button>
            </div>
            <form className="import-box" onSubmit={importBookmarks}>
              <label className="field wide">
                <span>导入收藏 JSON</span>
                <textarea
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  rows={6}
                  placeholder="粘贴 AIDH 导出的 JSON，重复网址会自动合并。"
                />
              </label>
              <button className="primary-button" type="submit" disabled={!importText.trim()}>
                <Upload size={17} />
                导入
              </button>
            </form>
          </section>
        </div>
      )}

      {(pendingBookmarkDelete || pendingFolderDelete) && (
        <div className="modal-backdrop" onMouseDown={() => {
          setPendingBookmarkDelete(null);
          setPendingFolderDelete(null);
        }}>
          <section className="modal-panel confirm-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="确认删除">
            <div className="confirm-icon">
              <AlertTriangle size={22} />
            </div>
            <h2>确认删除</h2>
            <p>
              {pendingBookmarkDelete
                ? `删除收藏「${pendingBookmarkDelete.title}」？`
                : `删除文件夹「${pendingFolderDelete?.name}」？文件夹内有内容时会自动阻止。`}
            </p>
            <footer className="confirm-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setPendingBookmarkDelete(null);
                  setPendingFolderDelete(null);
                }}
              >
                取消
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  if (pendingBookmarkDelete) void removeBookmark(pendingBookmarkDelete);
                  if (pendingFolderDelete) void removeFolder(pendingFolderDelete);
                }}
              >
                删除
              </button>
            </footer>
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
  dropTargetId,
  level = 0,
  onSelect,
  onEdit,
  onAddChild,
  onDelete,
  onDropBookmark,
  onDragTargetChange,
  onContextMenu
}: {
  folder: FolderNode;
  activeId: string | null;
  dropTargetId: string | null;
  level?: number;
  onSelect: (id: string) => void;
  onEdit: (folder: FolderNode) => void;
  onAddChild: (folder: FolderNode) => void;
  onDelete: (folder: FolderNode) => void;
  onDropBookmark: (folderId: string, event: DragEvent<Element>) => Promise<void>;
  onDragTargetChange: (folderId: string | null) => void;
  onContextMenu: (folder: FolderNode, event: MouseEvent) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="folder-tree-item" style={{ "--folder-depth": level } as React.CSSProperties}>
      <div
        className={`folder-row ${activeId === folder.id ? "active" : ""} ${dropTargetId === folder.id ? "drop-target" : ""}`}
        onContextMenu={(event) => onContextMenu(folder, event)}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("text/plain")) return;
          event.preventDefault();
          onDragTargetChange(folder.id);
        }}
        onDragLeave={() => onDragTargetChange(null)}
        onDrop={(event) => onDropBookmark(folder.id, event)}
      >
        <button className="disclosure" onClick={() => setOpen(!open)} aria-label={open ? "收起文件夹" : "展开文件夹"}>
          {folder.children.length ? open ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : <span />}
        </button>
        <button className="folder-main" onClick={() => onSelect(folder.id)}>
          <FolderClosed size={16} />
          <span>{folder.name}</span>
          <strong>{folder.count}</strong>
        </button>
      </div>
      {open && Boolean(folder.children.length) && (
        <div className="folder-children">
          {folder.children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              activeId={activeId}
              dropTargetId={dropTargetId}
              level={level + 1}
              onSelect={onSelect}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onDropBookmark={onDropBookmark}
              onDragTargetChange={onDragTargetChange}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookmarkCard({
  bookmark,
  layout,
  dragging,
  onEdit,
  onDelete,
  onTogglePinned,
  onVisit,
  onDragStart,
  onDragEnd
}: {
  bookmark: Bookmark;
  layout: ViewLayout;
  dragging: boolean;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
  onTogglePinned: (bookmark: Bookmark) => void;
  onVisit: (bookmark: Bookmark) => void;
  onDragStart: (bookmarkId: string, event: DragEvent<Element>) => void;
  onDragEnd: () => void;
}) {
  return (
    <article
      className={`bookmark-card ${layout === "list" ? "list-card" : ""} ${dragging ? "is-dragging" : ""}`}
      draggable
      onDragStart={(event) => onDragStart(bookmark.id, event)}
      onDragEnd={onDragEnd}
    >
      <div className="card-top">
        <img src={bookmark.logoUrl} alt="" />
        <div className="card-actions">
          <button className={`star ${bookmark.pinned ? "active" : ""}`} onClick={() => onTogglePinned(bookmark)} aria-label="切换重点标记">
            <Star size={17} fill={bookmark.pinned ? "currentColor" : "none"} />
          </button>
          <button onClick={() => onEdit(bookmark)} aria-label="编辑">
            <MoreHorizontal size={17} />
          </button>
        </div>
      </div>
      <a href={bookmark.url} target="_blank" rel="noreferrer" className="card-link" onClick={() => onVisit(bookmark)}>
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
        <span>{bookmark.folderPath ?? bookmark.folderName ?? "未分类"}</span>
        <small>{bookmark.visitCount} 次访问</small>
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
