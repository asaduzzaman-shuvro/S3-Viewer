"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConnectionForm from "./ConnectionForm";

export interface SwitcherConnection {
  id: string;
  label: string;
  bucket: string;
  region: string;
  isEnv: boolean;
  isActive: boolean;
  isOverridden: boolean;
}

interface BucketSwitcherProps {
  connections: SwitcherConnection[];
  // The env default is configured but currently deleted/hidden — offer to restore it.
  restorableDefault?: boolean;
}

export default function BucketSwitcher({ connections, restorableDefault }: BucketSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SwitcherConnection | null>(null);
  const [confirming, setConfirming] = useState<SwitcherConnection | null>(null);
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
    setConfirming(null);
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
                  <button
                    type="button"
                    className="switch-action"
                    style={styles.action}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(c);
                      setAdding(false);
                    }}
                    disabled={busy}
                    aria-label={`Edit ${c.label}`}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="switch-action switch-danger"
                    style={styles.action}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirming(c);
                    }}
                    disabled={busy}
                    aria-label={`Delete ${c.label}`}
                    title="Delete"
                  >
                    🗑️
                  </button>
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
                <>
                  {restorableDefault && (
                    <button
                      type="button"
                      style={styles.restoreBtn}
                      onClick={() => activate("env")}
                      disabled={busy}
                    >
                      ↺ Restore default bucket
                    </button>
                  )}
                  <button type="button" style={styles.addBtn} onClick={() => setAdding(true)}>
                    + Add another bucket
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {confirming && (
        <div
          style={styles.modalBackdrop}
          onClick={() => !busy && setConfirming(null)}
        >
          <div
            style={styles.modalCard}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={styles.modalTitle}>Delete bucket?</h3>
            <p style={styles.modalText}>
              Delete <strong>{confirming.label}</strong>?{" "}
              {confirming.isEnv
                ? "You can restore the default bucket afterwards."
                : "You'll need to re-enter its details to use it again."}
            </p>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.modalCancel}
                onClick={() => setConfirming(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                style={styles.modalDelete}
                onClick={() => remove(confirming.id)}
                disabled={busy}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
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
  list: { display: "flex", flexDirection: "column", gap: 6 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    paddingRight: 6,
    borderRadius: 9,
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
  action: {
    flex: "none",
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 9,
    color: "var(--muted)",
    cursor: "pointer",
    fontSize: 15,
    lineHeight: 1,
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
  restoreBtn: {
    width: "100%",
    padding: "9px 0",
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 600,
    color: "var(--foreground)",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 9,
    cursor: "pointer",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    background: "rgba(0, 0, 0, 0.5)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    boxShadow: "var(--shadow-card)",
    padding: 22,
    textAlign: "left",
  },
  modalTitle: {
    margin: "0 0 8px",
    fontFamily: "var(--font-display), system-ui, sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: "var(--foreground)",
  },
  modalText: {
    margin: "0 0 20px",
    fontSize: 14,
    lineHeight: 1.5,
    color: "var(--muted)",
    wordBreak: "break-word",
  },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10 },
  modalCancel: {
    padding: "9px 16px",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--foreground)",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 9,
    cursor: "pointer",
  },
  modalDelete: {
    padding: "9px 18px",
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    background: "var(--danger)",
    border: "1px solid var(--danger)",
    borderRadius: 9,
    cursor: "pointer",
  },
};
