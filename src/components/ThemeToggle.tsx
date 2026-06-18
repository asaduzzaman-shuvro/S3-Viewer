"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type Preference = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const THEME_EVENT = "themechange";

// Crisp monochrome line icons that inherit the button's text color (currentColor),
// so all three share one weight and adapt to light/dark. ~16px, no fill.
const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<Preference, React.ReactElement> = {
  light: (
    <svg {...iconProps} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  dark: (
    <svg {...iconProps} aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  system: (
    <svg {...iconProps} aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  ),
};

// Click order: each click advances to the next; wraps light → dark → system → light.
const CYCLE: Preference[] = ["light", "dark", "system"];
const LABELS: Record<Preference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

function resolve(pref: Preference): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

// Apply a preference: persist it, set the concrete theme on <html>, and notify any
// other subscribers (other toggles, the JSON tree) via a custom event.
function applyPreference(pref: Preference) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* localStorage may be unavailable (private mode) — still apply for this session */
  }
  document.documentElement.dataset.theme = resolve(pref);
  window.dispatchEvent(new Event(THEME_EVENT));
}

// Read the current preference reactively without setState-in-effect (which the linter
// forbids): useSyncExternalStore subscribes to our custom event + cross-tab storage.
function useThemePreference(): Preference {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(THEME_EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(THEME_EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") {
          return stored;
        }
      } catch {
        /* ignore */
      }
      return "system";
    },
    () => "system",
  );
}

export default function ThemeToggle() {
  const pref = useThemePreference();
  const [open, setOpen] = useState(false);

  // Keep <html data-theme> in sync with the stored preference on every mount and change.
  // The pre-paint script sets it on a full load, but soft client-side navigations don't
  // re-run that script — re-applying here guarantees the theme a user picked on one page
  // is reflected on every other page. While following the OS, also track live changes.
  // Side-effect only (no setState), so it's lint-clean.
  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY);
    const apply = () => {
      document.documentElement.dataset.theme =
        pref === "light" || pref === "dark" ? pref : mq.matches ? "dark" : "light";
    };
    apply();
    if (pref !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [pref]);

  // Close the menu on Escape (click-away is handled by the backdrop).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function choose(p: Preference) {
    applyPreference(p);
    setOpen(false);
  }

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="theme-btn"
        style={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${LABELS[pref]}`}
        title={`Theme: ${LABELS[pref]}`}
      >
        {ICONS[pref]}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div style={styles.backdrop} onClick={() => setOpen(false)} />
          <div style={styles.panel} role="menu" aria-label="Color theme">
            <p style={styles.heading}>Theme</p>
            {CYCLE.map((p) => {
              const active = pref === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  className="theme-row"
                  style={{ ...styles.row, ...(active ? styles.rowActive : null) }}
                  onClick={() => choose(p)}
                >
                  <span style={styles.rowIcon}>{ICONS[p]}</span>
                  <span style={styles.rowLabel}>{LABELS[p]}</span>
                  <span style={styles.rowCheck}>{active ? "●" : ""}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { position: "relative" },
  trigger: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    flex: "none",
    border: "1px solid var(--border)",
    borderRadius: 9,
    background: "var(--surface)",
    color: "var(--muted)",
    cursor: "pointer",
    padding: 0,
  },
  backdrop: { position: "fixed", inset: 0, zIndex: 10 },
  // Anchored to the trigger's right edge, expanding down-and-left so it never
  // spills off the screen-right where the toggle lives.
  panel: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    zIndex: 11,
    width: 184,
    maxWidth: "calc(100vw - 32px)",
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    boxShadow: "var(--shadow-card)",
    padding: 8,
  },
  heading: {
    margin: "4px 8px 8px",
    fontFamily: "var(--font-geist-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--muted)",
  },
  row: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 10px",
    background: "transparent",
    border: "none",
    borderRadius: 9,
    cursor: "pointer",
    textAlign: "left",
    color: "var(--foreground)",
  },
  rowActive: { background: "var(--accent-soft)", color: "var(--accent)" },
  rowIcon: { display: "inline-flex", flex: "none", width: 16 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: 600 },
  rowCheck: { flex: "none", width: 10, color: "var(--accent)", fontSize: 9 },
};
