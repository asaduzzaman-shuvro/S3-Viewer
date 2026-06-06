"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <button onClick={handleLogout} className="signout-btn" style={styles.btn}>
      Sign out
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  btn: {
    padding: "7px 16px",
    fontSize: 13,
    fontWeight: 600,
    background: "var(--surface)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    cursor: "pointer",
  },
};
