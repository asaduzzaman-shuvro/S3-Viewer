"use client";

import { useState } from "react";
import { JsonView, allExpanded, defaultStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";

interface JsonPreviewProps {
  url: string;
  fileName: string;
  // Raw JSON text, read server-side (null if the server couldn't fetch it).
  text: string | null;
}

export default function JsonPreview({ url, fileName, text }: JsonPreviewProps) {
  const [viewMode, setViewMode] = useState<"tree" | "raw">("tree");

  if (text === null) {
    return <p style={{ ...styles.msg, color: "#d32f2f" }}>Couldn&apos;t load this JSON file.</p>;
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
            style={{ ...styles.tab, ...(viewMode === "tree" ? styles.tabActive : {}) }}
          >
            🌲 Tree
          </button>
          <button
            onClick={() => setViewMode("raw")}
            style={{ ...styles.tab, ...(viewMode === "raw" ? styles.tabActive : {}) }}
          >
            📄 Raw
          </button>
        </div>
        <a href={url} download={fileName} style={styles.download} target="_blank" rel="noreferrer">
          ⬇ Download JSON
        </a>
      </div>

      {parseError && (
        <p style={{ ...styles.msg, color: "#d32f2f" }}>
          This file isn&apos;t valid JSON — showing raw text.
        </p>
      )}

      {/* Tree view */}
      {viewMode === "tree" && !parseError && data !== null && (
        <div style={styles.treeContainer}>
          <JsonView
            data={data}
            shouldExpandNode={allExpanded}
            style={defaultStyles}
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
  msg: { color: "#888", fontSize: 14 },
  wrapper: { display: "flex", flexDirection: "column", gap: 12 },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tabs: { display: "flex", gap: 4 },
  tab: {
    padding: "5px 12px",
    fontSize: 13,
    fontWeight: 500,
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "transparent",
    cursor: "pointer",
    color: "#555",
  },
  tabActive: {
    background: "#0070f3",
    color: "#fff",
    border: "1px solid #0070f3",
  },
  download: {
    fontSize: 13,
    color: "#0070f3",
    textDecoration: "none",
    fontWeight: 600,
  },
  treeContainer: {
    background: "#fafafa",
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    padding: "12px 16px",
    overflowX: "auto",
    fontSize: 13,
    maxHeight: "75vh",
    overflowY: "auto",
  },
  raw: {
    background: "#1e1e1e",
    color: "#d4d4d4",
    padding: "16px",
    borderRadius: 8,
    fontSize: 12,
    overflowX: "auto",
    overflowY: "auto",
    maxHeight: "75vh",
    margin: 0,
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },
};
