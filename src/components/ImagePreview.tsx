"use client";

import { useState } from "react";

interface ImagePreviewProps {
  url: string;
  fileName: string;
}

export default function ImagePreview({ url, fileName }: ImagePreviewProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div style={styles.wrapper}>
      {!loaded && !error && <p style={styles.loading}>Loading image…</p>}
      {error && <p style={styles.error}>Failed to load image.</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={fileName}
        style={{ ...styles.img, display: loaded ? "block" : "none" }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      <a href={url} download={fileName} className="accent-link" style={styles.download} target="_blank" rel="noreferrer">
        ⬇ Download image
      </a>
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
  download: {
    fontSize: 13,
    color: "var(--accent)",
    textDecoration: "none",
    fontWeight: 600,
  },
};
