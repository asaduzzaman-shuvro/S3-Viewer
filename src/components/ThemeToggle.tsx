"use client";

import { useEffect, useSyncExternalStore } from "react";

type Preference = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const THEME_EVENT = "themechange";

const OPTIONS: { value: Preference; label: string; glyph: string }[] = [
  { value: "light", label: "Light", glyph: "☀" },
  { value: "dark", label: "Dark", glyph: "🌙" },
  { value: "system", label: "System", glyph: "🖥" },
];

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

  // While following the OS, keep <html data-theme> in sync as the system theme flips.
  // Side-effect only (no setState), so it's lint-clean.
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia(DARK_QUERY);
    const sync = () => {
      document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [pref]);

  return (
    <div style={styles.group} role="group" aria-label="Color theme">
      {OPTIONS.map((opt) => {
        const active = pref === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => applyPreference(opt.value)}
            className={`theme-seg${active ? " theme-seg-active" : ""}`}
            style={{ ...styles.seg, ...(active ? styles.segActive : {}) }}
            aria-pressed={active}
            aria-label={`${opt.label} theme`}
            title={`${opt.label} theme`}
          >
            <span aria-hidden style={styles.glyph}>
              {opt.glyph}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  group: {
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    padding: 3,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface)",
  },
  seg: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 28,
    border: "none",
    borderRadius: 7,
    background: "transparent",
    color: "var(--muted)",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
  },
  segActive: {
    background: "var(--card)",
    color: "var(--accent)",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.12)",
  },
  glyph: { fontSize: 13 },
};
