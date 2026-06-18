"use client";

interface PdfPreviewProps {
  url: string;
  fileName: string;
}

export default function PdfPreview({ url, fileName }: PdfPreviewProps) {
  return (
    <div style={styles.wrapper}>
      <iframe
        src={url}
        title={fileName}
        style={styles.frame}
      />
      <a href={url} download={fileName} className="accent-link" style={styles.download} target="_blank" rel="noreferrer">
        ⬇ Download PDF
      </a>
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
  download: {
    alignSelf: "flex-start",
    fontSize: 13,
    color: "var(--accent)",
    textDecoration: "none",
    fontWeight: 600,
  },
};
