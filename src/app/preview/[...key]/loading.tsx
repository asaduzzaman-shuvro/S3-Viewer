// Shown instantly on navigation (Suspense fallback) while the server presigns/lists
// siblings — so opening a file gives immediate feedback instead of freezing.
export default function PreviewLoading() {
  return (
    <div className="browse-shell">
      <main className="browse-main" style={styles.main}>
        <div style={styles.header}>
          <div style={{ ...styles.bar, width: 60, height: 13 }} />
          <div style={{ ...styles.bar, width: 220, height: 20, flex: 1 }} />
          <div style={{ ...styles.bar, width: 110, height: 32, borderRadius: 8 }} />
        </div>
        <div style={styles.divider} />
        <div style={{ ...styles.bar, ...styles.stage }} />
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
  divider: { borderBottom: "1px solid var(--border)", marginBottom: 20 },
  stage: { width: "100%", height: "70vh", borderRadius: 8 },
  bar: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    opacity: 0.7,
    animation: "s3v-pulse 1.2s ease-in-out infinite",
  },
};
