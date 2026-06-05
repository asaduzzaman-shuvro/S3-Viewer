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
      <a href={url} download={fileName} style={styles.download} target="_blank" rel="noreferrer">
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
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    background: "#f9f9f9",
  },
  download: {
    alignSelf: "flex-start",
    fontSize: 13,
    color: "#0070f3",
    textDecoration: "none",
    fontWeight: 600,
  },
};
