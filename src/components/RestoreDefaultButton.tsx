"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shown on the empty-state connect form when the env default exists but was deleted.
// Re-activates it (which also un-hides it) so a user who removed everything isn't
// stranded with no way back to their .env-configured bucket.
export default function RestoreDefaultButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function restore() {
    if (busy) return;
    setBusy(true);
    await fetch("/api/connection", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "env" }),
    });
    // The newly-active bucket's root, not the stale path we may be on.
    router.push("/browse");
    router.refresh();
  }

  return (
    <button type="button" onClick={restore} disabled={busy} style={styles.button}>
      {busy ? "Restoring…" : "↺ Use the default bucket from .env"}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  button: {
    width: "100%",
    marginTop: 14,
    padding: "11px 0",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--foreground)",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    cursor: "pointer",
  },
};
