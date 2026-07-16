// Shown instantly on navigation (Suspense fallback) while the server lists the
// prefix — so clicking a folder gives immediate feedback instead of freezing on
// the previous page.
export default function BrowseLoading() {
  return (
    <div className="browse-shell">
      <main className="browse-main" style={styles.main}>
        <div style={styles.header}>
          <div>
            <div style={{ ...styles.bar, width: 90, height: 11, marginBottom: 10 }} />
            <div style={{ ...styles.bar, width: 180, height: 28 }} />
          </div>
        </div>
        <div style={{ ...styles.bar, width: 240, height: 32, borderRadius: 10, margin: "16px 0" }} />
        <div style={styles.divider} />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={styles.row}>
            <div style={{ ...styles.bar, width: 30, height: 30, borderRadius: 9 }} />
            <div style={{ ...styles.bar, width: `${40 + ((i * 13) % 45)}%`, height: 14 }} />
          </div>
        ))}
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
  header: { marginBottom: 24 },
  divider: { borderBottom: "1px solid var(--border)", margin: "6px 0" },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "9px 14px",
  },
  bar: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    opacity: 0.7,
    animation: "s3v-pulse 1.2s ease-in-out infinite",
  },
};
