"use client";

import { useState } from "react";
import { useCachedObjectUrl } from "@/lib/useCachedObjectUrl";

interface ImagePreviewProps {
  url: string;
  fileName: string;
  cacheKey: string;
}

// Owns the <img> element's own load/error state. Keyed by `src` at the call site
// so a new source remounts it and the state resets — no effect needed.
function ImageContent({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  return (
    <>
      {!loaded && !error && <p style={styles.loading}>Loading image…</p>}
      {error && <p style={styles.error}>Failed to load image.</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={{ ...styles.img, display: loaded ? "block" : "none" }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </>
  );
}

export default function ImagePreview({ url, fileName, cacheKey }: ImagePreviewProps) {
  const { src, loading, fromCache, refresh } = useCachedObjectUrl({ cacheKey, remoteUrl: url });

  return (
    <div style={styles.wrapper}>
      {loading && <p style={styles.loading}>Loading image…</p>}
      {src && <ImageContent key={src} src={src} alt={fileName} />}
      <div style={styles.actions}>
        {fromCache && <span style={styles.cached}>⚡ cached</span>}
        <button type="button" onClick={refresh} className="accent-link" style={styles.action}>
          ⟳ Fetch from remote
        </button>
        <a href={url} download={fileName} className="accent-link" style={styles.action} target="_blank" rel="noreferrer">
          ⬇ Download image
        </a>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
  },
  loading: { color: "var(--muted)", fontSize: 14 },
  error: { color: "var(--danger)", fontSize: 14 },
  img: {
    maxWidth: "100%",
    maxHeight: "80vh",
    objectFit: "contain",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface)",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 16,
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
