"use client";

import { useState, useSyncExternalStore } from "react";
import { JsonView, allExpanded, defaultStyles, darkStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";

interface JsonPreviewProps {
  url: string;
  fileName: string;
  // Raw JSON text, read server-side (null if the server couldn't fetch it).
  text: string | null;
}

// The tree's own label/value colors come from the library's stylesheet, which
// doesn't read our CSS variables — so track the app's resolved theme (the
// data-theme attribute the toggle/pre-paint script set on <html>) and pick the
// matching light/dark preset. A MutationObserver makes it react to manual switches
// and live system changes alike.
function useIsDarkTheme(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      return () => observer.disconnect();
    },
    () => document.documentElement.dataset.theme === "dark",
    () => false,
  );
}

export default function JsonPreview({ url, fileName, text }: JsonPreviewProps) {
  const [viewMode, setViewMode] = useState<"tree" | "raw">("tree");
  const dark = useIsDarkTheme();

  if (text === null) {
    return <p style={{ ...styles.msg, color: "var(--danger)" }}>Couldn&apos;t load this JSON file.</p>;
  }

  // Parse once for the tree view; fall back to raw-only if it isn't valid JSON.
  let data: object | null = null;
  let parseError = false;
  try {
    data = JSON.parse(text) as object;
  } catch {
    parseError = true;
  }

  return (
    <div style={styles.wrapper}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.tabs}>
          <button
            onClick={() => setViewMode("tree")}
            className={`json-tab${viewMode === "tree" ? " json-tab-active" : ""}`}
            style={{ ...styles.tab, ...(viewMode === "tree" ? styles.tabActive : {}) }}
          >
            🌲 Tree
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`json-tab${viewMode === "raw" ? " json-tab-active" : ""}`}
            style={{ ...styles.tab, ...(viewMode === "raw" ? styles.tabActive : {}) }}
          >
            📄 Raw
          </button>
        </div>
        <a href={url} download={fileName} className="accent-link" style={styles.download} target="_blank" rel="noreferrer">
          ⬇ Download JSON
        </a>
      </div>

      {parseError && (
        <p style={{ ...styles.msg, color: "var(--danger)" }}>
          This file isn&apos;t valid JSON — showing raw text.
        </p>
      )}

      {/* Tree view */}
      {viewMode === "tree" && !parseError && data !== null && (
        <div style={styles.treeContainer}>
          <JsonView
            data={data}
            shouldExpandNode={allExpanded}
            style={dark ? darkStyles : defaultStyles}
          />
        </div>
      )}

      {/* Raw view (also used as fallback when the JSON doesn't parse) */}
      {(viewMode === "raw" || parseError) && (
        <pre style={styles.raw}>{text}</pre>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  msg: { color: "var(--muted)", fontSize: 14 },
  wrapper: { display: "flex", flexDirection: "column", gap: 12 },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tabs: { display: "flex", gap: 4 },
  tab: {
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "transparent",
    cursor: "pointer",
    color: "var(--muted)",
    fontFamily: "var(--font-geist-mono), monospace",
  },
  tabActive: {
    background: "var(--accent)",
    color: "var(--accent-contrast)",
    border: "1px solid var(--accent)",
  },
  download: {
    fontSize: 13,
    color: "var(--accent)",
    textDecoration: "none",
    fontWeight: 600,
  },
  treeContainer: {
    background: "var(--code-bg)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "12px 16px",
    overflowX: "auto",
    fontSize: 13,
    maxHeight: "75vh",
    overflowY: "auto",
  },
  raw: {
    background: "var(--code-bg)",
    color: "var(--code-fg)",
    padding: "16px",
    borderRadius: 8,
    fontSize: 12,
    overflowX: "auto",
    overflowY: "auto",
    maxHeight: "75vh",
    margin: 0,
    fontFamily: "var(--font-geist-mono), monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },
};
