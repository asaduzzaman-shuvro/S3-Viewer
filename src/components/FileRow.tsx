import Link from "next/link";

interface FileRowProps {
  name: string;
  href: string;
  size?: number;       // bytes — undefined for folders
  lastModified?: Date;
  isFolder?: boolean;
  index?: number;      // position in the list, used to stagger the entrance
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "🖼️";
  if (ext === "pdf") return "📄";
  if (ext === "json") return "📋";
  if (["mp4", "mov", "avi"].includes(ext)) return "🎬";
  if (["mp3", "wav", "aac"].includes(ext)) return "🎵";
  if (["zip", "tar", "gz"].includes(ext)) return "🗜️";
  if (["csv", "xls", "xlsx"].includes(ext)) return "📊";
  if (["txt", "md"].includes(ext)) return "📝";
  return "📦";
}

export default function FileRow({
  name,
  href,
  size,
  lastModified,
  isFolder,
  index = 0,
}: FileRowProps) {
  // Cap the cumulative delay so long listings don't animate forever.
  const delay = Math.min(index * 28, 420);

  return (
    <Link
      href={href}
      className="file-row browse-enter"
      style={{ ...styles.row, "--d": `${delay}ms` } as React.CSSProperties}
    >
      <span
        className="file-row-icon"
        style={{
          ...styles.icon,
          ...(isFolder ? styles.iconFolder : styles.iconFile),
        }}
      >
        {isFolder ? "📁" : fileIcon(name)}
      </span>
      <span style={styles.name}>{name}</span>
      <span style={styles.meta}>
        {!isFolder && size !== undefined ? formatBytes(size) : "—"}
      </span>
      <span style={styles.meta}>
        {!isFolder && lastModified ? formatDate(lastModified) : "—"}
      </span>
    </Link>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "grid",
    gridTemplateColumns: "40px 1fr 96px 172px",
    alignItems: "center",
    gap: 12,
    padding: "9px 14px",
    borderRadius: 10,
    textDecoration: "none",
    color: "var(--foreground)",
    fontSize: 14.5,
  },
  icon: {
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    borderRadius: 9,
    border: "1px solid var(--border)",
  },
  iconFolder: { background: "var(--accent-soft)" },
  iconFile: { background: "var(--surface)" },
  name: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontWeight: 500,
  },
  meta: {
    color: "var(--muted)",
    fontSize: 12,
    textAlign: "right",
    fontFamily: "var(--font-geist-mono), monospace",
    fontVariantNumeric: "tabular-nums",
  },
};
