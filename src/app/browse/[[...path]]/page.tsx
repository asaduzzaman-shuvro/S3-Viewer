import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { getActiveConnection, listConnections, canRestoreEnvDefault } from "@/lib/connection";
import { listPrefix } from "@/lib/s3";
import Breadcrumb from "@/components/Breadcrumb";
import FileRow from "@/components/FileRow";
import LogoutButton from "@/components/LogoutButton";
import ConnectionForm from "@/components/ConnectionForm";
import BucketSwitcher from "@/components/BucketSwitcher";
import RestoreDefaultButton from "@/components/RestoreDefaultButton";

interface BrowsePageProps {
  params: Promise<{ path?: string[] }>;
}

export default async function BrowsePage({ params }: BrowsePageProps) {
  const authed = await isAuthed();
  if (!authed) redirect("/login");

  const conn = await getActiveConnection();
  // No connection configured (no env creds, or everything was deleted) → show the form.
  if (!conn) {
    const canRestore = await canRestoreEnvDefault();
    return (
      <main className="auth-bg">
        <div className="auth-card" style={{ maxWidth: 440, textAlign: "left" }}>
          <span style={styles.connEyebrow}>● connect</span>
          <h1 style={styles.connTitle}>Connect an S3 bucket</h1>
          <p style={styles.connSubtitle}>
            No bucket is configured. Enter credentials to start browsing — they&apos;re
            validated and stored encrypted, server-side only.
          </p>
          <ConnectionForm submitLabel="Connect & open" />
          {canRestore && <RestoreDefaultButton />}
        </div>
      </main>
    );
  }

  const { path = [] } = await params;

  // Decode each segment (handles spaces, special chars in folder names)
  const segments = path.map(decodeURIComponent);
  const prefix = segments.length > 0 ? segments.join("/") + "/" : "";

  let folders: string[] = [];
  let files: Awaited<ReturnType<typeof listPrefix>>["files"] = [];
  let listError = false;
  try {
    ({ folders, files } = await listPrefix(conn, prefix));
  } catch (err) {
    console.error("[browse] listPrefix failed", err);
    listError = true;
  }

  if (listError) {
    return (
      <main className="auth-bg">
        <div className="auth-card" style={{ maxWidth: 440, textAlign: "left" }}>
          <span style={styles.connEyebrow}>● connection error</span>
          <h1 style={styles.connTitle}>Couldn&apos;t reach “{conn.bucket}”</h1>
          <p style={styles.connSubtitle}>
            The active connection couldn&apos;t list this bucket — the credentials may be
            wrong or expired. Re-enter them to reconnect.
          </p>
          <ConnectionForm submitLabel="Reconnect" />
        </div>
      </main>
    );
  }

  // Strip the current prefix to get display names for folders
  const folderItems = folders.map((f) => {
    const stripped = f.slice(prefix.length).replace(/\/$/, "");
    const href = "/browse/" + [...segments, encodeURIComponent(stripped)].join("/");
    return { name: stripped, href };
  });

  const fileItems = files.map((f) => {
    const href = "/preview/" + f.key.split("/").map(encodeURIComponent).join("/");
    return { ...f, href };
  });

  const isEmpty = folderItems.length === 0 && fileItems.length === 0;
  const here = segments.length > 0 ? segments[segments.length - 1] : "root";
  const connections = await listConnections();
  const restorableDefault = await canRestoreEnvDefault();

  return (
    <div className="browse-shell">
      <main className="browse-main" style={styles.main}>
        {/* Header */}
        <header style={styles.header}>
          <div className="browse-enter" style={{ "--d": "40ms" } as React.CSSProperties}>
            <span style={styles.eyebrow}>● {conn.bucket}</span>
            <h1 style={styles.title}>{here}</h1>
            <p style={styles.count}>
              {folderItems.length} {folderItems.length === 1 ? "folder" : "folders"}
              {"  ·  "}
              {fileItems.length} {fileItems.length === 1 ? "file" : "files"}
            </p>
          </div>
          <div style={styles.headerActions} className="browse-enter">
            <BucketSwitcher connections={connections} restorableDefault={restorableDefault} />
            <LogoutButton />
          </div>
        </header>

        <div className="browse-enter" style={{ "--d": "90ms" } as React.CSSProperties}>
          <Breadcrumb segments={segments} />
        </div>

        {/* Column headers */}
        {!isEmpty && (
          <div
            className="browse-enter"
            style={{ ...styles.columnHeader, "--d": "130ms" } as React.CSSProperties}
          >
            <span />
            <span>Name</span>
            <span style={{ textAlign: "right" }}>Size</span>
            <span style={{ textAlign: "right" }}>Modified</span>
          </div>
        )}

        <div style={styles.divider} />

        {/* Folders */}
        {folderItems.map((f, i) => (
          <FileRow key={f.href} name={f.name} href={f.href} isFolder index={i} />
        ))}

        {/* Files */}
        {fileItems.map((f, i) => (
          <FileRow
            key={f.href}
            name={f.name}
            href={f.href}
            size={f.size}
            lastModified={f.lastModified}
            index={folderItems.length + i}
          />
        ))}

        {isEmpty && (
          <div style={styles.empty}>
            <span style={styles.emptyGlyph}>∅</span>
            <p style={styles.emptyText}>This folder is empty.</p>
          </div>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 880,
    margin: "0 auto",
    padding: "48px 16px 64px",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 24,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: "none",
    // Lift the switcher (and its dropdown) above the file rows, which each become
    // their own stacking context via the browse-enter entrance transform.
    position: "relative",
    zIndex: 30,
  },
  eyebrow: {
    display: "inline-block",
    marginBottom: 6,
    fontFamily: "var(--font-geist-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "var(--accent)",
  },
  title: {
    margin: 0,
    fontFamily: "var(--font-display), system-ui, sans-serif",
    fontSize: 30,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "var(--foreground)",
    wordBreak: "break-word",
  },
  count: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "var(--muted)",
    fontFamily: "var(--font-geist-mono), monospace",
  },
  columnHeader: {
    display: "grid",
    gridTemplateColumns: "40px 1fr 96px 172px",
    gap: 12,
    padding: "4px 14px",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  divider: { borderBottom: "1px solid var(--border)", margin: "6px 0 6px" },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: "56px 12px",
    color: "var(--muted)",
  },
  emptyGlyph: { fontSize: 32, opacity: 0.5 },
  emptyText: { margin: 0, fontSize: 14 },
  connEyebrow: {
    display: "inline-block",
    marginBottom: 12,
    fontFamily: "var(--font-geist-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "var(--accent)",
  },
  connTitle: {
    margin: "0 0 8px",
    fontFamily: "var(--font-display), system-ui, sans-serif",
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "var(--foreground)",
  },
  connSubtitle: {
    margin: "0 0 24px",
    fontSize: 14,
    lineHeight: 1.5,
    color: "var(--muted)",
  },
};
