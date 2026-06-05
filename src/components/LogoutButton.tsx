"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <button onClick={handleLogout} style={styles.btn}>
      Sign out
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  btn: {
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    background: "transparent",
    color: "#666",
    border: "1px solid #ddd",
    borderRadius: 6,
    cursor: "pointer",
  },
};
