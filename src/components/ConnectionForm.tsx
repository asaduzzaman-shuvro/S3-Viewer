"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

/** Existing connection being edited (never includes the secret key). */
export interface EditableConnection {
  id: string;
  label: string;
  region: string;
  bucket: string;
  accessKeyId: string;
}

interface ConnectionFormProps {
  /** Called after a successful save. Defaults to refreshing the route. */
  onSuccess?: () => void;
  submitLabel?: string;
  /** When provided, the form edits this connection instead of adding a new one. */
  connection?: EditableConnection;
}

export default function ConnectionForm({ onSuccess, submitLabel, connection }: ConnectionFormProps) {
  const router = useRouter();
  const isEdit = !!connection;
  const [values, setValues] = useState<Record<string, string>>((): Record<string, string> => {
    if (!connection) return {};
    return {
      label: connection.label,
      region: connection.region,
      bucket: connection.bucket,
      accessKeyId: connection.accessKeyId,
    };
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // In edit mode the secret is optional (blank keeps the current one).
  const fields = [
    { name: "label", label: "Label (optional)", placeholder: "e.g. Staging assets", type: "text", required: false },
    { name: "region", label: "Region", placeholder: "us-east-1", type: "text", required: true },
    { name: "bucket", label: "Bucket", placeholder: "my-bucket", type: "text", required: true },
    { name: "accessKeyId", label: "Access key ID", placeholder: "AKIA…", type: "text", required: true },
    {
      name: "secretAccessKey",
      label: isEdit ? "Secret access key (leave blank to keep)" : "Secret access key",
      placeholder: isEdit ? "Leave blank to keep current" : "••••••••••••",
      type: "password",
      required: !isEdit,
    },
  ];

  function update(name: string, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return; // guard against double-submit
    setError("");
    setLoading(true);

    const res = await fetch("/api/connection", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { ...values, id: connection!.id } : values),
    });

    if (res.ok) {
      // Keep the button busy through the refresh/navigation.
      if (onSuccess) onSuccess();
      else router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not connect. Check the details and try again.");
      setLoading(false);
    }
  }

  const buttonLabel = submitLabel ?? (isEdit ? "Save changes" : "Connect");

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      {fields.map((f) => (
        <label key={f.name} style={styles.field}>
          <span style={styles.label}>{f.label}</span>
          <input
            className="auth-input"
            type={f.type}
            value={values[f.name] ?? ""}
            onChange={(e) => update(f.name, e.target.value)}
            placeholder={f.placeholder}
            required={f.required}
            autoComplete="off"
            spellCheck={false}
            style={styles.input}
          />
        </label>
      ))}

      {error && <p style={styles.error}>{error}</p>}

      <button type="submit" disabled={loading} aria-busy={loading} className="auth-button" style={styles.button}>
        {loading && <span className="spinner" aria-hidden="true" />}
        {loading ? "Validating…" : buttonLabel}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: "flex", flexDirection: "column", gap: 14, textAlign: "left" },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: {
    fontFamily: "var(--font-geist-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--muted)",
  },
  input: {
    padding: "11px 14px",
    fontSize: 15,
    border: "1px solid var(--border)",
    borderRadius: 10,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    background: "var(--background)",
    color: "var(--foreground)",
  },
  error: {
    margin: 0,
    padding: "9px 12px",
    fontSize: 13,
    borderRadius: 8,
    color: "var(--danger)",
    background: "var(--danger-surface)",
    border: "1px solid var(--danger)",
  },
  button: {
    marginTop: 4,
    padding: "12px 0",
    fontSize: 15,
    fontWeight: 600,
    background: "var(--accent)",
    color: "var(--accent-contrast)",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
};
