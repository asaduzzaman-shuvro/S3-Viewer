"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConnectionForm from "./ConnectionForm";

export interface SwitcherConnection {
  id: string;
  label: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  isEnv: boolean;
  isActive: boolean;
}

interface BucketSwitcherProps {
  connections: SwitcherConnection[];
}

export default function BucketSwitcher({ connections }: BucketSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SwitcherConnection | null>(null);
  const [busy, setBusy] = useState(false);

  const active = connections.find((c) => c.isActive);

  async function activate(id: string) {
    if (busy) return;
    setBusy(true);
    await fetch("/api/connection", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/connection?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        className="switch-btn"
        style={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span style={styles.triggerIcon}>🪣</span>
        <span style={styles.triggerLabel}>{active?.label ?? "Select bucket"}</span>
        <span style={styles.caret}>▾</span>
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div style={styles.backdrop} onClick={() => setOpen(false)} />
          <div style={styles.panel} role="menu">
            <p style={styles.panelHeading}>Buckets</p>

            <div style={styles.list}>
              {connections.map((c) => (
                <div
                  key={c.id}
                  className="switch-row"
                  style={{
                    ...styles.row,
                    ...(c.isActive ? styles.rowActive : null),
                  }}
                >
                  <button
                    type="button"
                    style={styles.rowMain}
                    onClick={() => !c.isActive && activate(c.id)}
                    disabled={busy}
                  >
                    <span style={styles.check}>{c.isActive ? "●" : ""}</span>
                    <span style={styles.rowText}>
                      <span style={styles.rowLabel}>{c.label}</span>
                      <span style={styles.rowMeta}>
                        {c.bucket} · {c.region}
                        {c.isEnv ? " · default" : ""}
                      </span>
                    </span>
                  </button>
                  {!c.isEnv && (
                    <>
                      <button
                        type="button"
                        className="switch-remove"
                        style={styles.remove}
                        onClick={() => {
                          setEditing(c);
                          setAdding(false);
                        }}
                        disabled={busy}
                        aria-label={`Edit ${c.label}`}
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="switch-remove"
                        style={styles.remove}
                        onClick={() => remove(c.id)}
                        disabled={busy}
                        aria-label={`Remove ${c.label}`}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div style={styles.footer}>
              {editing ? (
                <>
                  <div style={styles.editHeader}>
                    <span style={styles.editTitle}>Editing “{editing.label}”</span>
                    <button type="button" style={styles.cancel} onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                  <ConnectionForm
                    connection={{
                      id: editing.id,
                      label: editing.label,
                      region: editing.region,
                      bucket: editing.bucket,
                      accessKeyId: editing.accessKeyId,
                    }}
                    submitLabel="Save changes"
                    onSuccess={() => {
                      setEditing(null);
                      setOpen(false);
                      router.refresh();
                    }}
                  />
                </>
              ) : adding ? (
                <ConnectionForm
                  submitLabel="Add & switch"
                  onSuccess={() => {
                    setAdding(false);
                    setOpen(false);
                    router.refresh();
                  }}
                />
              ) : (
                <button type="button" style={styles.addBtn} onClick={() => setAdding(true)}>
                  + Add another bucket
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { position: "relative" },
  trigger: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    maxWidth: 220,
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--foreground)",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    cursor: "pointer",
  },
  triggerIcon: { fontSize: 14 },
  triggerLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  caret: { color: "var(--muted)", fontSize: 11 },
  backdrop: { position: "fixed", inset: 0, zIndex: 10 },
  panel: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    zIndex: 11,
    width: 320,
    maxWidth: "calc(100vw - 32px)",
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    boxShadow: "var(--shadow-card)",
    padding: 10,
  },
  panelHeading: {
    margin: "4px 8px 8px",
    fontFamily: "var(--font-geist-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--muted)",
  },
  list: { display: "flex", flexDirection: "column", gap: 2 },
  row: {
    display: "flex",
    alignItems: "center",
    borderRadius: 9,
    overflow: "hidden",
  },
  rowActive: { background: "var(--accent-soft)" },
  rowMain: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 10px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
    color: "var(--foreground)",
    minWidth: 0,
  },
  check: { width: 12, color: "var(--accent)", fontSize: 10 },
  rowText: { display: "flex", flexDirection: "column", gap: 1, minWidth: 0 },
  rowLabel: {
    fontSize: 14,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rowMeta: {
    fontSize: 11,
    color: "var(--muted)",
    fontFamily: "var(--font-geist-mono), monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  remove: {
    flex: "none",
    width: 30,
    height: 30,
    marginRight: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    color: "var(--muted)",
    cursor: "pointer",
    fontSize: 12,
  },
  footer: { marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" },
  editHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: "2px 4px 10px",
  },
  editTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cancel: {
    flex: "none",
    padding: "4px 8px",
    fontSize: 12,
    color: "var(--muted)",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 7,
    cursor: "pointer",
  },
  addBtn: {
    width: "100%",
    padding: "9px 0",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--accent)",
    background: "transparent",
    border: "1px dashed var(--border)",
    borderRadius: 9,
    cursor: "pointer",
  },
};
