import { redirect } from "next/navigation";
import Link from "next/link";
import { isAuthed } from "@/lib/auth";
import { getActiveConnection } from "@/lib/connection";
import { presignGet, contentTypeFromKey, getObjectText } from "@/lib/s3";
import PdfPreview from "@/components/PdfPreview";
import ImagePreview from "@/components/ImagePreview";
import JsonPreview from "@/components/JsonPreview";
import ThemeToggle from "@/components/ThemeToggle";

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

  const conn = await getActiveConnection();
  if (!conn) redirect("/browse");

  const { key: keySegments } = await params;
  const key = keySegments.map(decodeURIComponent).join("/");
  const fileName = key.split("/").pop() ?? key;
  const ext = getExt(key);
  const contentType = contentTypeFromKey(key);

  let url = "";
  let fetchError = false;

  try {
    url = await presignGet(conn, key);
  } catch {
    fetchError = true;
  }

  const isImage = IMAGE_EXTS.includes(ext);
  const isPdf = ext === "pdf";
  const isJson = ext === "json";
  const isViewable = isImage || isPdf || isJson;

  // Fetch JSON content server-side (avoids the browser needing CORS on the bucket).
  let jsonText: string | null = null;
  if (isJson && !fetchError) {
    try {
      jsonText = await getObjectText(conn, key);
    } catch {
      jsonText = null;
    }
  }

  return (
    <div className="browse-shell">
      <main className="browse-main" style={styles.main}>
        {/* Header */}
        <div
          className="browse-enter"
          style={{ ...styles.header, "--d": "40ms" } as React.CSSProperties}
        >
          <Link href={backHref(key)} className="preview-back" style={styles.back}>
            ← Back
          </Link>
          <div style={styles.fileInfo}>
            <span style={styles.fileName}>{fileName}</span>
            <span style={styles.contentType}>{contentType}</span>
          </div>
          {!fetchError && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="download-pill"
              style={styles.downloadBtn}
            >
              ⬇ Download
            </a>
          )}
          <ThemeToggle />
        </div>

        <div style={styles.divider} />

        {/* Preview area */}
        <div
          className="browse-enter"
          style={{ "--d": "100ms" } as React.CSSProperties}
        >
          {fetchError ? (
            <div style={styles.errorBox}>
              <p>⚠️ Could not generate a preview URL. Check your S3 credentials.</p>
            </div>
          ) : isPdf ? (
            <PdfPreview url={url} fileName={fileName} />
          ) : isImage ? (
            <ImagePreview url={url} fileName={fileName} />
          ) : isJson ? (
            <JsonPreview url={url} fileName={fileName} text={jsonText} />
          ) : (
            <div style={styles.unsupported}>
              <p style={styles.unsupportedText}>
                No preview available for <strong>.{ext}</strong> files.
              </p>
              <a
                href={url}
                download={fileName}
                className="download-cta"
                style={styles.bigDownload}
                target="_blank"
                rel="noreferrer"
              >
                ⬇ Download {fileName}
              </a>
            </div>
          )}

          {isViewable && !fetchError && (
            <p style={styles.expiry}>🔐 Preview link expires in 5 minutes.</p>
          )}
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "48px 16px 64px",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  back: {
    fontSize: 13,
    color: "var(--muted)",
    textDecoration: "none",
    fontWeight: 600,
    whiteSpace: "nowrap",
    fontFamily: "var(--font-geist-mono), monospace",
  },
  fileInfo: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontFamily: "var(--font-display), system-ui, sans-serif",
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: "-0.01em",
    color: "var(--foreground)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  contentType: {
    fontSize: 11,
    color: "var(--muted)",
    fontFamily: "var(--font-geist-mono), monospace",
    letterSpacing: "0.04em",
  },
  downloadBtn: {
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--accent)",
    border: "1px solid var(--accent)",
    borderRadius: 8,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  divider: { borderBottom: "1px solid var(--border)", marginBottom: 20 },
  errorBox: {
    padding: 20,
    background: "var(--danger-surface)",
    border: "1px solid var(--danger-border)",
    borderRadius: 8,
    color: "var(--danger)",
    fontSize: 14,
  },
  unsupported: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
    paddingTop: 48,
  },
  unsupportedText: { fontSize: 15, color: "var(--muted)" },
  bigDownload: {
    padding: "12px 28px",
    fontSize: 15,
    fontWeight: 600,
    background: "var(--accent)",
    color: "var(--accent-contrast)",
    borderRadius: 8,
    textDecoration: "none",
  },
  expiry: {
    marginTop: 16,
    fontSize: 12,
    color: "var(--muted)",
    textAlign: "center",
    fontFamily: "var(--font-geist-mono), monospace",
  },
};
