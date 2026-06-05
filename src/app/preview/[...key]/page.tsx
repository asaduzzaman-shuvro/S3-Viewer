import { redirect } from "next/navigation";
import Link from "next/link";
import { isAuthed } from "@/lib/auth";
import { presignGet, contentTypeFromKey } from "@/lib/s3";
import PdfPreview from "@/components/PdfPreview";
import ImagePreview from "@/components/ImagePreview";
import JsonPreview from "@/components/JsonPreview";

interface PreviewPageProps {
  params: Promise<{ key: string[] }>;
}

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

function getExt(key: string): string {
  return key.split(".").pop()?.toLowerCase() ?? "";
}

function backHref(key: string): string {
  const parts = key.split("/");
  if (parts.length <= 1) return "/browse";
  return "/browse/" + parts.slice(0, -1).map(encodeURIComponent).join("/");
}

export default async function PreviewPage({ params }: PreviewPageProps) {
  const authed = await isAuthed();
  if (!authed) redirect("/login");

  const { key: keySegments } = await params;
  const key = keySegments.map(decodeURIComponent).join("/");
  const fileName = key.split("/").pop() ?? key;
  const ext = getExt(key);
  const contentType = contentTypeFromKey(key);

  let url = "";
  let fetchError = false;

  try {
    url = await presignGet(key);
  } catch {
    fetchError = true;
  }

  const isImage = IMAGE_EXTS.includes(ext);
  const isPdf = ext === "pdf";
  const isJson = ext === "json";
  const isViewable = isImage || isPdf || isJson;

  return (
    <main style={styles.main}>
      {/* Header */}
      <div style={styles.header}>
        <Link href={backHref(key)} style={styles.back}>
          ← Back
        </Link>
        <div style={styles.fileInfo}>
          <span style={styles.fileName}>{fileName}</span>
          <span style={styles.contentType}>{contentType}</span>
        </div>
        {!fetchError && (
          <a href={url} target="_blank" rel="noreferrer" style={styles.downloadBtn}>
            ⬇ Download
          </a>
        )}
      </div>

      <div style={styles.divider} />

      {/* Preview area */}
      {fetchError ? (
        <div style={styles.errorBox}>
          <p>⚠️ Could not generate a preview URL. Check your S3 credentials.</p>
        </div>
      ) : isPdf ? (
        <PdfPreview url={url} fileName={fileName} />
      ) : isImage ? (
        <ImagePreview url={url} fileName={fileName} />
      ) : isJson ? (
        <JsonPreview url={url} fileName={fileName} />
      ) : (
        <div style={styles.unsupported}>
          <p style={styles.unsupportedText}>
            No preview available for <strong>.{ext}</strong> files.
          </p>
          <a href={url} download={fileName} style={styles.bigDownload} target="_blank" rel="noreferrer">
            ⬇ Download {fileName}
          </a>
        </div>
      )}

      {isViewable && !fetchError && (
        <p style={styles.expiry}>🔐 Preview link expires in 5 minutes.</p>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "28px 16px",
    fontFamily: "system-ui, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  back: {
    fontSize: 14,
    color: "#0070f3",
    textDecoration: "none",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  fileInfo: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontWeight: 700,
    fontSize: 16,
    color: "#111",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  contentType: { fontSize: 12, color: "#888" },
  downloadBtn: {
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    color: "#0070f3",
    border: "1px solid #0070f3",
    borderRadius: 6,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  divider: { borderBottom: "1px solid #eee", marginBottom: 20 },
  errorBox: {
    padding: 20,
    background: "#fff3f3",
    border: "1px solid #f5c6c6",
    borderRadius: 8,
    color: "#c00",
    fontSize: 14,
  },
  unsupported: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
    paddingTop: 48,
  },
  unsupportedText: { fontSize: 15, color: "#555" },
  bigDownload: {
    padding: "12px 28px",
    fontSize: 15,
    fontWeight: 600,
    background: "#0070f3",
    color: "#fff",
    borderRadius: 8,
    textDecoration: "none",
  },
  expiry: {
    marginTop: 16,
    fontSize: 12,
    color: "#bbb",
    textAlign: "center",
  },
};
