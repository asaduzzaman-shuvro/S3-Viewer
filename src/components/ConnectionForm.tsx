"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface ConnectionFormProps {
  /** Called after a successful save. Defaults to refreshing the route. */
  onSuccess?: () => void;
  submitLabel?: string;
}

const FIELDS = [
  { name: "label", label: "Label (optional)", placeholder: "e.g. Staging assets", type: "text", required: false },
  { name: "region", label: "Region", placeholder: "us-east-1", type: "text", required: true },
  { name: "bucket", label: "Bucket", placeholder: "my-bucket", type: "text", required: true },
  { name: "accessKeyId", label: "Access key ID", placeholder: "AKIA…", type: "text", required: true },
  { name: "secretAccessKey", label: "Secret access key", placeholder: "••••••••••••", type: "password", required: true },
] as const;

export default function ConnectionForm({ onSuccess, submitLabel = "Connect" }: ConnectionFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(name: string, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return; // guard against double-submit
    setError("");
    setLoading(true);

    const res = await fetch("/api/connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
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

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      {FIELDS.map((f) => (
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
        {loading ? "Validating…" : submitLabel}
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
