"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, Folder, Grid2X2, List, Search, Star } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import type { Bookmark } from "@/lib/types";

type ViewLayout = "grid" | "list";
type ShortcutKey = "layout" | "folder" | "popular" | "pinned";

type SpotlightSearchProps = {
  value: string;
  onChange: (value: string) => void;
  results: Bookmark[];
  onFocusSearch: () => void;
  layout: ViewLayout;
  folderFilterLabel: string;
  popularActive: boolean;
  pinnedActive: boolean;
  onShortcut: (shortcut: ShortcutKey) => void;
  folderMenu?: ReactNode;
};

export function SpotlightSearch({
  value,
  onChange,
  results,
  onFocusSearch,
  layout,
  folderFilterLabel,
  popularActive,
  pinnedActive,
  onShortcut,
  folderMenu
}: SpotlightSearchProps) {
  const [hovered, setHovered] = useState(false);
  const [activeShortcut, setActiveShortcut] = useState<string | null>(null);
  const showResults = value.trim().length > 0;
  const shortcuts = [
    {
      key: "layout" as const,
      label: layout === "grid" ? "切换列表视图" : "切换网格视图",
      active: false,
      icon: layout === "grid" ? <List size={28} /> : <Grid2X2 size={28} />
    },
    {
      key: "folder" as const,
      label: `文件夹筛选：${folderFilterLabel}`,
      active: folderFilterLabel !== "全部文件夹",
      icon: <Folder size={28} />
    },
    { key: "popular" as const, label: "按访问量排序", active: popularActive, icon: <Activity size={28} /> },
    { key: "pinned" as const, label: "重点标记", active: pinnedActive, icon: <Star size={28} /> }
  ];

  return (
    <motion.section
      className={`apple-spotlight ${showResults ? "open" : ""} ${hovered ? "hovered" : ""}`}
      layout
      transition={{ type: "spring", stiffness: 520, damping: 42 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="apple-spotlight-row">
        <motion.div
          className="apple-spotlight-shell"
          layout
          transition={{ type: "spring", stiffness: 520, damping: 40 }}
        >
          <div className="apple-spotlight-input-row">
            <motion.div layoutId="aidh-search-icon" className="apple-spotlight-icon">
              <Search size={25} />
            </motion.div>
            <div className="apple-spotlight-input-wrap">
              <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onFocus={onFocusSearch}
                placeholder={showResults ? "" : activeShortcut ?? (hovered ? "选择右侧快捷搜索" : "今天想找什么？试试“生图”“PPT”“代码 Agent”")}
                aria-label="搜索收藏"
              />
            </div>
            <kbd>⌘K</kbd>
          </div>

          <AnimatePresence>
          </AnimatePresence>
        </motion.div>

        <div className="apple-spotlight-shortcuts" aria-hidden={!hovered || showResults}>
          {shortcuts.map((shortcut, index) => (
            <button
              type="button"
              key={shortcut.key}
              className={`apple-spotlight-shortcut ${shortcut.active ? "active" : ""}`}
              style={{ "--shortcut-index": index } as CSSProperties}
              aria-label={shortcut.label}
              title={shortcut.label}
              tabIndex={hovered && !showResults ? 0 : -1}
              onMouseEnter={() => setActiveShortcut(shortcut.label)}
              onMouseLeave={() => setActiveShortcut(null)}
              onClick={() => onShortcut(shortcut.key)}
            >
              {shortcut.icon}
            </button>
          ))}
        </div>
        {folderMenu}
      </div>
    </motion.section>
  );
}
