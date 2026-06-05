import Link from "next/link";

interface BreadcrumbProps {
  segments: string[]; // path segments, e.g. ["photos", "2024"]
}

export default function Breadcrumb({ segments }: BreadcrumbProps) {
  return (
    <nav style={styles.nav} aria-label="Breadcrumb">
      <ol style={styles.list}>
        <li style={styles.item}>
          <Link href="/browse" className="crumb-link" style={styles.link}>
            🪣 root
          </Link>
        </li>
        {segments.map((seg, i) => {
          const href = "/browse/" + segments.slice(0, i + 1).map(encodeURIComponent).join("/");
          const isLast = i === segments.length - 1;
          return (
            <li key={href} style={styles.item}>
              <span style={styles.separator}>/</span>
              {isLast ? (
                <span style={styles.current}>{seg}</span>
              ) : (
                <Link href={href} className="crumb-link" style={styles.link}>
                  {seg}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: { marginBottom: 22 },
  list: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 2,
    listStyle: "none",
    margin: 0,
    padding: "6px 8px",
    fontSize: 13,
    fontFamily: "var(--font-geist-mono), monospace",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    width: "fit-content",
    maxWidth: "100%",
  },
  item: { display: "flex", alignItems: "center", gap: 2 },
  separator: { color: "var(--muted)", padding: "0 2px" },
  link: {
    color: "var(--muted)",
    textDecoration: "none",
    padding: "3px 8px",
    borderRadius: 6,
  },
  current: {
    color: "var(--accent)",
    fontWeight: 600,
    padding: "3px 8px",
  },
};
