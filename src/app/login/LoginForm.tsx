"use client";

import { useState, useEffect, FormEvent } from "react";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // When this page is restored from the browser's back/forward cache (Back button or
  // swipe-back after logging in), the server — and thus the redirect for authenticated
  // users — is bypassed. Force a reload so an authed visitor is sent on to /browse
  // instead of staring at a stale login form.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return; // guard against double-submit (rapid clicks / held Enter)

    setError("");
    setLoading(true);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      // Use replace(), not assign(): it swaps the /login history entry for /browse, so
      // Back/swipe-back skips past login entirely (there's no /login entry to return to).
      // A full navigation also lets the middleware re-evaluate the freshly-set cookie.
      window.location.replace("/browse");
    } else {
      setLoading(false);
      setError("Incorrect password. Please try again.");
      setPassword("");
    }
  }

  return (
    <main className="auth-bg">
      <div className="auth-card" style={styles.card}>
        <span className="auth-enter" style={{ ...styles.eyebrow, "--d": "60ms" } as React.CSSProperties}>
          ● Secure access
        </span>

        <div className="auth-enter" style={{ ...styles.badge, "--d": "120ms" } as React.CSSProperties}>
          🪣
        </div>

        <h1 className="auth-enter" style={{ ...styles.title, "--d": "180ms" } as React.CSSProperties}>
          S3 Storage Viewer
        </h1>
        <p className="auth-enter" style={{ ...styles.subtitle, "--d": "230ms" } as React.CSSProperties}>
          Enter your password to open the bucket.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="password"
            className="auth-input auth-enter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            required
            style={{ ...styles.input, "--d": "290ms" } as React.CSSProperties}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="auth-button auth-enter"
            style={{ ...styles.button, "--d": "340ms" } as React.CSSProperties}
          >
            {loading && <span className="spinner" aria-hidden="true" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-enter" style={{ ...styles.footnote, "--d": "400ms" } as React.CSSProperties}>
          Protected area · authorized users only
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    // layout/animation/shadow live in globals.css (.auth-card)
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  },
  eyebrow: {
    display: "inline-block",
    marginBottom: 20,
    fontFamily: "var(--font-geist-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "var(--accent)",
  },
  badge: {
    width: 64,
    height: 64,
    margin: "0 auto 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 30,
    borderRadius: 18,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  title: {
    margin: "0 0 6px",
    fontFamily: "var(--font-display), system-ui, sans-serif",
    fontSize: 27,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "var(--foreground)",
  },
  subtitle: {
    margin: "0 0 28px",
    fontSize: 14.5,
    lineHeight: 1.5,
    color: "var(--muted)",
  },
  form: { display: "flex", flexDirection: "column", gap: 12, textAlign: "left" },
  input: {
    padding: "12px 15px",
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
  footnote: {
    margin: "24px 0 0",
    fontSize: 12,
    color: "var(--muted)",
    opacity: 0.8,
  },
};
