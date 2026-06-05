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
      <a href={url} download={fileName} style={styles.download} target="_blank" rel="noreferrer">
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
  loading: { color: "#888", fontSize: 14 },
  error: { color: "#d32f2f", fontSize: 14 },
  img: {
    maxWidth: "100%",
    maxHeight: "80vh",
    objectFit: "contain",
    borderRadius: 8,
    border: "1px solid #e0e0e0",
    background: "#f9f9f9",
  },
  download: {
    fontSize: 13,
    color: "#0070f3",
    textDecoration: "none",
    fontWeight: 600,
  },
};
