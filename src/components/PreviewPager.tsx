"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PreviewPagerProps {
  prevHref: string | null;
  nextHref: string | null;
  position: { index: number; total: number } | null;
}

export default function PreviewPager({
  prevHref,
  nextHref,
  position,
}: PreviewPagerProps) {
  const router = useRouter();

  // Arrow-key navigation. ← / → jump to the previous / next viewable sibling.
  // Note: keys may not fire while focus is inside the PDF iframe (PdfPreview);
  // the on-screen buttons always work.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement | null)?.isContentEditable) {
        return;
      }
      if (e.key === "ArrowLeft" && prevHref) {
        e.preventDefault();
        router.push(prevHref);
      } else if (e.key === "ArrowRight" && nextHref) {
        e.preventDefault();
        router.push(nextHref);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevHref, nextHref, router]);

  // Nothing to navigate and no position to show → render nothing.
  if (!prevHref && !nextHref && !position) return null;

  return (
    <div style={styles.row}>
      {prevHref ? (
        <Link href={prevHref} className="accent-link" style={styles.btn} aria-label="Previous file">
          ← Prev
        </Link>
      ) : (
        <span style={{ ...styles.btn, ...styles.disabled }} aria-disabled="true">
          ← Prev
        </span>
      )}

      {position && (
        <span style={styles.position}>
          {position.index} of {position.total}
        </span>
      )}

      {nextHref ? (
        <Link href={nextHref} className="accent-link" style={styles.btn} aria-label="Next file">
          Next →
        </Link>
      ) : (
        <span style={{ ...styles.btn, ...styles.disabled }} aria-disabled="true">
          Next →
        </span>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 20,
  },
  btn: {
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--accent)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  disabled: {
    color: "var(--muted)",
    opacity: 0.5,
    cursor: "default",
  },
  position: {
    fontSize: 12,
    color: "var(--muted)",
    fontFamily: "var(--font-geist-mono), monospace",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  },
};
