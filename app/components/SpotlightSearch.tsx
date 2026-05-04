"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowUpRight, Folder, Grid2X2, Search, Sparkles, Star } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import type { Bookmark } from "@/lib/types";

type SpotlightSearchProps = {
  value: string;
  onChange: (value: string) => void;
  results: Bookmark[];
  onFocusSearch: () => void;
};

export function SpotlightSearch({ value, onChange, results, onFocusSearch }: SpotlightSearchProps) {
  const [hovered, setHovered] = useState(false);
  const [activeShortcut, setActiveShortcut] = useState<string | null>(null);
  const showResults = value.trim().length > 0;
  const previewResults = results.slice(0, 5);
  const shortcuts = [
    { label: "全部", icon: <Grid2X2 size={28} /> },
    { label: "文件夹", icon: <Folder size={28} /> },
    { label: "AI", icon: <Activity size={28} /> },
    { label: "常用", icon: <Star size={28} /> }
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
                placeholder={activeShortcut ?? (hovered ? "选择右侧快捷搜索" : "今天想找什么？试试“生图”“PPT”“代码 Agent”")}
                aria-label="搜索收藏"
              />
            </div>
            <kbd>⌘K</kbd>
          </div>

          <AnimatePresence>
            {showResults && (
              <motion.div
                className="apple-spotlight-results"
                initial={{ opacity: 0, height: 0, filter: "blur(8px)" }}
                animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
                exit={{ opacity: 0, height: 0, filter: "blur(8px)" }}
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
              >
                {previewResults.length ? (
                  previewResults.map((bookmark) => (
                    <a key={bookmark.id} className="apple-spotlight-result" href={bookmark.url} target="_blank" rel="noreferrer">
                      <img src={bookmark.logoUrl} alt="" />
                      <span>
                        <strong>{bookmark.title}</strong>
                        <small>{bookmark.tags.join("、") || bookmark.description}</small>
                      </span>
                      <em>{bookmark.folderName ?? "未分类"}</em>
                      <ArrowUpRight size={17} />
                    </a>
                  ))
                ) : (
                  <div className="apple-spotlight-empty">
                    <Sparkles size={18} />
                    没有找到相关收藏
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="apple-spotlight-shortcuts" aria-hidden={!hovered || showResults}>
          {shortcuts.map((shortcut, index) => (
            <button
              type="button"
              key={shortcut.label}
              className="apple-spotlight-shortcut"
              style={{ "--shortcut-index": index } as CSSProperties}
              aria-label={shortcut.label}
              title={shortcut.label}
              tabIndex={hovered && !showResults ? 0 : -1}
              onMouseEnter={() => setActiveShortcut(shortcut.label)}
              onMouseLeave={() => setActiveShortcut(null)}
            >
              {shortcut.icon}
            </button>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
