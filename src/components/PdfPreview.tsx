"use client";

import { useCachedObjectUrl } from "@/lib/useCachedObjectUrl";

interface PdfPreviewProps {
  url: string;
  fileName: string;
  cacheKey: string;
}

export default function PdfPreview({ url, fileName, cacheKey }: PdfPreviewProps) {
  const { src, loading, fromCache, refresh } = useCachedObjectUrl({ cacheKey, remoteUrl: url });

  return (
    <div style={styles.wrapper}>
      {loading || !src ? (
        <div style={styles.placeholder}>Loading PDF…</div>
      ) : (
        <iframe key={src} src={src} title={fileName} style={styles.frame} />
      )}
      <div style={styles.actions}>
        {fromCache && <span style={styles.cached}>⚡ cached</span>}
        <button type="button" onClick={refresh} className="accent-link" style={styles.action}>
          ⟳ Fetch from remote
        </button>
        <a href={url} download={fileName} className="accent-link" style={styles.action} target="_blank" rel="noreferrer">
          ⬇ Download PDF
        </a>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: "flex", flexDirection: "column", gap: 12, height: "100%" },
  frame: {
    flex: 1,
    width: "100%",
    minHeight: "75vh",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--surface)",
  },
  placeholder: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: "75vh",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--surface)",
    color: "var(--muted)",
    fontSize: 14,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    alignSelf: "flex-start",
  },
  cached: {
    fontSize: 12,
    color: "var(--muted)",
    fontFamily: "var(--font-geist-mono), monospace",
  },
  action: {
    fontSize: 13,
    color: "var(--accent)",
    textDecoration: "none",
    fontWeight: 600,
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
