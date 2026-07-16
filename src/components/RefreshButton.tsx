"use client";

import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { reloadCurrentFolder } from "@/app/browse/actions";

interface RefreshButtonProps {
  /** Current folder prefix (e.g. "photos/2024/") — the entry to invalidate. */
  prefix: string;
}

export default function RefreshButton({ prefix }: RefreshButtonProps) {
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();

  function reload() {
    startTransition(() => reloadCurrentFolder(prefix, pathname));
  }

  return (
    <button
      type="button"
      onClick={reload}
      disabled={pending}
      className="signout-btn"
      style={styles.btn}
      title="Reload this folder from S3"
      aria-label="Reload from remote"
    >
      <span style={{ ...styles.glyph, ...(pending ? styles.spinning : {}) }}>⟳</span>
      {pending ? "Reloading…" : "Reload"}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  btn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 600,
    background: "var(--surface)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    cursor: "pointer",
  },
  glyph: { display: "inline-block", fontSize: 14, lineHeight: 1 },
  spinning: { animation: "spin 0.7s linear infinite" },
};
